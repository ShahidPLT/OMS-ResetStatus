process.env.AWS_PROFILE = "plt-staging"
process.env.AWS_REGION = "eu-west-1"

const aws = require("aws-sdk");
const fg = require("fast-glob");
const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const uuidv4 = require('uuid/v4');

const { isAnyItemsRefunded } = require('./functions/is-any-items-refunded.function');
const { isAllItemsShipped } = require('./functions/is-all-items-shipped.function');

const allowReverseShippingRefunded = true;

(async () => {
    const entries = await fg(["./batch/*.csv"], { dot: false });
    for (const file of entries) {
        console.log(`Processing ${file}`);
        const data = await readCsv(file);

        for (const orderData of data) {
            const order = await getOrder(orderData.orderNumber);

            if (!order) {
                console.log(`${orderData.orderNumber} Order Number not found`);
                continue;
            }
            const orderDetails = getOrderDetails(order);
            const orderDataSkus = orderData.sku.split(',');

            // Loop through each SKU from row
            for (const orderDataSku of orderDataSkus) {
                let activityMerge = [];
                const refundedStatuses = getRefundedStatuses(order, orderDataSku);
                if (!refundedStatuses.length) {
                    console.log(`${orderData.orderNumber} ${orderDataSku} Refund Statuses not found ('Refund Requested', 'Refund Pending', 'Refunded')`);
                    continue;
                }

                const refundedQty = getRefundedQty(order, orderDataSku);
                const financeCancelledQty = getFinanceCancelledQty(order, orderDataSku);

                if (!refundedQty && !financeCancelledQty) {
                    console.log(`${orderData.orderNumber} ${orderDataSku} Refunded Status or Finance Cancelled Status not found`);
                    continue;
                }


                // Update existing refund orderline statuses and then insert orderline Shipped status
                await updateReundedStatusesToReverseCharge(orderData.orderNumber, refundedStatuses);
                await insertOrderlineStatus(orderData.orderNumber, {
                    status: 'Shipped',
                    sku: orderDataSku,
                    qty: refundedQty || financeCancelledQty,
                    source: getWarehouseFromSku(order, orderDataSku)
                });
                activityMerge.push(`Reset orderline Cancelled to Shipped (${orderDataSku}) QTY: ${parseInt(refundedQty || financeCancelledQty, 10)}`);

                // check if order status needs updating to Shipped
                const orderStatus = getOrderDetails(order).OrderStatus;
                if (orderStatus === "Partial Refund Processed") {
                    const orderRecheck = await getOrder(orderData.orderNumber);
                    if (!isAnyItemsRefunded(orderRecheck) && isAllItemsShipped(orderRecheck)) {
                        await updateOrderStatus(orderData.orderNumber, 'Shipped')
                    }
                }


                if (orderStatus === "Cancelled" || orderStatus === "Packing") {
                    const isShippingRefunded = orderDetails.ShippingRefunded && orderDetails.ShippingRefunded === "Yes";
                    if (isShippingRefunded && allowReverseShippingRefunded) {
                        await updateNoShippingRefunded(orderData.orderNumber);
                        activityMerge.push("Reverse Refund Shipping Charge");
                    }

                    const orderRecheck = await getOrder(orderData.orderNumber);
                    if (!isAnyItemsRefunded(orderRecheck) && isAllItemsShipped(orderRecheck)) {
                        await updateOrderStatus(orderData.orderNumber, 'Shipped')
                    }
                }

                if (activityMerge.length > 0) {
                    await insertLog(orderData.orderNumber, activityMerge.join("\n"));
                }
                console.log(`${orderData.orderNumber} ${orderDataSku} Resetted Orderline to Shipped Status`);
            }

            //move processed file to done
            await fs.promises.rename(file, `./batch/done/${path.parse(file).base}`);
        }
    }
})();

function getWarehouseFromSku(order, sku) {
    const orderDetails = order.find(item => item.AttributeId === "Details");
    const warehouse = orderDetails.OrderLines.find(orderline => orderline.Sku === sku).StockAllocation;

    return warehouse;
}

function getRefundedQty(order, sku) {
    const refundedStatus = order.find(item => {
        return item.AttributeId.startsWith(`OrderLine#Status#${sku}`) && item.Status === "Refunded";
    }) || {};

    return refundedStatus.Qty || false;
}

function getFinanceCancelledQty(order, sku) {
    const financeCancelledStatus = order.find(item => {
        return item.AttributeId.startsWith(`OrderLine#Status#${sku}`) && item.Status === "Finance Cancelled";
    }) || {};

    return financeCancelledStatus.Qty || false;
}

async function readCsv(filepath) {
    const data = [];
    return new Promise(function (resolve, reject) {
        fs.createReadStream(filepath)
            .pipe(csv.parse({ headers: false }))
            .on("error", (error) => reject(error))
            .on("data", (row) => {
                data.push({
                    orderNumber: row[0],
                    sku: row[1].trim(),
                });
            })
            .on("end", () => {
                resolve(data);
            });
    });
}

async function getOrder(orderNumber) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const params = {
        TableName: 'OrdersV3',
        KeyConditionExpression: '#OrderId = :orderNumber',
        ExpressionAttributeNames: {
            '#OrderId': 'OrderId',
        },
        ExpressionAttributeValues: {
            ':orderNumber': orderNumber,
        },
    };

    const order = await documentClient.query(params).promise();

    if (!order.Items.length) {
        return false;
    }

    return order.Items;
}

function getRefundedStatuses(order, sku) {
    const filterStatus = ['Refund Requested', 'Refund Pending', 'Refunded'];

    return order.filter(item => {
        return item.AttributeId.startsWith(`OrderLine#Status#${sku}`) && filterStatus.includes(item.Status);
    });
}


async function updateReundedStatusesToReverseCharge(orderNumber, statuses) {
    for (const status of statuses) {
        await updateOrderlineStatus(orderNumber, status.AttributeId, `${status.Status} Reverse Charge`)
    }
}


async function updateOrderlineStatus(orderNumber, attributeId, status) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const params = {
        TableName: "OrdersV3",
        Key: {
            OrderId: orderNumber,
            AttributeId: attributeId
        },
        UpdateExpression: "SET #Status = :status",
        ExpressionAttributeValues: {
            ":status": status
        },
        ExpressionAttributeNames: {
            "#Status": "Status"
        }
    };

    return documentClient.update(params).promise();
}

async function updateOrderStatus(orderNumber, status) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const params = {
        TableName: "OrdersV3",
        Key: {
            OrderId: orderNumber,
            AttributeId: 'Details'
        },
        UpdateExpression: "SET #Status = :status",
        ExpressionAttributeValues: {
            ":status": status
        },
        ExpressionAttributeNames: {
            "#Status": "OrderStatus"
        }
    };

    return documentClient.update(params).promise();
}

async function updateNoShippingRefunded(orderNumber) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const params = {
        TableName: "OrdersV3",
        Key: {
            OrderId: orderNumber,
            AttributeId: 'Details'
        },
        UpdateExpression: "SET #ShippingRefunded = :value",
        ExpressionAttributeValues: {
            ":value": 'No'
        },
        ExpressionAttributeNames: {
            "#ShippingRefunded": "ShippingRefunded"
        }
    };

    return documentClient.update(params).promise();
}

async function insertOrderlineStatus(orderNumber, statusData) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const hash = uuidv4().substring(0, 5);
    const createdAt = new Date();

    const params = {
        TableName: "OrdersV3",
        Item: {
            AttributeId: `OrderLine#Status#${statusData.sku}#${createdAt.getTime()}#${hash}`,
            OrderId: orderNumber,
            CreatedAt: createdAt.toISOString(),
            Qty: parseInt(statusData.qty, 10),
            Status: statusData.status,
            Source: statusData.source,
        }
    }

    await documentClient.put(params).promise();
}


async function insertLog(orderNumber, comment) {
    const documentClient = new aws.DynamoDB.DocumentClient();
    const params = {
        TableName: "OrdersLogs",
        Item: {
            Id: uuidv4(),
            OrderId: orderNumber,
            CreatedAt: new Date().toISOString(),
            User: 'System',
            Type: 'Shipment',
            Comment: comment,
            UserId: null,
            LogData: {},
        },
    }

    await documentClient.put(params).promise();
}

function getOrderDetails(order) {
    return order.find(item => item.AttributeId === "Details");
}

const aws = require("aws-sdk");
const fg = require("fast-glob");
const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const uuidv4 = require('uuid/v4');

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
            const refundedStatuses = getRefundedStatuses(order, orderData.sku);
            if (!refundedStatuses.length) {
                console.log(`${orderData.orderNumber} Refunded Statuses not found`);
                continue;
            }

            const refundedQty = getRefundedQty(order, orderData.sku);
            if (!refundedQty) {
                console.log(`${orderData.orderNumber} Refunded Status not found`);
                continue;
            }

            await updateReundedStatusesToReverseCharge(orderData.orderNumber, refundedStatuses);
            await insertOrderlineStatus(orderData.orderNumber, {
                status: 'Shipped',
                sku: orderData.sku,
                qty: refundedQty,
                source: getWarehouseFromSku(order, orderData.sku)
            });
            console.log(`${orderData.orderNumber} ${orderData.sku} Resetted Refunded to Shipped Status`);

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
    });

    return refundedStatus.Qty;
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
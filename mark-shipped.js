process.env.AWS_REGION = "eu-west-1"

const aws = require("aws-sdk");
const fg = require("fast-glob");
const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const uuidv4 = require('uuid/v4');

(async () => {
    const entries = await fg(["./batch-shipped/*.csv"], { dot: false });
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
                const orderlineStatus = isWithoutOrderlineStatus(order, orderDataSku);
                if (!orderlineStatus) {
                    console.log(`${orderData.orderNumber} ${orderDataSku} OrderLine Status found - skipping`);
                    continue;
                }


                await insertOrderlineStatus(orderData.orderNumber, {
                    status: 'Shipped',
                    sku: orderDataSku,
                    qty: orderData.dispatched,
                    source: getWarehouseFromSku(order, orderDataSku)
                });
                activityMerge.push(`Script - Orderline Status to Shipped (${orderDataSku}) QTY: ${parseInt(orderData.dispatched, 10)}`);

                if (activityMerge.length > 0) {
                    await insertLog(orderData.orderNumber, activityMerge.join("\n"));
                }
                console.log(`${orderData.orderNumber} ${orderDataSku} Resetted Orderline to Shipped Status`);
            }
        }

        //move processed file to done
        await fs.promises.rename(file, `./batch-shipped/done/${path.parse(file).base}`);
    }
})();

function getWarehouseFromSku(order, sku) {
    const orderDetails = order.find(item => item.AttributeId === "Details");
    const warehouse = orderDetails.OrderLines.find(orderline => orderline.Sku === sku).StockAllocation;

    return warehouse;
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
                    dispatched: row[2].trim(),
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

function isWithoutOrderlineStatus(order, sku) {
    return !order.some(item => {
        return item.AttributeId.startsWith(`OrderLine#Status#${sku}`);
    });
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

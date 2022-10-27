process.env.AWS_REGION = "eu-west-1"

const aws = require("aws-sdk");
const fs = require("fs");
const csv = require("fast-csv");

(async () => {
  const csvDataShipped = await readCsv('./shipped-status.csv');
  const csvDataPartialRefund = await readCsv('./shipped-partial-refund-processed.csv');

  for (const row of csvDataPartialRefund) {
    await updateOrderStatus(row.orderNumber, "Partial Refund Processed");
    console.log(`${row.orderNumber} Fixed Order Status to: Partial Refund Processed`);
  }

  for (const row of csvDataShipped) {
    await updateOrderStatus(row.orderNumber, "Shipped");
    console.log(`${row.orderNumber} Fixed Order Status to: Shipped`);
  }
})();




async function readCsv(filepath) {
  const data = [];
  return new Promise(function (resolve, reject) {
    fs.createReadStream(filepath)
      .pipe(csv.parse({ headers: false }))
      .on("error", (error) => reject(error))
      .on("data", (row) => {
        data.push({
          orderNumber: row[0]
        });
      })
      .on("end", () => {
        resolve(data);
      });
  });
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

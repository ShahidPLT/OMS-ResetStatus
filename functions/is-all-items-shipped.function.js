function isAllItemsShipped(order) {
  const orderItems = getOrderDetails(order).OrderLines;
  let shippedQuantity = getTotalShippedQty(order);

  let totalQuantity = 0;
  orderItems.some(orderItem => {
    totalQuantity += parseInt(orderItem.Quantity);
  });

  return shippedQuantity === totalQuantity;
}

function getTotalShippedQty(order) {
  let shippedQuantity = 0;
  const shippedItems = order.filter(item => {
    return item.AttributeId.startsWith(`OrderLine#Status#`) && item.Status === "Shipped";
  });

  shippedItems.forEach(shippedItem => {
    shippedQuantity += parseInt(shippedItem.Qty);
  });

  return shippedQuantity;
}

function getOrderDetails(order) {
  return order.find(item => item.AttributeId === "Details");
}

module.exports = { isAllItemsShipped };
function isAnyItemsRefunded(order) {
  const filterStatus = ['Refund Requested', 'Refund Pending', 'Refunded'];

  return order.some(item => {
    return item.AttributeId.startsWith(`OrderLine#Status#`) && filterStatus.includes(item.Status);
  });
}

module.exports = { isAnyItemsRefunded };
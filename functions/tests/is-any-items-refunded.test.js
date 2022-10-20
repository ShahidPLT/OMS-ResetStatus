const { isAnyItemsRefunded } = require('../is-any-items-refunded.function');

describe('test isAnyItemsRefunded', () => {
  it('should return false - no items have been refunded', () => {
    const order = [
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAnyItemsRefunded(order)).toEqual(false);
  });

  it('should return true if there is Refund Pending item', () => {
    const order = [
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Refund Pending',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAnyItemsRefunded(order)).toEqual(true);
  });

  it('should return true if there is Refund Refunded item', () => {
    const order = [
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Refunded',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAnyItemsRefunded(order)).toEqual(true);
  });

  it('should return true if there is Refund Requested item', () => {
    const order = [
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Refund Requested',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 1,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAnyItemsRefunded(order)).toEqual(true);
  });
});
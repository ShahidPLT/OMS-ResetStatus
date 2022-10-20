const { isAllItemsShipped } = require('../is-all-items-shipped.function');

describe('test isAllItemsShipped', () => {
  it('all items is shipped', () => {
    const order = [
      {
        AttributeId: 'Details',
        OrderLines: [
          {
            Sku: 'CLU8990/4/183',
            Quantity: '1.0000'
          },
          {
            Sku: 'CLU8990/1/183',
            Quantity: '1.0000'
          }
        ]
      },
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

    expect(isAllItemsShipped(order)).toEqual(true);
  });

  it('all items have not been shipped', () => {
    const order = [
      {
        AttributeId: 'Details',
        OrderLines: [
          {
            Sku: 'CLU8990/4/183',
            Quantity: '1.0000'
          },
          {
            Sku: 'CLU8990/1/183',
            Quantity: '1.0000'
          }
        ]
      }
    ]

    expect(isAllItemsShipped(order)).toEqual(false);
  });

  it('one of the item have not been shipped', () => {
    const order = [
      {
        AttributeId: 'Details',
        OrderLines: [
          {
            Sku: 'CLU8990/4/183',
            Quantity: '1.0000'
          },
          {
            Sku: 'CLU8990/1/183',
            Quantity: '1.0000'
          }
        ]
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

    expect(isAllItemsShipped(order)).toEqual(false);
  });

  it('all items shipped - each item have more than 1 Qty', () => {
    const order = [
      {
        AttributeId: 'Details',
        OrderLines: [
          {
            Sku: 'CLU8990/4/183',
            Quantity: '2.0000'
          },
          {
            Sku: 'CLU8990/1/183',
            Quantity: '5.0000'
          }
        ]
      },
      {
        Qty: 2,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 5,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAllItemsShipped(order)).toEqual(true);
  });

  it('not all items shipped - each item have more than 1 Qty', () => {
    const order = [
      {
        AttributeId: 'Details',
        OrderLines: [
          {
            Sku: 'CLU8990/4/183',
            Quantity: '2.0000'
          },
          {
            Sku: 'CLU8990/1/183',
            Quantity: '5.0000'
          }
        ]
      },
      {
        Qty: 2,
        AttributeId: 'OrderLine#Status#CLU8990/4/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      },
      {
        Qty: 4,
        AttributeId: 'OrderLine#Status#CLU8990/1/183#1666181794737#57460',
        Source: 'GB-SHE-JDA-1',
        Status: 'Shipped',
        OrderId: '122-2927681-1228751',
        CreatedAt: '2022-10-19T12:16:34.737Z'
      }
    ]

    expect(isAllItemsShipped(order)).toEqual(false);
  });
});
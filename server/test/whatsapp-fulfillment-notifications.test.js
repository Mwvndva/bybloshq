import test from 'node:test';
import assert from 'node:assert/strict';
import whatsappService from '../src/services/whatsapp.service.js';

const physicalSeller = {
  name: 'Physical Shop Seller',
  phone: '0712345678',
  physical_address: 'Moi Avenue, Nairobi',
  latitude: -1.2864,
  longitude: 36.8172,
  shopName: 'Physical Shop Seller'
};

const buyer = {
  name: 'Buyer',
  phone: '0711111111'
};

function courierOrder(overrides = {}) {
  return {
    id: 123,
    orderNumber: 'BYB-TEST',
    totalAmount: 62,
    buyer,
    seller: physicalSeller,
    service: { title: 'Package', price: 62, quantity: 1 },
    items: [{ title: 'Package', quantity: 1 }],
    location: { address: 'TRM Drive, Roysambu' },
    type: 'PHYSICAL',
    fulfillmentType: 'COURIER',
    status: 'DELIVERY_PENDING',
    metadata: {},
    ...overrides
  };
}

test('courier order from seller with physical address uses door delivery copy in payment notification', () => {
  const message = whatsappService.buildWhatsAppMessage(courierOrder(), 'buyer');

  assert.match(message, /\*Delivery:\*\nMzigo Ego checks the package, then delivers it to your address\./);
  assert.doesNotMatch(message, /At Shop|Shop:/);
  assert.doesNotMatch(message, /collect your order at the shop/i);
});

test('courier order from seller with physical address uses door delivery copy in buyer status update', async () => {
  const originalSendMessage = whatsappService.sendMessage.bind(whatsappService);
  let sentMessage = '';
  whatsappService.sendMessage = async (_phone, message) => {
    sentMessage = message;
    return true;
  };

  try {
    await whatsappService.notifyBuyerStatusUpdate({
      buyer,
      seller: physicalSeller,
      order: courierOrder({ fulfillment_type: 'COURIER' }),
      location: { address: 'TRM Drive, Roysambu' },
      newStatus: 'DELIVERY_PENDING'
    });
  } finally {
    whatsappService.sendMessage = originalSendMessage;
  }

  assert.match(sentMessage, /Door delivery: Mzigo Ego will check the package and deliver it to your address/);
  assert.match(sentMessage, /door delivery/i);
  assert.doesNotMatch(sentMessage, /Shop:/);
  assert.doesNotMatch(sentMessage, /collect your order at the shop/i);
});

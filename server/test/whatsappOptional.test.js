// WhatsApp is no longer a notification channel — only an optional alternative
// contact — so registration must NOT require it (mobile payment is still required).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registrationSchema } from '../src/application/middleware/authValidation.js';
import { sellerRegistrationSchema } from '../src/application/middleware/sellerValidation.js';

const buyer = {
  fullName: 'A Buyer', email: 'a@byblos.test',
  password: 'Passw0rd!', confirmPassword: 'Passw0rd!',
  mobilePayment: '0712345678', city: 'Nairobi', location: 'CBD', termsAccepted: true,
};
const seller = {
  fullName: 'A Seller', shopName: 'MyShop', email: 's@byblos.test',
  password: 'Passw0rd!', confirmPassword: 'Passw0rd!',
  city: 'Nairobi', location: 'CBD', termsAccepted: true,
};

describe('registration validation — WhatsApp is optional', () => {
  it('buyer registration passes WITHOUT a WhatsApp number', () => {
    const r = registrationSchema.safeParse(buyer);
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error?.issues));
  });

  it('buyer registration still passes WITH a WhatsApp number (backward compatible)', () => {
    assert.equal(registrationSchema.safeParse({ ...buyer, whatsappNumber: '0712345678' }).success, true);
  });

  it('buyer registration STILL requires mobile payment (only WhatsApp was relaxed)', () => {
    const { mobilePayment, ...noMobile } = buyer;
    void mobilePayment;
    const r = registrationSchema.safeParse(noMobile);
    assert.equal(r.success, false, 'mobile payment must still be required');
  });

  it('seller registration passes WITHOUT a WhatsApp number', () => {
    const r = sellerRegistrationSchema.safeParse(seller);
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error?.issues));
  });
});

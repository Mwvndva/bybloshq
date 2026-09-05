// Regression tests for server/src/domains/orders/escrow/escrowMoney.utils.js
//
// Covers audit finding P3-1 (platform fee could be recorded as negative on
// the payouts table when order pricing fields were inconsistent). Pure
// logic, no database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlatformRetainedAmount, toCents, roundMoney } from '../src/domains/orders/escrow/escrowMoney.utils.js';

describe('calculatePlatformRetainedAmount (audit P3-1)', () => {
  test('computes the flat platform fee for a normal order with no checkout pricing metadata', () => {
    const order = { id: 1, platform_fee_amount: 10 };
    const result = calculatePlatformRetainedAmount(order, 1000, 980);
    assert.equal(result.amount, 10);
    assert.equal(result.wasNegative, false);
  });

  test('derives the fee from total - payout when platform_fee_amount is absent', () => {
    const order = { id: 2 };
    const result = calculatePlatformRetainedAmount(order, 1000, 990);
    assert.equal(result.amount, 10);
    assert.equal(result.wasNegative, false);
  });

  test('clamps to zero instead of returning a negative fee when pricing is inconsistent (the actual bug)', () => {
    // sellerPayoutAmount larger than totalAmount should never happen in a
    // healthy order, but if upstream pricing ever produces it, the fee must
    // clamp to 0 rather than silently persist a negative platform_fee_amount.
    const order = { id: 3 };
    const result = calculatePlatformRetainedAmount(order, 1000, 1050);
    assert.equal(result.amount, 0);
    assert.equal(result.wasNegative, true);
  });

  test('uses the checkout-pricing branch (metadata.pricing) when present and non-negative', () => {
    const order = {
      id: 4,
      metadata: { pricing: { buyer_delivery_fee: 50 } }
    };
    // total 1000, payout 940, delivery 50 -> retained = 1000 - 940 - 50 = 10
    const result = calculatePlatformRetainedAmount(order, 1000, 940);
    assert.equal(result.amount, 10);
    assert.equal(result.wasNegative, false);
  });

  test('falls back to the flat-fee branch (still clamped) when the checkout-pricing branch would itself go negative', () => {
    const order = {
      id: 5,
      metadata: { pricing: { buyer_delivery_fee: 500 } },
      platform_fee_amount: 10
    };
    // total 1000, payout 940, delivery 500 -> retained = -440 (negative),
    // so it must fall through to the flat platform_fee_amount (10), not
    // persist -440.
    const result = calculatePlatformRetainedAmount(order, 1000, 940);
    assert.equal(result.amount, 10);
    assert.equal(result.wasNegative, false);
  });

  test('handles a JSON-string metadata column (as returned by some drivers/paths)', () => {
    const order = { id: 6, metadata: JSON.stringify({ pricing: { buyer_delivery_fee: 20 } }) };
    const result = calculatePlatformRetainedAmount(order, 500, 470);
    assert.equal(result.amount, 10);
  });

  test('does not throw on malformed metadata JSON', () => {
    const order = { id: 7, metadata: '{not-json' };
    assert.doesNotThrow(() => calculatePlatformRetainedAmount(order, 500, 490));
  });
});

describe('toCents / roundMoney', () => {
  test('toCents rounds to the nearest integer cent', () => {
    assert.equal(toCents(10.005), 1001);
  });

  test('roundMoney round-trips through cents', () => {
    assert.equal(roundMoney(10.005), 10.01);
  });
});

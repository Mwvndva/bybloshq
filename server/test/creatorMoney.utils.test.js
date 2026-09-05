// Regression tests for server/src/domains/growth/creators/creatorMoney.utils.js
//
// Covers audit findings P1-3 (creator self-referral) and P2-1 (referral
// reward exceeding its own funding source). Pure logic, no database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSelfReferral,
  computeCreatorReferralReward,
  computeClearance,
  roundMoney
} from '../src/domains/growth/creators/creatorMoney.utils.js';

describe('isSelfReferral (audit P1-3)', () => {
  test('rejects when the checking-out identity holds the SAME creator profile id as the link', () => {
    const result = isSelfReferral({
      buyerCreatorId: 42,
      creatorId: 42,
      creatorUserId: 900,
      creatorEmail: 'creator@example.com',
      creatorPhone: '254712345678'
    });
    assert.equal(result, true);
  });

  test('rejects when the checking-out identity is the SAME authenticated user id as the creator (regression for the guest-checkout bypass)', () => {
    // This is the exact gap the audit found: a creator authenticated in any
    // role, checking out with a DIFFERENT email/phone than their creator
    // profile, must still be caught via the server-derived user id.
    const result = isSelfReferral({
      buyerUserId: 900,
      buyerEmail: 'a-different-guest-email@example.com',
      buyerPhone: '254799999999',
      creatorId: 42,
      creatorUserId: 900,
      creatorEmail: 'creator@example.com',
      creatorPhone: '254712345678'
    });
    assert.equal(result, true);
  });

  test('rejects on matching email regardless of casing/whitespace', () => {
    const result = isSelfReferral({
      buyerEmail: '  Creator@Example.com  ',
      creatorId: 42,
      creatorEmail: 'creator@example.com'
    });
    assert.equal(result, true);
  });

  test('rejects on matching phone even with different formatting (+254 vs 0-prefixed)', () => {
    const result = isSelfReferral({
      buyerPhone: '+254712345678',
      creatorId: 42,
      creatorPhone: '0712345678'
    });
    assert.equal(result, true);
  });

  test('allows a legitimate third-party buyer with no overlapping identity signals', () => {
    const result = isSelfReferral({
      buyerCreatorId: null,
      buyerUserId: 501,
      buyerEmail: 'real-customer@example.com',
      buyerPhone: '254700111222',
      creatorId: 42,
      creatorUserId: 900,
      creatorEmail: 'creator@example.com',
      creatorPhone: '254712345678'
    });
    assert.equal(result, false);
  });

  test('does not false-positive when both identities simply have no email/phone on file', () => {
    const result = isSelfReferral({
      buyerEmail: null,
      buyerPhone: null,
      creatorId: 42,
      creatorEmail: null,
      creatorPhone: null
    });
    assert.equal(result, false);
  });

  test('rejects on direct buyer-profile-id match (post-hoc-only signal: order buyer IS the creator\'s own linked buyer profile)', () => {
    // Regression for the T+2 review-hold follow-up: a guest checkout that
    // used contact info not matching the creator's registered email/phone
    // can still resolve to the SAME buyers.id the creator's own account is
    // linked to (e.g. they've bought as a "guest" with that identity
    // before). Checkout-time couldn't always know this; the post-hoc check
    // can, via the stable buyers.id relationship.
    const result = isSelfReferral({
      buyerId: 777,
      creatorOwnBuyerId: 777,
      buyerEmail: 'totally-different-guest-email@example.com',
      buyerPhone: '254788888888',
      creatorId: 42,
      creatorEmail: 'creator@example.com',
      creatorPhone: '254712345678'
    });
    assert.equal(result, true);
  });

  test('does not flag on buyer-profile-id signal when the creator has no linked buyer profile', () => {
    const result = isSelfReferral({
      buyerId: 777,
      creatorOwnBuyerId: null,
      buyerEmail: 'real-customer@example.com',
      creatorId: 42,
      creatorEmail: 'creator@example.com'
    });
    assert.equal(result, false);
  });
});

describe('computeClearance (T+2 review-hold)', () => {
  const now = new Date('2026-09-05T00:00:00Z');

  test('a normal earning becomes available once 2 business days have elapsed', () => {
    const result = computeClearance({
      totalBalance: 100,
      earnings: [{ amount: 100, createdAt: new Date('2026-09-01T00:00:00Z') }], // Tue -> clears Thu
      now
    });
    assert.equal(result.availableBalance, 100);
    assert.equal(result.clearingBalance, 0);
    assert.equal(result.hasFlaggedHolds, false);
  });

  test('a normal earning within the T+2 window is uncleared but not flagged', () => {
    const result = computeClearance({
      totalBalance: 100,
      earnings: [{ amount: 100, createdAt: new Date('2026-09-04T00:00:00Z') }], // Fri -> clears Tue
      now
    });
    assert.equal(result.availableBalance, 0);
    assert.equal(result.clearingBalance, 100);
    assert.equal(result.hasFlaggedHolds, false);
    assert.ok(result.nextAvailableAt);
  });

  test('a flagged earning stays uncleared even after the T+2 window has long passed (the actual fix)', () => {
    const result = computeClearance({
      totalBalance: 100,
      earnings: [{ amount: 100, createdAt: new Date('2026-01-01T00:00:00Z'), flaggedForReview: true }],
      now
    });
    assert.equal(result.availableBalance, 0);
    assert.equal(result.clearingBalance, 100);
    assert.equal(result.flaggedAmount, 100);
    assert.equal(result.hasFlaggedHolds, true);
    // No scheduled release date to report — it's held indefinitely pending review.
    assert.equal(result.nextAvailableAt, null);
  });

  test('mixes a cleared, an uncleared, and a flagged earning correctly', () => {
    const result = computeClearance({
      totalBalance: 300,
      earnings: [
        { amount: 100, createdAt: new Date('2026-01-01T00:00:00Z') }, // long cleared
        { amount: 100, createdAt: new Date('2026-09-04T00:00:00Z') }, // still within T+2
        { amount: 100, createdAt: new Date('2026-01-01T00:00:00Z'), flaggedForReview: true } // held indefinitely
      ],
      now
    });
    assert.equal(result.availableBalance, 100);
    assert.equal(result.clearingBalance, 200);
    assert.equal(result.flaggedAmount, 100);
    assert.equal(result.hasFlaggedHolds, true);
  });

  test('ignores non-positive or non-finite amounts defensively', () => {
    const result = computeClearance({
      totalBalance: 50,
      earnings: [{ amount: 0, createdAt: now }, { amount: NaN, createdAt: now }, { amount: -5, createdAt: now }],
      now
    });
    assert.equal(result.availableBalance, 50);
    assert.equal(result.clearingBalance, 0);
  });
});

describe('computeCreatorReferralReward (audit P2-1)', () => {
  test('does not cap a normal 1-3 unit order', () => {
    const result = computeCreatorReferralReward({ units: 2, rewardRatePerUnit: 3, platformFeeAmount: 10 });
    assert.equal(result.amount, 6);
    assert.equal(result.capped, false);
  });

  test('caps the reward at the platform flat fee once quantity makes the naive reward exceed it', () => {
    // 5 units * KES 3 = KES 15, which is MORE than the KES 10 flat fee this
    // reward is supposed to be funded from — this is the exact bug found in
    // the audit. The reward must never exceed the fee.
    const result = computeCreatorReferralReward({ units: 5, rewardRatePerUnit: 3, platformFeeAmount: 10 });
    assert.equal(result.uncappedAmount, 15);
    assert.equal(result.amount, 10);
    assert.equal(result.capped, true);
  });

  test('caps exactly at the boundary (units * rate === platform fee) without over- or under-capping', () => {
    const result = computeCreatorReferralReward({ units: 10, rewardRatePerUnit: 1, platformFeeAmount: 10 });
    assert.equal(result.amount, 10);
    assert.equal(result.capped, false);
  });

  test('treats a missing/zero quantity as at least 1 unit', () => {
    const result = computeCreatorReferralReward({ units: 0, rewardRatePerUnit: 3, platformFeeAmount: 10 });
    assert.equal(result.amount, 3);
  });

  test('never returns a negative or fractional-cent amount', () => {
    const result = computeCreatorReferralReward({ units: 3, rewardRatePerUnit: 3.335, platformFeeAmount: 10 });
    assert.ok(result.amountCents >= 0);
    assert.equal(Number.isInteger(result.amountCents), true);
  });
});

describe('roundMoney', () => {
  test('rounds to 2 decimal places via integer cents', () => {
    assert.equal(roundMoney(9.005), 9.01);
    assert.equal(roundMoney(9.004), 9);
  });
});

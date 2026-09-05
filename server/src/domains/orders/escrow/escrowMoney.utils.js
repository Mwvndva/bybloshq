/**
 * escrowMoney.utils.js
 *
 * Pure, DB-free money math extracted from EscrowManager.js so it can be unit
 * tested without a database connection (EscrowManager itself transitively
 * imports the live DB pool via CreatorService, which throws at import time
 * if DB_* env vars aren't set — these helpers have zero imports).
 *
 * Behavior is unchanged from the inline version except for the P3-1 fix
 * noted below.
 */

/**
 * Convert a KES amount to integer cents (rounded).
 * @param {number} amount
 * @returns {number}
 */
export function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Round a KES amount to 2 decimal places via integer cents.
 * @param {number} amount
 * @returns {number}
 */
export function roundMoney(amount) {
  return toCents(amount) / 100;
}

function getOrderMetadata(order) {
  if (!order?.metadata) return {};
  if (typeof order.metadata === 'string') {
    try {
      return JSON.parse(order.metadata);
    } catch {
      return {};
    }
  }
  return order.metadata;
}

/**
 * Compute the platform's retained fee for an order's escrow release.
 *
 * FIX (audit P3-1): the fallback branch derived the fee as
 * `totalAmount - sellerPayoutAmount`, which is not guaranteed non-negative if
 * an order's pricing fields are inconsistent upstream. A negative
 * `platform_fee_amount` is a reporting/reconciliation corruption (it does not
 * affect the seller payout or buyer total, which are computed independently),
 * but it should never be possible to persist. The result is now clamped to
 * zero, with `wasNegative: true` returned so the caller can log the
 * underlying pricing bug instead of silently swallowing it.
 *
 * @param {object} order - order row (reads order.metadata, platform_fee_amount/platformFeeAmount)
 * @param {number} totalAmount
 * @param {number} sellerPayoutAmount
 * @returns {{ amount: number, wasNegative: boolean }}
 */
export function calculatePlatformRetainedAmount(order, totalAmount, sellerPayoutAmount) {
  const metadata = getOrderMetadata(order);
  const hasCheckoutPricing = Boolean(
    metadata?.pricing?.payable_total !== undefined
    || metadata?.pricing?.buyer_delivery_fee !== undefined
    || metadata?.pricing?.buyer_service_charge !== undefined
  );

  if (hasCheckoutPricing) {
    const buyerDeliveryFeeCents = toCents(metadata?.pricing?.buyer_delivery_fee || 0);
    const totalCents = toCents(totalAmount);
    const sellerPayoutCents = toCents(sellerPayoutAmount);
    const retainedCents = totalCents - sellerPayoutCents - buyerDeliveryFeeCents;

    if (retainedCents >= 0) {
      return { amount: retainedCents / 100, wasNegative: false };
    }
  }

  const feeVal = order.platform_fee_amount ?? order.platformFeeAmount ?? (totalAmount - sellerPayoutAmount);
  const feeCents = toCents(feeVal);

  if (feeCents < 0) {
    return { amount: 0, wasNegative: true };
  }

  return { amount: feeCents / 100, wasNegative: false };
}

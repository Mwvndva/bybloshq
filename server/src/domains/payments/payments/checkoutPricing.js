// Authoritative Byblos checkout pricing/derivation (money only).
//
// Business rules (authoritative):
//   subtotal          = Σ(price × quantity)
//   serviceCharge     = ceil(subtotal × 2%)              (buyer-paid; Byblos revenue)
//   creatorCommission = round(subtotal × agreedRate)     (FULL subtotal; seller-funded)
//   sellerPayout      = subtotal − creatorCommission − 10 (KES 10 Byblos seller fee)
//   platformFee       = 10 + serviceCharge               (Byblos revenue ONLY; excludes creator commission)
//   buyerTotal        = subtotal + serviceCharge + delivery  (creator commission NOT added)
//
// Accounting invariant (must always hold):
//   buyerTotal = sellerPayout + creatorCommission + platformFee + delivery
//
// Delivery is buyer-paid and passes through to logistics; it is excluded from
// seller payout and from platform_fee_amount.
import Fees from '../../../shared/config/fees.js';

// Flat KES 10 Byblos seller fee per sale.
export const PLATFORM_SELLER_FEE = Number(Fees.PLATFORM_COMMISSION_AMOUNT) || 0;

export function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

// Buyer service charge = ceil(subtotal × 2%). Sourced from the current fees.js.
export function computeServiceCharge(subtotal) {
  return Fees.calculateProductServiceCharge(subtotal);
}

// Creator commission uses the FULL product subtotal (never subtotal − 10).
// Rate is the seller/creator agreement rate; caller supplies it.
export function computeCreatorCommission(subtotal, rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return 0;
  return roundMoney(roundMoney(subtotal) * r);
}

// Derive all authoritative money fields for an order.
// creatorCommission is supplied by the caller (from resolveAttribution).
export function deriveOrderFinancials({ subtotal, deliveryFee = 0, creatorCommission = 0 }) {
  const s = roundMoney(subtotal);
  const delivery = roundMoney(deliveryFee);
  const creatorCommissionAmount = roundMoney(creatorCommission);
  const serviceCharge = roundMoney(computeServiceCharge(s));

  // Byblos revenue only: flat seller fee + buyer service charge. Excludes the
  // seller-funded creator commission.
  const platformFee = roundMoney(PLATFORM_SELLER_FEE + serviceCharge);

  // Creator commission is deducted first (conceptually) from the seller's
  // product proceeds, then the flat KES 10 Byblos seller fee.
  const sellerPayout = roundMoney(s - creatorCommissionAmount - PLATFORM_SELLER_FEE);

  // Buyer pays product + service charge + delivery. Creator commission does NOT
  // increase the buyer's payment.
  const buyerTotal = roundMoney(s + serviceCharge + delivery);

  return {
    subtotal: s,
    serviceCharge,
    deliveryFee: delivery,
    creatorCommission: creatorCommissionAmount,
    platformFee,
    sellerPayout,
    buyerTotal,
  };
}

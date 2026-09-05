/**
 * creatorMoney.utils.js
 *
 * Pure, DB-free helpers extracted from creator.service.js so the money math
 * and fraud-matching rules that previously lived inline can be unit tested
 * without a database connection. Behavior must stay byte-for-byte identical
 * to what creator.service.js used to compute inline — these are extractions,
 * not redesigns, except where a fix comment says otherwise.
 *
 * All monetary values are handled in integer cents internally to avoid
 * floating-point rounding drift; callers get back plain KES numbers rounded
 * to 2 decimal places, matching the rest of the codebase's `roundMoney`
 * convention.
 */
import { addBusinessDays } from '../../orders/escrow/settlement.service.js';

/**
 * Round a KES amount to 2 decimal places via integer cents (no raw float math).
 * @param {number} amount
 * @returns {number}
 */
export function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Compute the creator-refers-seller reward for one order.
 *
 * FIX (audit P2-1): the reward used to be `units * rewardRatePerUnit` with no
 * ceiling. Because the platform's own commission on an order is a FLAT fee
 * (currently KES 10) applied once per order regardless of quantity, any order
 * with enough units made the "per unit" reward exceed the entire fee it was
 * supposed to be funded from (e.g. 5 units x KES 3 = KES 15 paid out of a
 * KES 10 fee — a guaranteed loss on that order's platform-fee line). The
 * reward is now capped at the flat platform fee actually collected on the
 * order, so it can never exceed its stated funding source.
 *
 * @param {object} params
 * @param {number} params.units - total quantity sold on the order (>= 1)
 * @param {number} params.rewardRatePerUnit - KES reward per unit (Fees.REFERRAL_REWARD_PER_PRODUCT)
 * @param {number} params.platformFeeAmount - flat KES platform fee collected on the order (Fees.PLATFORM_COMMISSION_AMOUNT)
 * @returns {{ amount: number, amountCents: number, uncappedAmount: number, capped: boolean }}
 */
export function computeCreatorReferralReward({ units, rewardRatePerUnit, platformFeeAmount }) {
  const safeUnits = Math.max(Number(units) || 1, 1);
  const safeRate = Number(rewardRatePerUnit) || 0;
  const safeFee = Number(platformFeeAmount) || 0;

  const uncappedAmountCents = Math.round(safeUnits * safeRate * 100);
  const platformFeeCents = Math.round(safeFee * 100);
  const amountCents = Math.min(uncappedAmountCents, platformFeeCents);

  return {
    amount: amountCents / 100,
    amountCents,
    uncappedAmount: uncappedAmountCents / 100,
    capped: amountCents < uncappedAmountCents
  };
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function phonesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // Compare the last 9 significant digits so "+254712345678", "0712345678",
  // and "712345678" all match the same real line.
  return a.length >= 9 && b.length >= 9 && a.slice(-9) === b.slice(-9);
}

/**
 * Determine whether the checking-out buyer IS the creator who owns the
 * attribution link they're checking out through (self-referral).
 *
 * RULE (authoritative, unchanged): a creator must never receive commission
 * from an order where the creator is also the buyer. This is matched on
 * five independent server-derived identity signals — any one match is
 * disqualifying:
 *   1. buyer's own creator profile id === the link's creator id
 *   2. buyer's authenticated user id === the creator's user id
 *   3. buyer's contact email === the creator's registered email
 *   4. buyer's payout phone === the creator's registered mpesa number
 *   5. the order's buyer id === the creator's own linked buyer profile id
 *      (post-hoc-only signal — see #2 below)
 *
 * Called from two places with different data freshness:
 *   - At checkout time (productCheckout.service.js), using whatever identity
 *     the request carries — this is where an unauthenticated guest checkout
 *     can still slip through if their submitted email/phone doesn't match
 *     the creator's registered ones (a known, documented limitation — see
 *     the remediation report).
 *   - Post-hoc, at escrow-release time (creator.service.js#creditCreatorForOrder),
 *     using freshly-queried DB state for both sides. This re-check exists
 *     because identity that wasn't linkable at checkout time can become
 *     linkable later — e.g. a guest buyer who checked out with a phone
 *     number that the creator's OWN long-standing buyer profile also used at
 *     some point, which signal #5 (`buyerId`/`creatorOwnBuyerId`) catches
 *     directly via the stable buyers.id relationship rather than fuzzy
 *     email/phone comparison.
 *
 * @param {object} params
 * @param {number|string|null} [params.buyerCreatorId] - the checking-out identity's OWN creator profile id, if any
 * @param {number|string|null} [params.buyerUserId] - the checking-out identity's authenticated users.id, if any
 * @param {string|null} [params.buyerEmail]
 * @param {string|null} [params.buyerPhone]
 * @param {number|string|null} [params.buyerId] - the order's resolved buyers.id, if any (post-hoc check only)
 * @param {number|string|null} [params.creatorOwnBuyerId] - the buyers.id linked to the creator's OWN user_id, if any (post-hoc check only)
 * @param {number|string} params.creatorId - the attribution link's creator id
 * @param {number|string|null} [params.creatorUserId]
 * @param {string|null} [params.creatorEmail]
 * @param {string|null} [params.creatorPhone]
 * @returns {boolean}
 */
export function isSelfReferral({
  buyerCreatorId = null,
  buyerUserId = null,
  buyerEmail = null,
  buyerPhone = null,
  buyerId = null,
  creatorOwnBuyerId = null,
  creatorId,
  creatorUserId = null,
  creatorEmail = null,
  creatorPhone = null
}) {
  const isSameCreatorId = Boolean(buyerCreatorId) && Number(buyerCreatorId) === Number(creatorId);
  const isSameUserId = Boolean(buyerUserId) && Boolean(creatorUserId) && Number(buyerUserId) === Number(creatorUserId);

  const normalizedBuyerEmail = String(buyerEmail || '').trim().toLowerCase();
  const normalizedCreatorEmail = String(creatorEmail || '').trim().toLowerCase();
  const isSameEmail = Boolean(normalizedBuyerEmail) && normalizedBuyerEmail === normalizedCreatorEmail;

  const isSamePhone = phonesMatch(normalizePhoneDigits(buyerPhone), normalizePhoneDigits(creatorPhone));

  const isSameBuyerProfile = Boolean(buyerId) && Boolean(creatorOwnBuyerId) && Number(buyerId) === Number(creatorOwnBuyerId);

  return isSameCreatorId || isSameUserId || isSameEmail || isSamePhone || isSameBuyerProfile;
}

/**
 * Fold a list of earning-like records into the same clearance shape
 * CreatorService.getCreatorClearance returns, honoring the T+2 holding
 * period AND the self-dealing review hold.
 *
 * FIX (T+2 review-hold follow-up): previously `getCreatorClearance` only
 * asked "has enough time passed?" — nothing stopped a flagged/suspicious
 * earning from clearing on schedule like any other. An earning marked
 * `flaggedForReview` now stays uncleared indefinitely (no scheduled release
 * date) regardless of elapsed time, until an admin explicitly resolves it
 * via CreatorService.resolveFlaggedEarning.
 *
 * @param {object} params
 * @param {number} params.totalBalance - creators.balance (or equivalent)
 * @param {Array<{amount:number, createdAt:Date, flaggedForReview?:boolean}>} params.earnings
 * @param {Date} [params.now]
 * @returns {{ totalBalance:number, availableBalance:number, clearingBalance:number, flaggedAmount:number, hasFlaggedHolds:boolean, nextAvailableAt:string|null, isClearing:boolean }}
 */
export function computeClearance({ totalBalance, earnings, now = new Date() }) {
  let unclearedAmount = 0;
  let flaggedAmount = 0;
  let nextAvailableAt = null;

  for (const earning of earnings) {
    const amount = Number(earning?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (earning.flaggedForReview) {
      unclearedAmount += amount;
      flaggedAmount += amount;
      continue; // held indefinitely — no scheduled release date to report
    }

    const availableTime = addBusinessDays(earning.createdAt, 2);
    if (now < availableTime) {
      unclearedAmount += amount;
      if (!nextAvailableAt || availableTime < nextAvailableAt) {
        nextAvailableAt = availableTime;
      }
    }
  }

  const safeTotalBalance = Number.isFinite(Number(totalBalance)) ? Number(totalBalance) : 0;
  const clearingBalance = Math.min(safeTotalBalance, roundMoney(unclearedAmount));
  const availableBalance = Math.max(0, roundMoney(safeTotalBalance - clearingBalance));

  return {
    totalBalance: safeTotalBalance,
    availableBalance,
    clearingBalance,
    flaggedAmount: roundMoney(flaggedAmount),
    hasFlaggedHolds: flaggedAmount > 0,
    nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
    isClearing: clearingBalance > 0
  };
}

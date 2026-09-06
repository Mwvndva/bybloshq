/**
 * creatorLimits.js — caps on how many concurrent relationships a creator may hold.
 *
 * Both count only ACTIVE relationships, so leaving one frees a slot. Existing
 * creators already above a cap are grandfathered: the cap only blocks creating
 * a NEW relationship beyond the limit, it never removes existing ones.
 */

// Max shops a creator can actively promote (active seller_creator_links).
export const MAX_ACTIVE_PROMOTIONS = 3;

// Max businesses a creator can have invited (sellers.referred_by_creator_id set).
export const MAX_ACTIVE_INVITES = 3;

export default { MAX_ACTIVE_PROMOTIONS, MAX_ACTIVE_INVITES };

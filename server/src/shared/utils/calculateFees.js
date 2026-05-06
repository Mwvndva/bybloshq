/**
 * DEPRECATED — this file is intentionally empty.
 *
 * Fee calculation is handled in:
 *   server/src/services/order.service.js → _calculateTotals()
 *
 * Seller balance/revenue updates are handled in:
 *   server/src/services/EscrowManager.js → releaseFunds()
 *
 * Do not add fee logic here. Use Fees from server/src/config/fees.js
 * directly in order.service.js if the rate needs to change.
 */

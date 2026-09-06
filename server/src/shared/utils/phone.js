/**
 * phone.js — Kenyan mobile number normalization for stored profile fields
 * (M-Pesa payout numbers, WhatsApp contact numbers).
 *
 * Mirrors the acceptance rules of payout.service.js#normalizePhoneForPayout so
 * anything we persist here is guaranteed to normalize cleanly at payout time,
 * but returns null on invalid input (for validation) instead of throwing.
 *
 * Canonical stored form is the local 10-digit `0[17]XXXXXXXX` (e.g. 0712345678),
 * matching what the payout path ultimately sends to the provider.
 */

/**
 * @param {unknown} input raw user-entered number
 * @returns {string|null} normalized `0[17]XXXXXXXX`, or null if not a valid KE mobile
 */
export function normalizeKenyanPhone(input) {
  if (input == null) return null;
  let digits = String(input).replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    digits = `0${digits.substring(3)}`;
  } else if (digits.length === 9 && /^[17]/.test(digits)) {
    digits = `0${digits}`;
  }
  // 10-digit 0[17]... is already canonical and falls through.

  return /^0[17]\d{8}$/.test(digits) ? digits : null;
}

export default { normalizeKenyanPhone };

import { z } from 'zod';

// Permissive schemas: path params are non-empty strings (always present in the
// URL, so this never false-rejects a valid request); known body fields are
// optional/loose; .passthrough() keeps every other field the controller reads.
// This adds a clean 400 for malformed input + param validation without changing
// accept/reject behavior for currently-valid traffic.
const id = z.string().min(1, 'Required path parameter is missing');
const s = z.string().optional();
const n = z.coerce.number().optional();
const anyId = z.union([z.string(), z.number()]).optional();

export const trackClick = z.object({ code: id }).passthrough();
export const register = z.object({ email: s, password: s }).passthrough();
export const login = z.object({ email: s, password: s }).passthrough();
export const resendVerification = z.object({ email: s }).passthrough();
export const acceptShopRequest = z.object({ inviteId: id }).passthrough();
export const denyShopRequest = z.object({ inviteId: id }).passthrough();
export const generateReferralCode = z.object({}).passthrough();
export const requestWithdrawal = z.object({ amount: n, mpesaNumber: s, mpesaName: s }).passthrough();

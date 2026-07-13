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

export const forgotPassword = z.object({ email: s }).passthrough();
export const resetPassword = z.object({ token: s, newPassword: s, email: s }).passthrough();
export const resendVerification = z.object({ email: s }).passthrough();
export const checkPhone = z.object({ phone: s }).passthrough();
export const saveInfo = z.object({ email: s, phone: s, fullName: s }).passthrough();
export const autoLogin = z.object({ autoLoginToken: s, token: s }).passthrough();
export const updateProfile = z.object({}).passthrough();
export const refundRequest = z.object({ amount: n }).passthrough();
export const orderCollected = z.object({ orderId: id }).passthrough();
export const becomeClient = z.object({ sellerId: id }).passthrough();
export const leaveClient = z.object({ sellerId: id }).passthrough();

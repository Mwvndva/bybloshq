import { z } from 'zod';

/**
 * Shared password-reset / forgot-password validation.
 *
 * Enforces a real SERVER-side password floor so a direct API call cannot set a
 * trivially weak password — the client-side strength meter is bypassable. 8+
 * characters matches the weakest client requirement, so it never rejects a
 * password the UI already accepted. `.passthrough()` keeps other fields the
 * controllers read.
 */
const email = z.string().trim().min(1, 'Email is required');
const strongPassword = z.string().min(8, 'Password must be at least 8 characters');

export const forgotPassword = z.object({ email }).passthrough();

export const resetPassword = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: strongPassword,
  email,
}).passthrough();

import { z } from 'zod';

/**
 * Validation schemas for Buyer Authentication
 */

export const registrationSchema = z.object({
    fullName: z.string().min(1, 'Full name is required').trim(),

    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),

    mobile_payment: z.string().min(1, 'Mobile payment number is required').trim(),

    whatsapp_number: z.string().min(1, 'WhatsApp number is required').trim(),

    city: z.string().min(1, 'City is required').trim(),

    location: z.string().min(1, 'Location is required').trim(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const loginSchema = z.object({
    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string().min(1, 'Password is required'),
});

// For backward compatibility or direct use if needed, though we prefer the new validate middleware
import { validate as validateMiddleware } from './validate.js';

export const validateRegistration = validateMiddleware(registrationSchema);
export const validateLogin = validateMiddleware(loginSchema);

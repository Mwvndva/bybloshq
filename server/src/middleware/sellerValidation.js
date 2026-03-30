import { z } from 'zod';
import { validate as validateMiddleware } from './validate.js';

/**
 * Validation schemas for Seller Authentication
 */

export const sellerRegistrationSchema = z.object({
    fullName: z.string().min(1, 'Full name is required').trim(),

    shopName: z.string()
        .min(3, 'Shop name must be at least 3 characters')
        .max(30, 'Shop name must be at most 30 characters')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Shop name can only contain letters, numbers, dots, dashes, and underscores')
        .trim(),

    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),

    whatsappNumber: z.string().min(1, 'WhatsApp number is required').trim(),

    city: z.string().min(1, 'City is required').trim(),

    location: z.string().min(1, 'Location is required').trim(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const sellerLoginSchema = z.object({
    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string().min(1, 'Password is required'),
});

export const validateSellerRegistration = validateMiddleware(sellerRegistrationSchema);
export const validateSellerLogin = validateMiddleware(sellerLoginSchema);

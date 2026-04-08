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

    mobilePayment: z.string().optional().trim(),
    mobile_payment: z.string().optional().trim(),

    whatsappNumber: z.string().optional().trim(),
    whatsapp_number: z.string().optional().trim(),

    city: z.string().min(1, 'City is required').trim(),
    location: z.string().min(1, 'Location is required').trim(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
}).refine((data) => data.mobilePayment || data.mobile_payment, {
    message: "Mobile payment number is required",
    path: ["mobile_payment"],
}).refine((data) => data.whatsappNumber || data.whatsapp_number, {
    message: "WhatsApp number is required",
    path: ["whatsapp_number"],
});

export const loginSchema = z.object({
    email: z.string().email('Please provide a valid email address').trim().toLowerCase(),

    password: z.string().min(1, 'Password is required'),
});

// For backward compatibility or direct use if needed, though we prefer the new validate middleware
import { validate as validateMiddleware } from './validate.js';

export const validateRegistration = validateMiddleware(registrationSchema);
export const validateLogin = validateMiddleware(loginSchema);

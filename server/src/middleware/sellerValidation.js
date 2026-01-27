import { body } from 'express-validator';
import { validate } from './authValidation.js';

export const validateSellerRegistration = [
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),

    body('shopName')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Shop name must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Shop name can only contain letters, numbers, dashes, and underscores'),

    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain at least one number')
        .matches(/[a-zA-Z]/)
        .withMessage('Password must contain at least one letter')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain at least one special character'),

    body('whatsappNumber')
        .trim()
        .notEmpty()
        .withMessage('WhatsApp number is required'),

    body('city')
        .trim()
        .notEmpty()
        .withMessage('City is required'),

    body('location')
        .trim()
        .notEmpty()
        .withMessage('Location is required'),

    validate,
];

export const validateSellerLogin = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    validate,
];

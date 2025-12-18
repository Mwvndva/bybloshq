import { body } from 'express-validator';
import { validate } from './authValidation.js';

export const validateOrganizerRegistration = [
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2 })
        .withMessage('Full name must be at least 2 characters long'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(?:254|\+254|0)?(7|1)\d{8}$/)
        .withMessage('Please provide a valid Kenyan phone number'),

    body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[a-zA-Z]/)
        .withMessage('Password must contain at least one letter')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain at least one special character'),

    body('passwordConfirm')
        .trim()
        .notEmpty()
        .withMessage('Please confirm your password')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),

    validate
];

export const validateOrganizerLogin = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required'),

    validate
];

export const validatePasswordUpdate = [
    body('currentPassword')
        .trim()
        .notEmpty()
        .withMessage('Current password is required'),

    body('newPassword')
        .trim()
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[a-zA-Z]/)
        .withMessage('Password must contain at least one letter')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain at least one special character')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password cannot be the same as current password');
            }
            return true;
        }),

    validate
];

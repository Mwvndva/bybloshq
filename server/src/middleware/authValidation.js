import { body, validationResult } from 'express-validator';
import AppError from '../utils/appError.js';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

export const validateRegistration = [
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),

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

    body('mobile_payment')
        .trim()
        .notEmpty()
        .withMessage('Mobile payment number is required'),

    body('whatsapp_number')
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

export const validateLogin = [
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

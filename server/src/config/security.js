/**
 * Security Configuration
 * Centralized security settings for the application
 */

export const SECURITY_CONFIG = {
    // Password Hashing (OWASP recommendation)
    BCRYPT_SALT_ROUNDS: 12,

    // JWT Configuration
    JWT_EXPIRY: '24h',
    JWT_REFRESH_EXPIRY: '7d',

    // Password Requirements
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRE_UPPERCASE: true,
    PASSWORD_REQUIRE_LOWERCASE: true,
    PASSWORD_REQUIRE_NUMBER: true,
    PASSWORD_REQUIRE_SPECIAL: false,

    // Rate Limiting & Brute Force Protection
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_ATTEMPT_WINDOW: 15 * 60 * 1000, // 15 minutes in milliseconds
    ACCOUNT_LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes

    // Session Management
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    REFRESH_TOKEN_ROTATION: true,

    // Webhook Security
    WEBHOOK_TIMESTAMP_TOLERANCE: 5 * 60 * 1000, // 5 minutes
    WEBHOOK_MAX_RETRIES: 3,

    // Payment Security
    PAYMENT_AMOUNT_TOLERANCE: 0.01, // KES 0.01 tolerance for float comparison
    PAYMENT_PENDING_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

export default SECURITY_CONFIG;

import logger from '../utils/logger.js';

/**
 * Required Environment Variables
 * Server will refuse to start if any of these are missing
 */
const REQUIRED_ENV_VARS = [
    // Database — checked separately below (accepts DATABASE_URL OR individual DB_* vars)

    // Authentication
    'JWT_SECRET',
    // NOTE: JWT_REFRESH_SECRET is intentionally NOT required here.

    // Payd Payment Gateway (core credentials — always required)
    'PAYD_USERNAME',
    'PAYD_PASSWORD',
    'PAYD_NETWORK_CODE',
    'PAYD_CHANNEL_ID',

    // Application URLs
    'FRONTEND_URL',
    'BACKEND_URL',
];

/**
 * Production-only required variables.
 * In development these emit a warning but do NOT block startup.
 * In production (NODE_ENV=production) they are fatal.
 */
const PRODUCTION_REQUIRED_ENV_VARS = [
    // Needed to receive Payd webhook callbacks
    'PAYD_CALLBACK_URL',
    // Needed to encrypt/decrypt .bybx digital product files
    'DRM_MASTER_KEY',
    // Cloudinary (image uploads)
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    // CSRF Protection
    'CSRF_SECRET',
];

/**
 * Validate DRM_MASTER_KEY format (64 hex characters = 32 bytes)
 */
function validateDrmKey() {
    if (process.env.DRM_MASTER_KEY) {
        const hexRegex = /^[0-9a-fA-F]{64}$/;
        if (!hexRegex.test(process.env.DRM_MASTER_KEY)) {
            console.error('❌ CRITICAL: DRM_MASTER_KEY must be a 64-character hex string (32 bytes)');
            console.error('   Generate with: openssl rand -hex 32');
            process.exit(1);
        }
        console.log('✅ DRM: Master key format validated (64 hex chars)');
    }
}

/**
 * Optional Environment Variables
 * Application will work without these but with reduced functionality
 */
const OPTIONAL_ENV_VARS = [
    // Redis — token blacklist falls back to in-memory if not set
    'REDIS_URL',
    // Email — warn only if NONE of the email vars are configured
    // (checked separately below with smarter logic)
];

/**
 * Validate Environment Variables
 * Called on server startup to ensure all required configuration is present
 */
export function validateEnvironment() {
    console.log('\n🔍 Validating environment configuration...\n');
    validateDrmKey();

    // ── Database: accept either DATABASE_URL or individual DB_* vars ──────────
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDbParts = !!(process.env.DB_HOST && process.env.DB_USER &&
        process.env.DB_PASSWORD && process.env.DB_NAME);

    if (!hasDbUrl && !hasDbParts) {
        console.error('❌ CRITICAL: No database configuration found.');
        console.error('   Provide either DATABASE_URL, or all of: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
        process.exit(1);
    }

    if (hasDbUrl) {
        console.log('✅ Database: using DATABASE_URL');
    } else {
        console.log(`✅ Database: using DB_HOST=${process.env.DB_HOST} DB_NAME=${process.env.DB_NAME}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check for missing always-required variables
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missing.forEach(v => console.error(`   - ${v}`));
        console.error('\n📝 Please check .env.example for required configuration');
        console.error('Application cannot start safely. Exiting...\n');
        process.exit(1);
    }

    // Production-only required variables
    const isProduction = process.env.NODE_ENV === 'production';
    const missingProd = PRODUCTION_REQUIRED_ENV_VARS.filter(v => !process.env[v]);

    if (missingProd.length > 0) {
        if (isProduction) {
            console.error('❌ CRITICAL: Missing production-required environment variables:');
            missingProd.forEach(v => console.error(`   - ${v}`));
            console.error('\nApplication cannot start in production without these. Exiting...\n');
            process.exit(1);
        } else {
            console.warn('⚠️  WARNING: Missing production-required variables (non-fatal in development):');
            missingProd.forEach(v => console.warn(`   - ${v}`));
            console.warn('   Payments, image uploads, and DRM will not work until these are set.\n');
        }
    }

    // Validate JWT_SECRET strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ CRITICAL: JWT_SECRET must be at least 32 characters');
        console.error('   Current length:', process.env.JWT_SECRET.length);
        console.error('   Generate with: openssl rand -base64 64');
        console.error('   Or use: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"');
        process.exit(1);
    }

    // Validate JWT_REFRESH_SECRET strength
    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
        console.error('❌ CRITICAL: JWT_REFRESH_SECRET must be at least 32 characters');
        console.error('   Generate with: openssl rand -base64 64');
        process.exit(1);
    }

    // PAYD_ALLOWED_IPS is optional — Payd doesn't publish fixed server IPs.
    // Set to 'skip' or '*' to explicitly bypass IP checking, or provide a
    // comma-separated list of IPs if Payd does provide them in your region.
    if (process.env.PAYD_ALLOWED_IPS) {
        const val = process.env.PAYD_ALLOWED_IPS.trim().toLowerCase();
        if (val === 'skip' || val === '*') {
            console.log('ℹ️  Payd webhook IP check: DISABLED (set PAYD_ALLOWED_IPS to a comma-separated IP list to enable)');
        } else {
            const ips = process.env.PAYD_ALLOWED_IPS.split(',').map(ip => ip.trim()).filter(Boolean);
            console.log(`✅ Payd webhook IP whitelist: ${ips.length} IP(s) configured`);
        }
    } else {
        console.log('ℹ️  PAYD_ALLOWED_IPS not set — webhook IP filtering disabled. Set to "skip" to suppress this message.');
    }

    // Validate URLs
    const urls = ['FRONTEND_URL', 'BACKEND_URL', 'PAYD_CALLBACK_URL'];
    urls.forEach(urlVar => {
        if (process.env[urlVar]) {
            if (!process.env[urlVar].startsWith('http://') && !process.env[urlVar].startsWith('https://')) {
                console.error(`❌ CRITICAL: ${urlVar} must start with http:// or https://`);
                console.error(`   Current value: ${process.env[urlVar]}`);
                process.exit(1);
            }
        }
    });

    // Validate DATABASE_URL format
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
        console.error('❌ CRITICAL: DATABASE_URL must be a valid PostgreSQL connection string');
        console.error('   Format: postgresql://user:password@host:port/database');
        process.exit(1);
    }

    // Warn about missing optional variables in production
    const missingOptional = OPTIONAL_ENV_VARS.filter(v => !process.env[v]);
    if (missingOptional.length > 0 && process.env.NODE_ENV === 'production') {
        console.warn('\n⚠️  WARNING: Missing optional environment variables:');
        missingOptional.forEach(v => console.warn(`   - ${v}`));
        console.warn('Some features may not work as expected.\n');
    }

    // Smarter email check — accept EMAIL_* (Hostinger) or SMTP_* naming
    const hasEmail = !!(process.env.EMAIL_HOST || process.env.SMTP_HOST);
    if (!hasEmail) {
        console.warn('⚠️  Email: Not configured (EMAIL_HOST or SMTP_HOST required for email notifications)');
    } else {
        console.log(`✅ Email: configured via ${process.env.EMAIL_HOST ? 'EMAIL_HOST' : 'SMTP_HOST'}`);
    }

    // Log successful validation
    console.log('✅ Environment validation passed');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`🔗 Backend URL: ${process.env.BACKEND_URL}`);
    console.log(`💳 Payment Provider: Payd (M-Pesa)`);

    if (process.env.REDIS_URL) {
        console.log('🔴 Redis: Configured (token blacklist enabled)');
    } else {
        console.warn('⚠️  Redis: Not configured (token blacklist disabled)');
    }

    console.log('');
}

export default validateEnvironment;

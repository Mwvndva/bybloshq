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
    // refreshToken.js uses JWT_SECRET. If you add a true refresh-token flow
    // that uses a separate secret, move JWT_REFRESH_SECRET back to REQUIRED.

    // Payd Payment Gateway
    'PAYD_USERNAME',
    'PAYD_PASSWORD',
    'PAYD_NETWORK_CODE',
    'PAYD_CHANNEL_ID',
    'PAYD_CALLBACK_URL',
    // NOTE: PAYD_WEBHOOK_SECRET not required (Payd doesn't provide it)

    // Payd Security (IP Whitelisting - CRITICAL)
    'PAYD_ALLOWED_IPS',

    // Cloudinary
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',

    // Application URLs
    'FRONTEND_URL',
    'BACKEND_URL',

    // DRM & Security
    'DRM_MASTER_KEY'
];

/**
 * Optional Environment Variables
 * Application will work without these but with reduced functionality
 */
const OPTIONAL_ENV_VARS = [
    'REDIS_URL',
    'JWT_REFRESH_SECRET',  // Optional until a dedicated refresh-token service uses it
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'EMAIL_FROM',
    'SENTRY_DSN',
    'PREVIEW_DOMAINS',
    'CORS_ORIGIN',
    'PAYD_CA_CERT_PATH'
];

/**
 * Validate Environment Variables
 * Called on server startup to ensure all required configuration is present
 */
export function validateEnvironment() {
    console.log('\n🔍 Validating environment configuration...\n');

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

    // Check for missing required variables
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missing.forEach(v => console.error(`   - ${v}`));
        console.error('\n📝 Please check .env.example for required configuration');
        console.error('Application cannot start safely. Exiting...\n');
        process.exit(1);
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

    // Validate PAYD_ALLOWED_IPS format
    if (process.env.PAYD_ALLOWED_IPS) {
        const ips = process.env.PAYD_ALLOWED_IPS.split(',').map(ip => ip.trim());
        if (ips.length === 0 || ips.some(ip => !ip)) {
            console.error('❌ CRITICAL: PAYD_ALLOWED_IPS must contain valid IP addresses');
            console.error('   Format: ip1,ip2,ip3 (comma-separated)');
            console.error('   Example: 41.90.x.x,197.248.x.x,105.163.x.x');
            console.error('\n⚠️  Contact Payd support to get official webhook IP addresses');
            console.error('   Email: support@mypayd.app');
            process.exit(1);
        }
        console.log(`✅ Payd IP whitelist configured: ${ips.length} IP(s)`);
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

const REQUIRED_ENV_VARS = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL',
    'NODE_ENV',
    'EMAIL_FROM_EMAIL',
    'MARKETING_EMAIL'
];


const PRODUCTION_REQUIRED_ENV_VARS = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_PUBLIC_KEY',
    'PAYSTACK_BASE_URL',
    'PAYSTACK_WEBHOOK_IPS',
    'PAYSTACK_PAYMENT_CALLBACK_URL',
    'PAYSTACK_PAYOUT_CALLBACK_URL'
];

const SUPPORTED_PAYMENT_PROVIDERS = ['paystack'];
const SUPPORTED_PAYOUT_PROVIDERS = ['paystack'];

function normalizedProvider(name, fallback) {
    return (process.env[name] || fallback).trim().toLowerCase();
}

const OPTIONAL_ENV_VARS = [
    'REDIS_URL',
    'ALLOWED_ORIGINS',
    'COURIER_WHATSAPP_NUMBER',
    'DROPOFF_LOCATION',
    'LOGISTICS_HUB_LABEL',
    'LOGISTICS_HUB_ADDRESS',
    'LOGISTICS_HUB_LATITUDE',
    'LOGISTICS_HUB_LONGITUDE',
    'LOGISTICS_RATE_KES_PER_KM'
];

export function validateEnvironment() {
    console.log('\nValidating environment configuration...\n');

    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDbParts = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME);

    if (!hasDbUrl && !hasDbParts) {
        console.error('CRITICAL: No database configuration found.');
        console.error('Provide either DATABASE_URL, or all of: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
        process.exit(1);
    }

    const paymentProvider = normalizedProvider('PAYMENT_PROVIDER', 'paystack');
    const payoutProvider = normalizedProvider('PAYOUT_PROVIDER', 'paystack');

    if (!SUPPORTED_PAYMENT_PROVIDERS.includes(paymentProvider)) {
        console.error(`CRITICAL: PAYMENT_PROVIDER must be one of: ${SUPPORTED_PAYMENT_PROVIDERS.join(', ')}`);
        console.error(`Current value: ${process.env.PAYMENT_PROVIDER}`);
        process.exit(1);
    }

    if (!SUPPORTED_PAYOUT_PROVIDERS.includes(payoutProvider)) {
        console.error(`CRITICAL: PAYOUT_PROVIDER must be one of: ${SUPPORTED_PAYOUT_PROVIDERS.join(', ')}`);
        console.error(`Current value: ${process.env.PAYOUT_PROVIDER}`);
        process.exit(1);
    }

    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error('CRITICAL: Missing required environment variables:');
        missing.forEach(v => console.error(`- ${v}`));
        process.exit(1);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const missingProd = PRODUCTION_REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missingProd.length > 0) {
        if (isProduction) {
            console.error('CRITICAL: Missing production-required environment variables:');
            missingProd.forEach(v => console.error(`- ${v}`));
            process.exit(1);
        }
        console.warn('WARNING: Missing production-required variables:');
        missingProd.forEach(v => console.warn(`- ${v}`));
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('CRITICAL: JWT_SECRET must be at least 32 characters');
        process.exit(1);
    }

    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
        console.error('CRITICAL: JWT_REFRESH_SECRET must be at least 32 characters');
        process.exit(1);
    }

    const urls = [
        'FRONTEND_URL',
        'BACKEND_URL',
    'PAYSTACK_BASE_URL',
    'PAYSTACK_WEBHOOK_URL',
    'PAYSTACK_PAYMENT_CALLBACK_URL',
    'PAYSTACK_PAYOUT_CALLBACK_URL'
    ];

    urls.forEach(urlVar => {
        if (process.env[urlVar] && !process.env[urlVar].startsWith('http://') && !process.env[urlVar].startsWith('https://')) {
            console.error(`CRITICAL: ${urlVar} must start with http:// or https://`);
            process.exit(1);
        }
    });

    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
        console.error('CRITICAL: DATABASE_URL must be a valid PostgreSQL connection string');
        process.exit(1);
    }

    if (process.env.PAYSTACK_WEBHOOK_IPS) {
        const ips = process.env.PAYSTACK_WEBHOOK_IPS.split(',').map(ip => ip.trim()).filter(Boolean);
        console.log(`Paystack webhook IP whitelist: ${ips.length} IP(s) configured`);
    } else {
        console.warn('PAYSTACK_WEBHOOK_IPS not set. Paystack webhooks fail closed in production.');
    }

    const missingOptional = OPTIONAL_ENV_VARS.filter(v => !process.env[v]);
    if (missingOptional.length > 0 && isProduction) {
        console.warn('\nWARNING: Missing optional environment variables:');
        missingOptional.forEach(v => console.warn(`- ${v}`));
    }

    const hasEmail = !!(process.env.EMAIL_HOST || process.env.SMTP_HOST);
    if (!hasEmail) {
        if (isProduction) {
            console.error('CRITICAL: EMAIL_HOST or SMTP_HOST must be set in production');
            process.exit(1);
        }
        console.warn('Email is not configured (EMAIL_HOST or SMTP_HOST required for email notifications)');
    } else {
        console.log(`Email configured via ${process.env.EMAIL_HOST ? 'EMAIL_HOST' : 'SMTP_HOST'}`);
    }

    console.log('Environment validation passed');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`Backend URL: ${process.env.BACKEND_URL}`);
    console.log(`Payment Provider: ${paymentProvider} (M-Pesa)`);
    console.log(`Payout Provider: ${payoutProvider}`);
    console.log(`Courier WhatsApp: ${process.env.COURIER_WHATSAPP_NUMBER || '0748137819'}`);
    console.log(process.env.REDIS_URL ? 'Redis: Configured' : 'Redis: Not configured');
    console.log('');
}

export default validateEnvironment;

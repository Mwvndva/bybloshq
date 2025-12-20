import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server root if it exists
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

async function verifyEmailConfig() {
    console.log('=== Email Configuration Verification ===');

    const config = {
        host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
        port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
        user: process.env.EMAIL_USERNAME || process.env.SMTP_USER,
        pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS,
        fromEmail: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER,
        fromName: process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Byblos'
    };

    console.log('Detected Config (including fallbacks):', {
        host: config.host || 'MISSING',
        port: config.port || 'MISSING',
        user: config.user || 'MISSING',
        fromEmail: config.fromEmail || 'MISSING',
        fromName: config.fromName || 'MISSING',
        hasPassword: !!config.pass
    });

    const missingFields = ['host', 'port', 'user', 'pass', 'fromEmail'].filter(field => !config[field]);
    if (missingFields.length > 0) {
        console.error('❌ Missing required fields:', missingFields.join(', '));
        return;
    }

    console.log('\nTesting SMTP connection...');
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port, 10),
        secure: process.env.EMAIL_SECURE === 'true' || parseInt(config.port, 10) === 465,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        timeout: 10000
    });

    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully!');
    } catch (error) {
        console.error('❌ SMTP connection failed:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Command:', error.command);
    }
}

verifyEmailConfig();

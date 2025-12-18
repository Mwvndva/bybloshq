import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendPaymentConfirmationEmail } from '../src/utils/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server root
dotenv.config({ path: join(__dirname, '../.env') });

async function testEmail() {
    console.log('Starting Email Test...');
    console.log('SMTP Config:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USERNAME,
        from: process.env.EMAIL_FROM_EMAIL
    });

    const testData = {
        ticketNumber: 'TEST-123456',
        ticketType: 'VIP Ticket',
        eventName: 'Test Event - Byblos',
        eventDate: 'December 30, 2025',
        eventLocation: 'Test Venue, Nairobi',
        customerName: 'Test User',
        amount: 1000.00,
        quantity: 1,
        reference: 'REF-TEST-001',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    };

    try {
        console.log('Attempting to send email...');
        await sendPaymentConfirmationEmail('official@bybloshq.space', testData);
        console.log('✅ Email sent successfully!');
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        console.error('Error stack:', error.stack);
    }
}

testEmail();

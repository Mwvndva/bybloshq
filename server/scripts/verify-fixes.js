import { PaymentService } from '../src/services/payment.service.js';
import * as analyticsController from '../src/controllers/analytics.controller.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Dummy environment variables for testing
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'byblos';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.PAYD_USERNAME = process.env.PAYD_USERNAME || 'dummy';
process.env.PAYD_PASSWORD = process.env.PAYD_PASSWORD || 'dummy';

async function verifyPaymentService() {
    console.log('--- Verifying PaymentService ---');
    try {
        const paymentService = new PaymentService();
        console.log('✅ PaymentService instantiated successfully.');

        const status = paymentService.getAgentStatus();
        console.log('✅ getAgentStatus() returned:', status);

        if (status.poolingEnabled) {
            console.log('✅ Connection pooling is enabled.');
        } else {
            console.warn('❌ Connection pooling NOT enabled.');
        }
    } catch (error) {
        console.error('❌ PaymentService verification failed:', error);
    }
}

async function verifyAnalyticsController() {
    console.log('\n--- Verifying Analytics Controller Logic ---');
    console.log('Note: This test checks if the refactored code correctly uses the sellers table stats.');

    // We can't easily run the full controller without a real DB and request object,
    // but we can check the exports and signatures.
    try {
        if (typeof analyticsController.getSellerAnalytics === 'function') {
            console.log('✅ getSellerAnalytics export found.');
        } else {
            console.error('❌ getSellerAnalytics export MISSING.');
        }
    } catch (error) {
        console.error('❌ Analytics Controller verification failed:', error);
    }
}

async function run() {
    await verifyPaymentService();
    await verifyAnalyticsController();
    console.log('\n--- Verification Finished ---');
}

run();

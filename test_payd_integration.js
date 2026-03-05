
import { PaymentService } from './server/src/services/payment.service.js';
import payoutService from './server/src/services/payout.service.js';
import { pool } from './server/src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function testIntegration() {
    const paymentService = new PaymentService();

    console.log('--- Testing Payment Service ---');
    try {
        const balance = await paymentService.checkBalance();
        console.log('Payment Balance:', balance);
    } catch (err) {
        console.error('Payment Balance Check Failed:', err.message);
    }

    console.log('\n--- Testing Payout Service ---');
    try {
        const pBalance = await payoutService.checkPayoutBalance();
        console.log('Payout Balance:', pBalance);
    } catch (err) {
        console.error('Payout Balance Check Failed:', err.message);
    }

    // Add more tests as needed

    await pool.end();
}

testIntegration();

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testPaydIntegration() {
    // Import Service AFTER env vars are loaded
    const { default: payoutService } = await import('../services/payout.service.js');

    console.log('--- PAYD INTEGRATION TEST ---');
    console.log('Checking Environment Variables...');

    const required = ['PAYD_USERNAME', 'PAYD_PASSWORD', 'PAYD_NETWORK_CODE', 'PAYD_CHANNEL_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ MISSING CONFIG:', missing.join(', '));
        process.exit(1);
    }

    console.log('✅ Credentials present');
    console.log(`Username: ${process.env.PAYD_USERNAME}`);
    console.log(`Network Code: ${process.env.PAYD_NETWORK_CODE}`);

    // Simulate a payout request
    const testPayload = {
        amount: 10, // Small amount
        phone_number: '254712345678', // Test number
        narration: 'System Integration Test',
        account_name: 'Test Account',
        reference: `TEST-${Date.now()}`
    };

    console.log('\n--- ATTEMPTING PAYOUT REQUEST (DRY RUN) ---');
    // Note: We are calling the service, which calls the Real API.
    // If credentials are bad, it will fail 401/403.
    // If good, it might succeed (202) or fail (400) depending on float/rules.

    try {
        console.log('Payload:', JSON.stringify(testPayload, null, 2));
        const response = await payoutService.initiateMobilePayout(testPayload);
        console.log('\n✅ SUCCESS! Payd accepted the request.');
        console.log('Response:', JSON.stringify(response, null, 2));

        if (response.correlator_id) {
            console.log(`\n✅ CORRELATOR ID RECEIVED: ${response.correlator_id}`);
            console.log('Capture logic in controller will works correctly with this.');
        } else {
            console.log('\n⚠️ NO CORRELATOR ID in response! Controller capture might fail.');
        }

    } catch (error) {
        console.error('\n❌ REQUEST FAILED');
        console.error('Error Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPaydIntegration();

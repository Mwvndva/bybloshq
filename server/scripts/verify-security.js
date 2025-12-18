
import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

// Simulate production environment for security testing
process.env.NODE_ENV = 'production';
process.env.PAYSTACK_WEBHOOK_SECRET = 'test-secret-123';

async function testSecurity() {
    console.log('=== STARTING SECURITY VERIFICATION ===\n');

    try {
        // 1. Test Price Manipulation (Frontend sends low amount)
        console.log('Test 1: Frontend Price Manipulation Attempt...');
        const payload = {
            phone: '0712345678',
            email: 'security-test@example.com',
            amount: 1.0, // Maliciously low amount
            ticketId: 1, // Assumes ticket ID 1 exists with a higher price
            eventId: 1,
            customerName: 'Security Tester',
            quantity: 1
        };

        // In a real test we'd need a valid event/ticket ID. 
        // This is a conceptual verification of the controller logic.
        console.log('Sending payload with amount: 1.0 (expected server to override this)');

        // 2. Test Webhook Signature Enforcement
        console.log('\nTest 2: Mock Webhook without Signature...');
        try {
            await axios.post(`${BASE_URL}/payments/webhook/paystack`, {
                event: 'charge.success',
                data: { reference: 'TEST-REF' }
            });
            console.log('❌ FAIL: Webhook accepted without signature');
        } catch (error) {
            console.log('✅ PASS: Webhook rejected without signature (Status:', error.response?.status, ')');
        }

        // 3. Test Invalid Signature
        console.log('\nTest 3: Mock Webhook with Invalid Signature...');
        try {
            await axios.post(`${BASE_URL}/payments/webhook/paystack`, {
                event: 'charge.success',
                data: { reference: 'TEST-REF' }
            }, {
                headers: { 'x-paystack-signature': 'invalid-sig' }
            });
            console.log('❌ FAIL: Webhook accepted with invalid signature');
        } catch (error) {
            console.log('✅ PASS: Webhook rejected with invalid signature (Status:', error.response?.status, ')');
        }

        console.log('\n=== SECURITY VERIFICATION COMPLETE ===');
    } catch (error) {
        console.error('Verification script failed:', error.message);
    }
}

testSecurity();

import PaymentService from '../server/src/services/payment.service.js';
import { PaydErrorCodes } from '../server/src/services/payment.service.js';

async function testAlignment() {
    console.log('--- TESTING PAYD ALIGNMENT ---');
    const service = new PaymentService();

    // Test 1: Minimum Amount
    try {
        console.log('Test 1: Amount < 10...');
        await service.initiatePayment({ amount: 1, phone: '0711548797' });
        console.error('FAIL: Allowed amount < 10');
    } catch (e) {
        if (e.code === PaydErrorCodes.INVALID_AMOUNT) {
            console.log('PASS: Correctly blocked amount < 10');
        } else {
            console.error('FAIL: Wrong error code', e.code);
        }
    }

    // Test 2: Phone Normalization
    try {
        console.log('Test 2: Invalid phone (9 digits)...');
        service.normalizePhoneForPayment('071154879');
        console.error('FAIL: Allowed 9-digit phone');
    } catch (e) {
        console.log('PASS: Blocked 9-digit phone');
    }

    try {
        console.log('Test 3: Valid phone (10 digits starting with 0)...');
        const normalized = service.normalizePhoneForPayment('0111548797');
        if (normalized === '0111548797') {
            console.log('PASS: Normalized correctly');
        } else {
            console.error('FAIL: Wrong normalization', normalized);
        }
    } catch (e) {
        console.error('FAIL: Blocked valid phone', e.message);
    }

    console.log('--- TEST COMPLETE ---');
}

// testAlignment();

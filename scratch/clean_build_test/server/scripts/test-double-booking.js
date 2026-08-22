/**
 * Double Booking Prevention Test
 * Tests that concurrent service bookings for the same slot are handled correctly.
 * 
 * Usage: node server/scripts/test-double-booking.js
 * 
 * Prerequisites:
 * - Server must be running on localhost:3002
 * - Must have a valid seller auth token
 * - Must have a service product ID
 * 
 * Set these env vars or edit directly below:
 * TEST_SELLER_TOKEN=your_jwt_here
 * TEST_PRODUCT_ID=123
 * TEST_PHONE=0712345678
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const PRODUCT_ID = process.env.TEST_PRODUCT_ID || '1'; // Change to a real service product ID
const BOOKING_DATE = '2026-05-15'; // A future date
const BOOKING_TIME = '10:00';
const TEST_PHONE = process.env.TEST_PHONE || '0712345678';
const TEST_EMAIL = 'test-double-book@test.com';

const makePayload = (index) => ({
    phone: TEST_PHONE,
    email: `buyer${index}@test.com`,
    amount: 100,
    productId: PRODUCT_ID,
    productName: 'Test Service',
    customerName: `Test Buyer ${index}`,
    metadata: {
        product_type: 'service',
        booking_date: BOOKING_DATE,
        booking_time: BOOKING_TIME,
        product_id: PRODUCT_ID,
        items: [{
            productId: PRODUCT_ID,
            name: 'Test Service',
            price: 100,
            quantity: 1,
            subtotal: 100,
            productType: 'service'
        }]
    },
    buyerLocation: {
        lat: -1.2921,
        lng: 36.8219,
        address: 'Test Location, Nairobi'
    }
});

async function initiatePayment(index) {
    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/api/payments/initiate-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': 'skip', // Bypass CSRF for test
            },
            body: JSON.stringify(makePayload(index)),
        });

        const data = await res.json();
        const duration = Date.now() - start;

        return {
            index,
            success: res.ok && data.status === 'success',
            status: res.status,
            orderNumber: data.data?.orderNumber,
            error: data.message || data.error,
            duration: `${duration}ms`
        };
    } catch (err) {
        return { index, success: false, error: err.message, duration: `${Date.now() - start}ms` };
    }
}

async function checkSlotAvailability() {
    const res = await fetch(
        `${BASE_URL}/api/public/services/${PRODUCT_ID}/availability?date=${BOOKING_DATE}`
    );
    const data = await res.json();
    return data.data?.unavailableSlots || [];
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('DOUBLE BOOKING PREVENTION TEST');
    console.log('='.repeat(60));
    console.log(`Target: ${BASE_URL}`);
    console.log(`Product ID: ${PRODUCT_ID}`);
    console.log(`Slot: ${BOOKING_DATE} at ${BOOKING_TIME}`);
    console.log('');

    // Test 1: Check initial availability
    console.log('1. Checking initial slot availability...');
    const beforeSlots = await checkSlotAvailability();
    const slotAlreadyTaken = beforeSlots.some(s => {
        const slotTime = new Date(s);
        return slotTime.getHours() === parseInt(BOOKING_TIME.split(':')[0]);
    });

    if (slotAlreadyTaken) {
        console.log(`   ⚠️  Slot ${BOOKING_TIME} is already booked. Change BOOKING_DATE/TIME.`);
        return;
    }
    console.log(`   ✅ Slot ${BOOKING_TIME} is available`);
    console.log('');

    // Test 2: Fire 3 concurrent booking attempts
    console.log('2. Firing 3 CONCURRENT booking attempts for the same slot...');
    const results = await Promise.allSettled([
        initiatePayment(1),
        initiatePayment(2),
        initiatePayment(3),
    ]);

    const outcomes = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message });

    console.log('');
    console.log('   Results:');
    outcomes.forEach(r => {
        const icon = r.success ? '✅' : '❌';
        console.log(`   ${icon} Request #${r.index}: ${r.success ? `Order ${r.orderNumber}` : r.error} (${r.duration})`);
    });

    const successCount = outcomes.filter(r => r.success).length;
    const failCount = outcomes.filter(r => !r.success).length;

    console.log('');
    console.log(`   Summary: ${successCount} succeeded, ${failCount} rejected`);

    if (successCount === 1) {
        console.log('   🎉 PASS: Exactly 1 booking succeeded. Double booking prevented!');
    } else if (successCount === 0) {
        console.log('   ⚠️  WARN: All bookings failed. Check server logs for errors.');
    } else {
        console.log(`   ❌ FAIL: ${successCount} bookings succeeded for the same slot!`);
        console.log('      Double booking prevention is NOT working correctly.');
    }

    console.log('');

    // Test 3: Check availability after booking
    console.log('3. Checking slot availability after booking...');
    const afterSlots = await checkSlotAvailability();
    const slotNowTaken = afterSlots.length > beforeSlots.length;

    if (slotNowTaken) {
        console.log(`   ✅ Slot correctly marked as unavailable after booking`);
    } else {
        console.log(`   ❌ Slot not marked as unavailable — availability endpoint may have an issue`);
    }

    console.log('');

    // Test 4: Sequential attempt on same slot
    console.log('4. Testing sequential attempt on now-booked slot...');
    const sequentialResult = await initiatePayment(99);
    if (!sequentialResult.success) {
        console.log(`   ✅ PASS: Sequential booking correctly rejected: "${sequentialResult.error}"`);
    } else {
        console.log(`   ❌ FAIL: Sequential booking on taken slot succeeded! Order: ${sequentialResult.orderNumber}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
}

runTest().catch(console.error);


import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import service dynamically
const { pool } = await import('../src/config/database.js');
const { default: paymentService } = await import('../src/services/payment.service.js');

async function testPayoutWebhook() {
    const client = await pool.connect();
    let sellerId;
    let withdrawalId;

    try {
        console.log('=== STARTING PAYOUT WEBHOOK TEST ===');

        // 1. Setup Seller
        const sRes = await client.query(`
      INSERT INTO sellers (full_name, email, password, shop_name, phone, balance)
      VALUES ('Webhook Test', 'webhook_' || EXTRACT(EPOCH FROM NOW()) || '@test.com', 'hash', 'Shop Webhook ' || EXTRACT(EPOCH FROM NOW()), '254700000001', 1000)
      RETURNING id, balance
    `);
        sellerId = sRes.rows[0].id;

        // 2. Create Withdrawal Request (Processing) - simulating what Controller does
        // Deduct balance first
        await client.query('UPDATE sellers SET balance = balance - 500 WHERE id = $1', [sellerId]);

        // Insert request with a fake provider ref
        const ref = `py_test_${Date.now()}`;
        const wRes = await client.query(`
      INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, provider_reference, created_at)
      VALUES ($1, 500, '254700000001', 'Test User', 'processing', $2, NOW())
      RETURNING id
    `, [sellerId, ref]);
        withdrawalId = wRes.rows[0].id;

        console.log(`Created Withdrawal ${withdrawalId} with Ref ${ref}. Seller Balance: 500`);

        // 3. Test FAILURE Webhook (Refund Scenario)
        console.log('--- Testing FAILURE Webhook ---');
        await paymentService.handlePaydCallback({
            transaction_reference: ref,
            result_code: 1, // Failure
            status: 'FAILED',
            remarks: 'Simulated Failure'
        });

        const failCheck = await client.query('SELECT status FROM withdrawal_requests WHERE id = $1', [withdrawalId]);
        const balanceCheck = await client.query('SELECT balance FROM sellers WHERE id = $1', [sellerId]);

        console.log(`Status: ${failCheck.rows[0].status} (Expected: failed)`);
        console.log(`Balance: ${balanceCheck.rows[0].balance} (Expected: 1000)`);

        if (failCheck.rows[0].status !== 'failed' || parseFloat(balanceCheck.rows[0].balance) !== 1000) {
            throw new Error('Failure/Refund Test FAILED');
        }

        // 4. Test SUCCESS Webhook
        // Reset to processing for testing success
        const ref2 = `py_test_success_${Date.now()}`;
        await client.query('UPDATE sellers SET balance = balance - 500 WHERE id = $1', [sellerId]); // Deduct again
        const wRes2 = await client.query(`
      INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, provider_reference, created_at)
      VALUES ($1, 500, '254700000001', 'Test User', 'processing', $2, NOW())
      RETURNING id
    `, [sellerId, ref2]);
        const withdrawalId2 = wRes2.rows[0].id;

        console.log('--- Testing SUCCESS Webhook ---');
        await paymentService.handlePaydCallback({
            transaction_reference: ref2,
            result_code: 0, // Success
            status: 'SUCCESS',
            amount: 500
        });

        const successCheck = await client.query('SELECT status FROM withdrawal_requests WHERE id = $1', [withdrawalId2]);
        const balanceCheck2 = await client.query('SELECT balance FROM sellers WHERE id = $1', [sellerId]);

        console.log(`Status: ${successCheck.rows[0].status} (Expected: completed)`);
        console.log(`Balance: ${balanceCheck2.rows[0].balance} (Expected: 500)`); // Should remain deducted

        if (successCheck.rows[0].status !== 'completed' || parseFloat(balanceCheck2.rows[0].balance) !== 500) {
            throw new Error('Success Test FAILED');
        }

        console.log('ALL TESTS PASSED');

    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    } finally {
        if (sellerId) {
            await client.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]);
            await client.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
        }
        client.release();
        await pool.end();
    }
}

testPayoutWebhook();

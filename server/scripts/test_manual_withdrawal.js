import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../.env');
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('.env loaded successfully. DB_PORT:', process.env.DB_PORT);
}

// Import database AFTER env vars are loaded - Dynamic import to avoid hoisting
const { pool } = await import('../src/config/database.js');

// Mock Payout Service logic for testing DB transaction
// Real PayoutService is imported in controller, but here we can just test the DB logic 
// OR we can test the full flow if we import the controller. 
// Since we want to test "Manual Payout Implementation", testing the DB logic + Payout Service call is best.
// But we can't easily mock the import inside the controller from an external script without proxying.
// SO, we will replicate the logic to verify atomic behavior.

async function testManualWithdrawal() {
    const client = await pool.connect();
    let sellerId;

    try {
        console.log('=== STARTING MANUAL WITHDRAWAL TEST ===');

        // 1. Create Test Seller
        const setupRes = await client.query(`
      INSERT INTO sellers (full_name, email, password, shop_name, phone, balance)
      VALUES ('Test Withdrawal Seller', 'withdraw_test_' || EXTRACT(EPOCH FROM NOW()) || '@test.com', 'hash', 'Shop ' || EXTRACT(EPOCH FROM NOW()), '254700000000', 5000)
      RETURNING id, balance
    `);
        sellerId = setupRes.rows[0].id;
        console.log(`Created Seller ${sellerId} with Balance: ${setupRes.rows[0].balance}`);

        // 2. Perform Withdrawal Logic (Replicating controller flow to verify DB constraints)
        await client.query('BEGIN');

        const amount = 1000;

        // Lock row
        const balanceRes = await client.query('SELECT balance FROM sellers WHERE id = $1 FOR UPDATE', [sellerId]);
        const currentBalance = parseFloat(balanceRes.rows[0].balance);

        if (currentBalance < amount) {
            throw new Error('Insufficient funds (Test Failed)');
        }

        // Deduct
        await client.query('UPDATE sellers SET balance = balance - $1 WHERE id = $2', [amount, sellerId]);
        console.log(`Deducted ${amount} from balance.`);

        // Create Request
        const reqRes = await client.query(`
       INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, created_at)
       VALUES ($1, $2, $3, $4, 'processing', NOW())
       RETURNING id
    `, [sellerId, amount, '254700000000', 'Test Name']);

        console.log(`Created Withdrawal Request ${reqRes.rows[0].id}`);

        // COMMIT Transaction (Simulating successful Payout init)
        await client.query('COMMIT');

        // 3. Verify Final State
        const finalRes = await client.query('SELECT balance FROM sellers WHERE id = $1', [sellerId]);
        const finalBalance = parseFloat(finalRes.rows[0].balance);

        console.log(`Final Balance: ${finalBalance} (Expected: 4000)`);

        if (finalBalance === 4000) {
            console.log('SUCCESS: Balance correctly deducted.');
        } else {
            console.error('FAILURE: Balance mismatch.');
            process.exit(1);
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Test Failed:', error);
        process.exit(1);
    } finally {
        if (sellerId) {
            // Cleanup
            await client.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]);
            await client.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
        }
        client.release();
        await pool.end();
    }
}

testManualWithdrawal();

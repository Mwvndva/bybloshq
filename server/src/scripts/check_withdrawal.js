
import { pool } from '../config/database.js';

async function checkWithdrawal() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT id, amount, status, provider_reference, created_at, metadata FROM withdrawal_requests ORDER BY id DESC LIMIT 1');
        console.log('Latest Withdrawal:', res.rows[0]);
        client.release();
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkWithdrawal();

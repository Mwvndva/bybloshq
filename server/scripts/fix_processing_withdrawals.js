import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function fixStuckWithdrawals() {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(`
      SELECT * FROM withdrawal_requests 
      WHERE status = 'processing' 
      ORDER BY created_at DESC
    `);

        if (rows.length === 0) {
            console.log('No processing withdrawals found.');
            return;
        }

        console.log(`Found ${rows.length} stuck withdrawal(s):`);
        rows.forEach((row, i) => {
            console.log(`${i + 1}. ID: ${row.id}, Amount: ${row.amount}, To: ${row.mpesa_name} (${row.mpesa_number}), Date: ${row.created_at}`);
        });

        console.log('\nUse this script to mark them as COMPLETED if you have confirmed the money is sent.');

        // For now, let's just mark the most recent one as completed if passed an ID
        const targetId = process.argv[2];

        if (!targetId) {
            console.log('\nUsage: node scripts/fix_processing_withdrawals.js <withdrawal_request_id>');
            process.exit(1);
        }

        const { rowCount } = await client.query(
            "UPDATE withdrawal_requests SET status = 'completed', processed_at = NOW() WHERE id = $1 AND status = 'processing'",
            [targetId]
        );

        if (rowCount > 0) {
            console.log(`\nSuccessfully marked withdrawal request ${targetId} as COMPLETED.`);
        } else {
            console.log(`\nFailed to update. Check if ID ${targetId} exists and is currently 'processing'.`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixStuckWithdrawals();

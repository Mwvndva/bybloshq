import pg from 'pg';
const { Pool } = pg;

// Explicit configuration provided by user
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bybloshqdb',
    user: 'byblos_user',
    password: 'ByblosSecure2025!',
});

async function debugLatestWithdrawal() {
    try {
        console.log('--- DEBUGGING LATEST WITHDRAWAL (Correct Config) ---');
        const { rows } = await pool.query(`
            SELECT id, status, provider_reference, raw_response, created_at 
            FROM withdrawal_requests 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (rows.length === 0) {
            console.log('No withdrawal requests found.');
        } else {
            const row = rows[0];
            console.log('ID:', row.id);
            console.log('Status:', row.status);
            console.log('Provider Reference:', row.provider_reference);
            console.log('Created At:', row.created_at);
            // console.log('Raw Response (from Payd):');
            // console.log(JSON.stringify(row.raw_response, null, 2));
        }
    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        await pool.end();
    }
}

debugLatestWithdrawal();

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function checkEmails() {
    try {
        // Use dynamic import to ensure dotenv.config() has run first
        const { pool } = await import('../server/src/config/database.js');

        console.log('Checking recent registrations...');

        const users = await pool.query('SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 10');
        console.log('\n--- Recent Users (Last 10) ---');
        console.table(users.rows);

        const pending = await pool.query('SELECT id, email, role, created_at FROM pending_registrations ORDER BY created_at DESC LIMIT 10');
        console.log('\n--- Recent Pending Registrations (Last 10) ---');
        console.table(pending.rows);

        // Check for specific email if provided via args
        const targetEmail = process.argv[2];
        if (targetEmail) {
            const normalized = targetEmail.toLowerCase();
            console.log(`\nSearching for: ${normalized}`);

            const userMatch = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = $1', [normalized]);
            console.log('User Match:', userMatch.rows);

            const pendingMatch = await pool.query('SELECT id, email FROM pending_registrations WHERE LOWER(email) = $1', [normalized]);
            console.log('Pending Match:', pendingMatch.rows);
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkEmails();

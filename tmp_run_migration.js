import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env before importing pool
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

async function runMigration() {
    const migrationPath = path.join(process.cwd(), 'server', 'src', 'migrations', '20260417_fulfillment_hardening.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Dynamic import to ensure env is loaded
    const { pool } = await import('./server/src/config/database.js');

    console.log('Running migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from server directory
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'byblos_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function fixConstraints() {
    const client = await pool.connect();
    try {
        console.log('Fixing foreign key constraints on "tickets" table...');

        // Drop old incorrect constraints if they exist
        await client.query('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_id_fkey');
        await client.query('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS fk_ticket_type');

        console.log('Dropped old constraints.');

        // Cleanup reference invalid data
        console.log('Cleaning up invalid ticket data...');
        const deleteRes = await client.query(`
      DELETE FROM tickets 
      WHERE ticket_type_id NOT IN (SELECT id FROM event_ticket_types)
    `);
        console.log(`Deleted ${deleteRes.rowCount} orphaned tickets.`);

        // Add new correct constraint
        await client.query(`
      ALTER TABLE tickets 
      ADD CONSTRAINT tickets_ticket_type_id_fkey 
      FOREIGN KEY (ticket_type_id) 
      REFERENCES event_ticket_types(id)
    `);

        console.log('Added new correct constraint pointing to event_ticket_types.');

    } catch (err) {
        if (String(err).includes('does not exist')) {
            console.log('Tables mismatch detected. Please verify table names.');
        }
        console.error('Error fixing constraints:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixConstraints();

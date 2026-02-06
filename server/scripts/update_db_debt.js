import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function updateSchema() {
    const client = await pool.connect();
    try {
        console.log('Starting schema update for Debt feature...');

        await client.query('BEGIN');

        // 1. Add 'debt_pending' to order_status enum
        // Note: ALTER TYPE ADD VALUE cannot run inside a transaction block usually, 
        // but try/catch block ensures safety. If it fails due to transaction, we run it separately.
        // However, postgres allows it if it's the only thing or in newer versions. 
        // Safest way is to check if it exists first.

        // Check if enum value exists
        const enumCheck = await client.query(`
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status') 
      AND enumlabel = 'debt_pending'
    `);

        if (enumCheck.rowCount === 0) {
            console.log("Adding 'debt_pending' to order_status enum...");
            // Must commit current transaction to run ALTER TYPE
            await client.query('COMMIT');
            await client.query("ALTER TYPE order_status ADD VALUE 'debt_pending'");
            await client.query('BEGIN');
        } else {
            console.log("'debt_pending' already exists in order_status enum.");
        }

        // 2. Add is_debt column
        const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'product_orders' AND column_name = 'is_debt'
    `);

        if (columnCheck.rowCount === 0) {
            console.log("Adding 'is_debt' column to product_orders...");
            await client.query("ALTER TABLE product_orders ADD COLUMN is_debt BOOLEAN DEFAULT FALSE");
        } else {
            console.log("'is_debt' column already exists.");
        }

        await client.query('COMMIT');
        console.log('Schema update completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating schema:', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateSchema();

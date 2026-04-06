import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function checkSchema() {
    try {
        const { pool } = await import('../server/src/config/database.js');

        console.log('Checking product_orders table schema...');
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'product_orders' 
            AND column_name = 'buyer_id'
        `);
        console.table(result.rows);

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();

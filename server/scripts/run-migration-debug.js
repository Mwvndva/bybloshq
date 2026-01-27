import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
async function runMigration() {
    try {
        const res = await pool.query(`SELECT phone FROM sellers LIMIT 1`);
        console.log('Successfully selected phone from sellers');

        await pool.query(`ALTER TABLE sellers RENAME COLUMN phone TO whatsapp_number`);
        console.log('Renamed phone to whatsapp_number in sellers');

        await pool.query(`ALTER TABLE buyers RENAME COLUMN phone TO mobile_payment`);
        console.log('Renamed phone to mobile_payment in buyers');
        await pool.query(`ALTER TABLE buyers ADD COLUMN whatsapp_number VARCHAR(50)`);
        console.log('Added whatsapp_number to buyers');

        await pool.query(`ALTER TABLE organizers RENAME COLUMN phone TO whatsapp_number`);
        console.log('Renamed phone to whatsapp_number in organizers');

        await pool.query(`ALTER TABLE product_orders RENAME COLUMN buyer_phone TO buyer_mobile_payment`);
        await pool.query(`ALTER TABLE product_orders ADD COLUMN buyer_whatsapp_number VARCHAR(50)`);
        console.log('Updated product_orders');

        await pool.query(`ALTER TABLE ticket_purchases RENAME COLUMN phone_number TO whatsapp_number`);
        console.log('Updated ticket_purchases');

        await pool.query(`ALTER TABLE payments RENAME COLUMN phone_number TO mobile_payment`);
        await pool.query(`ALTER TABLE payments ADD COLUMN whatsapp_number VARCHAR(50)`);
        console.log('Updated payments');

        console.log('Migration completed successfully');
    } catch (e) {
        console.error('Migration failed:', e.message);
    }
    await pool.end();
}
runMigration();

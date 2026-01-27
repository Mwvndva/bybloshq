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
async function checkSchema() {
    const tables = ['sellers', 'buyers', 'organizers', 'product_orders', 'payments', 'ticket_purchases'];
    for (const table of tables) {
        const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
        console.log(`${table}: ${res.rows.map(r => r.column_name).sort().join(', ')}`);
    }
    await pool.end();
}
checkSchema();

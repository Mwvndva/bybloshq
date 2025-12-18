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

async function inspectDb() {
    const client = await pool.connect();
    try {
        const tablesToCheck = ['events', 'ticket_types', 'tickets', 'ticket_purchases', 'payments', 'organizers'];

        for (const tableName of tablesToCheck) {
            console.log(`\n--- ${tableName.toUpperCase()} SCHEMA ---`);
            const schema = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name
      `, [tableName]);

            if (schema.rows.length === 0) {
                console.log('Table does not exist');
            } else {
                schema.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
            }
        }

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

inspectDb();

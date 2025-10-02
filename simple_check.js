import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 3001,
  database: 'byblos7',
  user: 'postgres',
  password: 'nurubot'
});

async function checkDB() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log('Tables in database:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDB();

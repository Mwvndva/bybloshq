import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'byblos',
  password: process.env.DB_PASSWORD || 'yourpassword',
  port: process.env.DB_PORT || 5432,
});

async function listEvents() {
  const client = await pool.connect();
  
  try {
    const { rows: events } = await client.query(
      `SELECT id, name, start_date, end_date, status 
       FROM events 
       WHERE organizer_id = 7  -- Update with your organizer ID
       ORDER BY created_at DESC`
    );
    
    console.log('Current events:');
    console.table(events.map(e => ({
      id: e.id,
      name: e.name,
      start_date: e.start_date,
      end_date: e.end_date,
      status: e.status,
      is_valid: e.end_date > e.start_date ? '✅' : '❌',
      duration_hours: ((new Date(e.end_date) - new Date(e.start_date)) / (1000 * 60 * 60)).toFixed(1)
    })));
    
  } catch (error) {
    console.error('Error listing events:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

listEvents()
  .then(() => console.log('Done'))
  .catch(console.error);

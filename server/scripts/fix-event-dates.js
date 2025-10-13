import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'byblos',
  password: process.env.DB_PASSWORD || 'yourpassword',
  port: process.env.DB_PORT || 5432,
});

async function fixEventDates() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find events where end_date is before or equal to start_date
    const { rows: invalidEvents } = await client.query(
      `SELECT id, name, start_date, end_date 
       FROM events 
       WHERE end_date <= start_date`
    );
    
    console.log(`Found ${invalidEvents.length} events with invalid date ranges`);
    
    for (const event of invalidEvents) {
      // Set end_date to be 2 hours after start_date by default
      const newEndDate = new Date(event.start_date);
      newEndDate.setHours(newEndDate.getHours() + 2);
      
      console.log(`Fixing event: ${event.name} (ID: ${event.id})`);
      console.log(`  Original: start=${event.start_date}, end=${event.end_date}`);
      console.log(`  Fixed:    end=${newEndDate.toISOString()}`);
      
      await client.query(
        'UPDATE events SET end_date = $1 WHERE id = $2',
        [newEndDate, event.id]
      );
    }
    
    await client.query('COMMIT');
    console.log('Successfully fixed all invalid event dates');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing event dates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixEventDates()
  .then(() => console.log('Done'))
  .catch(console.error);

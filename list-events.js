import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'byblos',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function listEvents() {
  try {
    const query = `
      SELECT 
        e.id, 
        e.name, 
        e.status,
        e.start_date,
        e.end_date,
        e.ticket_quantity,
        e.ticket_price,
        o.id as organizer_id,
        o.email as organizer_email,
        (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) as tickets_sold,
        (SELECT COUNT(*) FROM ticket_types tt WHERE tt.event_id = e.id) as ticket_types_count
      FROM events e
      JOIN organizers o ON e.organizer_id = o.id
      ORDER BY e.start_date DESC
      LIMIT 5;
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('No events found in the database.');
      return;
    }
    
    console.log('Available Events:');
    console.log('================');
    
    result.rows.forEach((event, index) => {
      console.log(`
${index + 1}. ${event.name}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Organizer: ${event.organizer_email} (ID: ${event.organizer_id})`);
      console.log(`   Date: ${new Date(event.start_date).toLocaleDateString()} - ${new Date(event.end_date).toLocaleDateString()}`);
      console.log(`   Tickets: ${event.tickets_sold} sold of ${event.ticket_quantity}`);
      console.log(`   Price: $${event.ticket_price}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Ticket Types: ${event.ticket_types_count}`);
    });
    
  } catch (error) {
    console.error('Error listing events:', error);
  } finally {
    await pool.end();
  }
}

listEvents();

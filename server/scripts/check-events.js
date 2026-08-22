import { pool } from '../src/config/database.js';

async function checkEvents() {
  try {
    console.log('Checking for published events in the database...');
    
    // Check total count of events
    const countResult = await pool.query('SELECT COUNT(*) as count FROM events');
    console.log(`Total events in database: ${countResult.rows[0].count}`);
    
    // Check count of published events
    const publishedCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM events WHERE status = 'published'"
    );
    console.log(`Published events: ${publishedCountResult.rows[0].count}`);
    
    // Check count of upcoming published events
    const upcomingResult = await pool.query(
      `SELECT COUNT(*) as count FROM events 
       WHERE end_date >= NOW() 
       AND status = 'published'`
    );
    console.log(`Upcoming published events: ${upcomingResult.rows[0].count}`);
    
    // Get sample of upcoming events
    const upcomingEvents = await pool.query(
      `SELECT id, name, start_date, end_date, status, ticket_quantity 
       FROM events 
       WHERE end_date >= NOW() 
       AND status = 'published'
       LIMIT 5`
    );
    
    console.log('\nSample of upcoming published events:');
    console.table(upcomingEvents.rows);
    
    // Check if any events have ticket types
    const eventsWithTicketTypes = await pool.query(
      `SELECT DISTINCT e.id, e.name 
       FROM events e
       JOIN ticket_types tt ON e.id = tt.event_id
       WHERE e.status = 'published'
       LIMIT 5`
    );
    
    console.log('\nEvents with ticket types:');
    console.table(eventsWithTicketTypes.rows);
    
  } catch (error) {
    console.error('Error checking events:', error);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkEvents();

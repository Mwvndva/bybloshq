import { query } from '../src/config/database.js';

async function updateDashboardStats(organizerId) {
  try {
    // First, ensure all events have valid date ranges
    await query(
      `UPDATE events 
       SET end_date = start_date + INTERVAL '2 hours'
       WHERE organizer_id = $1 AND end_date <= start_date`,
      [organizerId]
    );

    // Force update dashboard stats
    const { rows } = await query(
      `WITH event_counts AS (
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN start_date > (NOW() AT TIME ZONE 'UTC') THEN 1 END) as upcoming_events,
          COUNT(CASE WHEN end_date < (NOW() AT TIME ZONE 'UTC') THEN 1 END) as past_events,
          COUNT(CASE WHEN start_date <= (NOW() AT TIME ZONE 'UTC') AND end_date >= (NOW() AT TIME ZONE 'UTC') THEN 1 END) as current_events
        FROM events
        WHERE organizer_id = $1
      )
      UPDATE dashboard_stats
      SET 
        total_events = ec.total_events,
        upcoming_events = ec.upcoming_events,
        past_events = ec.past_events,
        current_events = ec.current_events,
        updated_at = NOW()
      FROM event_counts ec
      WHERE organizer_id = $1
      RETURNING *`,
      [organizerId]
    );

    console.log('Dashboard stats updated:', rows[0]);
  } catch (error) {
    console.error('Error updating dashboard stats:', error);
    throw error;
  }
}

// Update stats for organizer with ID 7 (replace with your organizer ID)
updateDashboardStats(7)
  .then(() => console.log('Done'))
  .catch(console.error);

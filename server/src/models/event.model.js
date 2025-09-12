import { pool } from '../config/database.js';

const Event = {
  async create({ 
    organizer_id, 
    name, 
    description, 
    image_url, 
    location, 
    ticket_quantity, 
    ticket_price, 
    start_date, 
    end_date 
  }) {
    const result = await pool.query(
      `INSERT INTO events 
       (organizer_id, name, description, image_url, location, ticket_quantity, ticket_price, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [organizer_id, name, description, image_url, location, ticket_quantity, ticket_price, start_date, end_date]
    );
    return result.rows[0];
  },

  async findById(id) {
    // Get the event
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    const event = eventResult.rows[0];
    
    if (!event) return null;
    
    // Get ticket types for the event with total_created count
    const ticketTypesResult = await pool.query(
      `WITH ticket_counts AS (
        SELECT 
          ticket_type_id,
          COUNT(*) as total_created
        FROM tickets
        WHERE event_id = $1
        GROUP BY ticket_type_id
      )
      SELECT 
        tt.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status = 'paid') as sold,
        COALESCE(tc.total_created, 0) as total_created
      FROM ticket_types tt 
      LEFT JOIN ticket_counts tc ON tt.id = tc.ticket_type_id
      WHERE tt.event_id = $1`,
      [id]
    );
    
    // Add ticket types to the event object
    event.ticket_types = ticketTypesResult.rows;
    
    // Calculate total tickets sold and revenue from ticket types
    if (ticketTypesResult.rows.length > 0) {
      // If we have ticket types, use them for calculations
      event.total_tickets_sold = ticketTypesResult.rows.reduce((sum, tt) => sum + (parseInt(tt.quantity_sold || tt.sold || '0', 10)), 0);
      event.total_revenue = ticketTypesResult.rows.reduce(
        (sum, tt) => sum + ((parseInt(tt.quantity_sold || tt.sold || '0', 10)) * parseFloat(tt.price || 0)), 
        0
      );
      
      // Add ticket types to the event object with total_created
      event.ticket_types = ticketTypesResult.rows.map(tt => ({
        ...tt,
        quantity: parseInt(tt.quantity, 10) || 0,
        sold: parseInt(tt.quantity_sold || tt.sold || '0', 10),
        total_created: parseInt(tt.total_created || '0', 10),
        available: Math.max(0, (parseInt(tt.quantity, 10) || 0) - (parseInt(tt.quantity_sold || tt.sold || '0', 10)))
      }));
    } else {
      // Fallback to event-level ticket quantity if no ticket types exist
      event.total_tickets_sold = parseInt(event.tickets_sold || '0', 10);
      event.total_revenue = event.total_tickets_sold * parseFloat(event.ticket_price || 0);
      
      // Create a default ticket type if none exist
      event.ticket_types = [{
        id: 'default',
        name: 'General Admission',
        description: 'General admission ticket',
        price: parseFloat(event.ticket_price || 0),
        quantity: parseInt(event.ticket_quantity || '0', 10),
        sold: event.total_tickets_sold,
        total_created: event.total_tickets_sold, // For default ticket type, total_created is the same as sold
        available: Math.max(0, (parseInt(event.ticket_quantity || '0', 10) - event.total_tickets_sold)),
        sales_start_date: null,
        sales_end_date: null,
        is_default: true
      }];
    }
    
    return event;
  },

  async findByOrganizer(organizer_id) {
    const result = await pool.query(
      'SELECT * FROM events WHERE organizer_id = $1 ORDER BY created_at DESC',
      [organizer_id]
    );
    return result.rows;
  },

  async findUpcomingByOrganizer(organizer_id, limit = 10) {
    const result = await pool.query(
      `SELECT e.*, o.full_name as organizer_name 
       FROM events e
       JOIN organizers o ON e.organizer_id = o.id
       WHERE e.organizer_id = $1 
         AND e.end_date > NOW()
       ORDER BY e.start_date ASC
       LIMIT $2`,
      [organizer_id, limit]
    );
    return result.rows;
  },

  async findPastByOrganizer(organizer_id, limit = 10) {
    const result = await pool.query(
      `SELECT e.*, o.full_name as organizer_name 
       FROM events e
       JOIN organizers o ON e.organizer_id = o.id
       WHERE e.organizer_id = $1 AND e.end_date <= NOW()
       ORDER BY e.end_date DESC
       LIMIT $2`,
      [organizer_id, limit]
    );
    return result.rows;
  },

  async update(id, updates) {
    const { 
      name, 
      description, 
      image_url, 
      location, 
      ticket_quantity, 
      ticket_price, 
      start_date, 
      end_date,
      status 
    } = updates;
    
    const result = await pool.query(
      `UPDATE events 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           image_url = COALESCE($3, image_url),
           location = COALESCE($4, location),
           ticket_quantity = COALESCE($5, ticket_quantity),
           ticket_price = COALESCE($6, ticket_price),
           start_date = COALESCE($7, start_date),
           end_date = COALESCE($8, end_date),
           status = COALESCE($9, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, description, image_url, location, ticket_quantity, ticket_price, 
       start_date, end_date, status, id]
    );
    
    return result.rows[0];
  },

  async delete(id, organizer_id) {
    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 AND organizer_id = $2 RETURNING id',
      [id, organizer_id]
    );
    return result.rows[0];
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE events 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, status`,
      [status, id]
    );
    return result.rows[0];
  },

  async getUpcomingEvents(limit = 10) {
    try {
      console.log('Fetching upcoming events with limit:', limit);
      
      // Get all published upcoming events with their ticket types in a single query
      const result = await pool.query(
        `WITH event_tickets AS (
          -- Get ticket type information with sales data
          SELECT 
            e.id as event_id,
            e.*,
            tt.id as ticket_type_id,
            tt.name as ticket_name,
            tt.description as ticket_description,
            tt.price as ticket_price,
            tt.quantity as ticket_quantity,
            tt.sales_start_date,
            tt.sales_end_date,
            COALESCE(t.sold_count, 0) as tickets_sold,
            GREATEST(0, tt.quantity - COALESCE(t.sold_count, 0)) as tickets_available,
            COALESCE(t.total_revenue, 0) as ticket_revenue
          FROM events e
          LEFT JOIN ticket_types tt ON e.id = tt.event_id
          LEFT JOIN (
            SELECT 
              ticket_type_id,
              COUNT(*) as sold_count,
              SUM(price) as total_revenue
            FROM tickets
            WHERE status = 'paid'
            GROUP BY ticket_type_id
          ) t ON tt.id = t.ticket_type_id
          WHERE e.status = 'published'
            AND e.start_date > NOW()
            AND (
              -- Include ticket types that are currently on sale
              (tt.id IS NULL) OR 
              (tt.sales_start_date IS NULL OR tt.sales_start_date <= NOW()) AND 
              (tt.sales_end_date IS NULL OR tt.sales_end_date >= NOW())
            )
        ),
        -- Get events with legacy ticket data (for events without ticket types)
        legacy_events AS (
          SELECT 
            e.id as event_id,
            e.*,
            NULL as ticket_type_id,
            'General Admission' as ticket_name,
            'General admission ticket' as ticket_description,
            e.ticket_price,
            e.ticket_quantity,
            NULL as sales_start_date,
            NULL as sales_end_date,
            COALESCE(t.tickets_sold, 0) as tickets_sold,
            GREATEST(0, e.ticket_quantity - COALESCE(t.tickets_sold, 0)) as tickets_available,
            COALESCE(t.total_revenue, 0) as ticket_revenue
          FROM events e
          LEFT JOIN (
            SELECT 
              event_id,
              COUNT(*) as tickets_sold,
              SUM(price) as total_revenue
            FROM tickets
            WHERE status = 'paid'
            GROUP BY event_id
          ) t ON e.id = t.event_id
          WHERE e.status = 'published'
            AND e.start_date > NOW()
            AND NOT EXISTS (
              SELECT 1 FROM ticket_types tt 
              WHERE tt.event_id = e.id
            )
        )
        -- Combine both result sets
        SELECT * FROM event_tickets
        UNION ALL
        SELECT * FROM legacy_events
        ORDER BY start_date ASC
        LIMIT $1`,
        [limit * 5] // Get more rows to account for multiple ticket types per event
      );

      if (result.rows.length === 0) return [];
      
      // Process the results into a structured format
      const eventsMap = new Map();
      
      result.rows.forEach(row => {
        const eventId = row.event_id;
        
        if (!eventsMap.has(eventId)) {
          // Create event object if it doesn't exist
          eventsMap.set(eventId, {
            id: eventId,
            name: row.name,
            description: row.description,
            image_url: row.image_url,
            location: row.location,
            start_date: row.start_date,
            end_date: row.end_date,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            organizer_id: row.organizer_id,
            ticket_quantity: 0, // Will be calculated from ticket types
            tickets_sold: 0,    // Will be calculated from ticket types
            available_tickets: 0, // Will be calculated from ticket types
            total_revenue: 0,   // Will be calculated from ticket types
            ticket_types: []
          });
        }
        
        const event = eventsMap.get(eventId);
        
        // Add ticket type if it exists
        if (row.ticket_type_id || row.ticket_name === 'General Admission') {
          const ticketType = {
            id: row.ticket_type_id || 'default',
            name: row.ticket_name,
            description: row.ticket_description,
            price: parseFloat(row.ticket_price || 0),
            quantity: parseInt(row.ticket_quantity || 0, 10),
            sold: parseInt(row.tickets_sold || 0, 10),
            available: parseInt(row.tickets_available || 0, 10),
            revenue: parseFloat(row.ticket_revenue || 0),
            sales_start_date: row.sales_start_date,
            sales_end_date: row.sales_end_date,
            is_default: !row.ticket_type_id
          };
          
          event.ticket_types.push(ticketType);
          
          // Update event totals
          event.ticket_quantity += ticketType.quantity;
          event.tickets_sold += ticketType.sold;
          event.available_tickets += ticketType.available;
          event.total_revenue += ticketType.revenue;
        }
      });
      
      // Convert map to array and sort by start date
      const events = Array.from(eventsMap.values())
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .slice(0, limit); // Ensure we don't exceed the requested limit
      
      console.log(`Processed ${events.length} upcoming events with their ticket types`);
      return events;
      
    } catch (error) {
      console.error('Error in getUpcomingEvents model method:', error);
      throw error;
    }
  },
  
  /**
   * Get a public event by ID with its ticket types
   * @param {number|string} id - The event ID
   * @returns {Promise<Object|null>} The event object with ticket types or null if not found
   */
  async getPublicEvent(id) {
    // Convert id to number if it's a string
    const eventId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    // Validate that id is a valid number
    if (isNaN(eventId) || eventId <= 0) {
      console.error('Invalid event ID provided to getPublicEvent:', id);
      return null;
    }

    console.log(`[EventModel] Fetching public event data for ID: ${eventId}`);
    
    // First get the basic event data
    let event;
    let client;
    
    try {
      // Get a client from the pool
      client = await pool.connect();
      
      // Start a transaction
      await client.query('BEGIN');
      
      // Get the event with basic info
      const eventQuery = `
        SELECT 
          e.*,
          o.full_name as organizer_name,
          o.email as organizer_email,
          o.phone as organizer_phone
        FROM events e
        LEFT JOIN organizers o ON e.organizer_id = o.id
        WHERE e.id = $1
        LIMIT 1
      `;
      
      const eventResult = await client.query(eventQuery, [eventId]);
      event = eventResult.rows[0];
      
      if (!event) {
        console.log(`[EventModel] No event found with ID: ${eventId}`);
        await client.query('ROLLBACK');
        return null;
      }
      
      console.log(`[EventModel] Found event: ${event.name} (ID: ${event.id}, Status: ${event.status})`);
      
      // Get ticket types with availability information
      const ticketTypesQuery = `
        WITH ticket_counts AS (
          SELECT 
            ticket_type_id,
            COUNT(*) as total_created,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as total_sold
          FROM tickets
          WHERE event_id = $1
          GROUP BY ticket_type_id
        )
        SELECT 
          tt.*,
          COALESCE(tc.total_created, 0) as total_created,
          COALESCE(tc.total_sold, 0) as total_sold,
          GREATEST(tt.quantity - COALESCE(tc.total_created, 0), 0) as available
        FROM ticket_types tt 
        LEFT JOIN ticket_counts tc ON tt.id = tc.ticket_type_id
        WHERE tt.event_id = $1 
          AND (tt.sales_start_date IS NULL OR tt.sales_start_date <= NOW())
          AND (tt.sales_end_date IS NULL OR tt.sales_end_date >= NOW())
        ORDER BY tt.price ASC, tt.name ASC
      `;
      
      const ticketTypesResult = await client.query(ticketTypesQuery, [eventId]);
      
      // Format ticket types
      const ticketTypes = ticketTypesResult.rows.map(tt => ({
        id: tt.id,
        name: tt.name || 'General Admission',
        description: tt.description || '',
        price: parseFloat(tt.price || '0'),
        quantity: parseInt(tt.quantity || '0', 10),
        available: parseInt(tt.available || '0', 10),
        min_per_order: parseInt(tt.min_per_order || '1', 10),
        max_per_order: parseInt(tt.max_per_order || '10', 10),
        sales_start_date: tt.sales_start_date ? new Date(tt.sales_start_date).toISOString() : null,
        sales_end_date: tt.sales_end_date ? new Date(tt.sales_end_date).toISOString() : null,
        is_active: tt.is_active !== false,
        total_created: parseInt(tt.total_created || '0', 10),
        total_sold: parseInt(tt.total_sold || '0', 10)
      }));
      
      // Only create a default ticket type if there are no ticket types at all
      // and the event has ticket_quantity defined (legacy support)
      if (ticketTypes.length === 0 && event.ticket_quantity) {
        // Check if there's already a default ticket type
        const hasDefaultTicketType = ticketTypes.some(tt => tt.is_default);
        
        if (!hasDefaultTicketType) {
          const defaultTicketType = {
            id: 'default',
            name: 'General Admission',
            description: 'General admission ticket',
            price: parseFloat(event.ticket_price || '0'),
            quantity: parseInt(event.ticket_quantity || '0', 10),
            available: parseInt(event.ticket_quantity || '0', 10),
            min_per_order: 1,
            max_per_order: 10,
            sales_start_date: null,
            sales_end_date: null,
            total_created: 0,
            total_sold: 0,
            is_default: true
          };
          ticketTypes.push(defaultTicketType);
        }
      }
      
      // Calculate total available tickets
      const totalAvailableTickets = ticketTypes.reduce((sum, tt) => sum + tt.available, 0);
      
      // Add ticket types and availability to the event
      event.ticket_types = ticketTypes;
      event.available_tickets = totalAvailableTickets;
      event.tickets_sold = ticketTypes.reduce((sum, tt) => sum + tt.total_sold, 0);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      // Debug log the event data
      console.log(`[EventModel] Successfully retrieved event data for: ${event.name} (ID: ${event.id})`, {
        id: event.id,
        name: event.name,
        status: event.status,
        total_tickets: event.ticket_quantity,
        available_tickets: event.available_tickets,
        tickets_sold: event.tickets_sold,
        ticket_types_count: event.ticket_types.length
      });
      
      return event;
      
    } catch (error) {
      // Rollback the transaction on error
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
      
      console.error('[EventModel] Database error in getPublicEvent:', {
        message: error.message,
        stack: error.stack,
        eventId: id,
        idType: typeof id
      });
      
      throw error; // Re-throw to be handled by the controller
    } finally {
      // Release the client back to the pool
      if (client) {
        client.release();
      }
    }
  },
  
  async getUpcomingEvents(limit = 10) {
    console.log(`[EventModel] Fetching up to ${limit} upcoming events`);
    
    try {
      // First, get all upcoming events
      const eventsResult = await pool.query(
        `SELECT * FROM events 
         WHERE end_date >= NOW() 
           AND status = 'published'
         ORDER BY start_date ASC 
         LIMIT $1`,
        [limit]
      );
      
      const events = eventsResult.rows;
      console.log(`[EventModel] Found ${events.length} events in database`);
      
      if (events.length === 0) {
        console.log('[EventModel] No upcoming events found in the database');
        return [];
      }
      
      // Log sample event data
      console.log('[EventModel] Sample event from DB:', {
        id: events[0].id,
        name: events[0].name,
        start_date: events[0].start_date,
        end_date: events[0].end_date,
        status: events[0].status,
        ticket_quantity: events[0].ticket_quantity
      });
      
      // Get event IDs for batch loading ticket types
      const eventIds = events.map(e => e.id);
      
      // Get ticket types for all events in one query
      const ticketTypesResult = await pool.query(
        `WITH ticket_sales AS (
          SELECT 
            ticket_type_id,
            COUNT(*) as sold
          FROM tickets
          WHERE status = 'paid'
          GROUP BY ticket_type_id
        )
        SELECT 
          tt.*,
          COALESCE(ts.sold, 0) as sold,
          GREATEST(0, tt.quantity - COALESCE(ts.sold, 0)) as available
        FROM ticket_types tt
        LEFT JOIN ticket_sales ts ON tt.id = ts.ticket_type_id
        WHERE tt.event_id = ANY($1)
          AND (tt.sales_start_date IS NULL OR tt.sales_start_date <= NOW())
          AND (tt.sales_end_date IS NULL OR tt.sales_end_date >= NOW())
        ORDER BY tt.price ASC`,
        [eventIds]
      );
      
      console.log(`[EventModel] Found ${ticketTypesResult.rows.length} ticket types across all events`);
      
      // Group ticket types by event ID
      const ticketTypesByEvent = {};
      ticketTypesResult.rows.forEach(tt => {
        if (!ticketTypesByEvent[tt.event_id]) {
          ticketTypesByEvent[tt.event_id] = [];
        }
        const ticketType = {
          id: tt.id,
          name: tt.name,
          description: tt.description,
          price: parseFloat(tt.price || '0'),
          quantity: parseInt(tt.quantity || '0', 10),
          sold: parseInt(tt.sold || '0', 10),
          available: parseInt(tt.available || '0', 10),
          sales_start_date: tt.sales_start_date,
          sales_end_date: tt.sales_end_date,
          is_default: false
        };
        ticketTypesByEvent[tt.event_id].push(ticketType);
      });
      
      // Process events to include ticket types and calculate totals
      const processedEvents = events.map(event => {
        const ticketTypes = ticketTypesByEvent[event.id] || [];
        
        // If no ticket types, create a default one
        if (ticketTypes.length === 0) {
          console.log(`[EventModel] No ticket types found for event ${event.id}, creating default`);
          const defaultTicket = {
            id: 'default',
            name: 'General Admission',
            description: 'General admission ticket',
            price: parseFloat(event.ticket_price || '0'),
            quantity: parseInt(event.ticket_quantity || '0', 10),
            sold: 0,
            available: parseInt(event.ticket_quantity || '0', 10),
            sales_start_date: null,
            sales_end_date: null,
            is_default: true
          };
          ticketTypes.push(defaultTicket);
        }
        
        // Calculate totals
        const totals = ticketTypes.reduce((acc, tt) => ({
          sold: acc.sold + (tt.sold || 0),
          available: acc.available + (tt.available || 0),
          revenue: acc.revenue + ((tt.sold || 0) * (tt.price || 0))
        }), { sold: 0, available: 0, revenue: 0 });
        
        // Format the event with all required fields
        const formattedEvent = {
          ...event,
          ticket_types: ticketTypes,
          tickets_sold: totals.sold,
          available_tickets: totals.available,
          total_revenue: totals.revenue,
          // Ensure all required fields have default values
          name: event.name || 'Unnamed Event',
          description: event.description || '',
          image_url: event.image_url || '/images/default-event.jpg',
          location: event.location || 'Location not specified',
          start_date: event.start_date,
          end_date: event.end_date,
          ticket_price: parseFloat(event.ticket_price || '0'),
          ticket_quantity: parseInt(event.ticket_quantity || '0', 10)
        };
        
        return formattedEvent;
      });
      
      console.log(`[EventModel] Successfully processed ${processedEvents.length} events`);
      return processedEvents;
      
    } catch (error) {
      console.error('[EventModel] Error in getUpcomingEvents:', {
        message: error.message,
        stack: error.stack,
        limit: limit
      });
      throw error; // Re-throw to be handled by the controller
    }
  }
};

export default Event;

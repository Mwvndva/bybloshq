import Event from '../models/event.model.js';
import { pool } from '../config/database.js';

export const createEvent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      name, 
      description, 
      location, 
      ticket_quantity, 
      ticket_price, 
      start_date, 
      end_date,
      ticketTypes = [],
      image_data_url
    } = req.body;

    console.log('Parsed values:', {
      name,
      description,
      location,
      ticket_quantity,
      ticket_price,
      start_date,
      end_date,
      ticketTypes,
      hasImage: !!image_data_url
    });

    // Validate required fields
    const requiredFields = { name, description, location, start_date, end_date };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        fields: missingFields
      });
    }

    // Validate at least one ticket type if no direct ticket info provided
    if ((!ticket_quantity || !ticket_price) && (!ticketTypes || ticketTypes.length === 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'Either provide ticket_quantity and ticket_price or at least one ticket type'
      });
    }

    // Validate image if provided
    if (image_data_url) {
      // Validate image format
      if (!image_data_url.startsWith('data:image/')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid image format. Must be a data URL starting with data:image/'
        });
      }

      // Validate image size (max 2MB)
      const imageSize = (image_data_url.length * 0.75); // Convert base64 to bytes
      if (imageSize > 2 * 1024 * 1024) { // 2MB
        return res.status(400).json({
          status: 'error',
          message: 'Image size exceeds 2MB limit'
        });
      }
    }

    // Validate date range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (endDate <= startDate) {
      return res.status(400).json({
        status: 'error',
        message: 'End date must be after start date'
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // For events with ticket types, we don't use the event-level ticket_quantity
    // Instead, we'll use 0 to indicate that ticket types should be used
    const useTicketTypes = ticketTypes && ticketTypes.length > 0;
    
    // Only use the provided ticket_quantity if we're not using ticket types
    const totalQuantity = useTicketTypes ? 0 : (ticket_quantity ? Number(ticket_quantity) : 0);
      
    // Calculate minimum price for display purposes only
    const minPrice = useTicketTypes ? 
      Math.min(...ticketTypes.map(t => Number(t.price) || 0)) :
      (ticket_price ? Number(ticket_price) : 0);
    
    console.log('Event configuration - using ticket types:', useTicketTypes);
    console.log('Event totals - totalQuantity:', totalQuantity, 'minPrice:', minPrice);

    // Insert event into database
    const query = `
      INSERT INTO events (
        organizer_id,
        name,
        description,
        location,
        ticket_quantity,
        ticket_price,
        start_date,
        end_date,
        image_url,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    // Ensure all values are properly converted to numbers
    const safeTotalQuantity = Number.isInteger(totalQuantity) ? totalQuantity : 0;
    const safeMinPrice = !isNaN(parseFloat(minPrice)) ? parseFloat(minPrice) : 0;

    const values = [
      req.user.id,
      name,
      description,
      location,
      safeTotalQuantity,
      safeMinPrice,
      start_date,
      end_date,
      image_data_url || null
    ];
    
    console.log('Final values for database:', {
      organizer_id: req.user.id,
      name: name?.substring(0, 30) + (name?.length > 30 ? '...' : ''),
      description: description?.substring(0, 30) + (description?.length > 30 ? '...' : ''),
      location: location?.substring(0, 30) + (location?.length > 30 ? '...' : ''),
      ticket_quantity: safeTotalQuantity,
      ticket_price: safeMinPrice,
      start_date,
      end_date,
      has_image: !!image_data_url
    });

    console.log('Executing event insert with values:', {
      organizer_id: req.user.id,
      name,
      description: description?.substring(0, 50) + '...',
      location,
      ticket_quantity: totalQuantity,
      ticket_price: minPrice,
      start_date,
      end_date,
      has_image: !!image_data_url
    });

    const result = await client.query(query, values);
    const event = result.rows[0];
    console.log('Event created successfully with ID:', event.id);

    // Handle ticket types
    const ticketsToInsert = [];
    
    // Process ticket types if any
    if (ticketTypes && ticketTypes.length > 0) {
      for (const type of ticketTypes) {
        // Handle dates safely
        let salesStartDate = null;
        let salesEndDate = null;
        
        try {
          salesStartDate = type.salesStartDate ? new Date(type.salesStartDate) : null;
          salesEndDate = type.salesEndDate ? new Date(type.salesEndDate) : null;
          
          // Validate dates
          if (salesStartDate && isNaN(salesStartDate.getTime())) {
            throw new Error(`Invalid sales start date for ticket type "${type.name}"`);
          }
          if (salesEndDate && isNaN(salesEndDate.getTime())) {
            throw new Error(`Invalid sales end date for ticket type "${type.name}"`);
          }
        } catch (dateError) {
          console.error('Error parsing dates:', dateError);
          throw new Error(`Invalid date format for ticket type "${type.name}"`);
        }
        
        const price = typeof type.price === 'string' ? parseFloat(type.price) : Number(type.price);
        const quantity = typeof type.quantity === 'string' ? 
          parseInt(type.quantity, 10) : 
          Math.max(1, Math.floor(Number(type.quantity) || 1));
        
        ticketsToInsert.push({
          name: type.name,
          description: type.description || '',
          price: price,
          quantity: quantity,
          sales_start_date: salesStartDate,
          sales_end_date: salesEndDate
        });
      }
    } else if (ticket_quantity !== undefined && ticket_price !== undefined) {
      // Create default ticket type if no ticket types provided but direct ticket info exists
      const price = typeof ticket_price === 'string' ? parseFloat(ticket_price) : Number(ticket_price);
      const quantity = typeof ticket_quantity === 'string' ? 
        parseInt(ticket_quantity, 10) : 
        Math.max(1, Math.floor(Number(ticket_quantity)));
      
      if (isNaN(price) || isNaN(quantity)) {
        throw new Error('Invalid ticket price or quantity');
      }

      ticketsToInsert.push({
        name: 'General Admission',
        description: 'General admission ticket',
        price: price,
        quantity: quantity,
        sales_start_date: null,
        sales_end_date: null
      });
    } else if (ticketTypes && ticketTypes.length > 0) {
        // Validate and prepare provided ticket types
        for (const [index, type] of ticketTypes.entries()) {
          if (!type.name) {
            throw new Error(`Ticket type ${index + 1} is missing a name`);
          }
          if (type.price === undefined || type.price === null) {
            throw new Error(`Ticket type "${type.name}" is missing a price`);
          }
          if (type.quantity === undefined || type.quantity === null) {
            throw new Error(`Ticket type "${type.name}" is missing a quantity`);
          }
          
          const price = typeof type.price === 'string' ? parseFloat(type.price) : Number(type.price);
          const quantity = typeof type.quantity === 'string' ? 
            parseInt(type.quantity, 10) : 
            Math.max(1, Math.floor(Number(type.quantity) || 1));
            
          if (isNaN(price) || price < 0) {
            throw new Error(`Invalid price for ticket type "${type.name}"`);
          }
          if (isNaN(quantity) || quantity < 1) {
            throw new Error(`Invalid quantity for ticket type "${type.name}"`);
          }
          
          // Handle dates safely
          let salesStartDate = null;
          let salesEndDate = null;
          
          try {
            salesStartDate = type.salesStartDate ? new Date(type.salesStartDate) : null;
            salesEndDate = type.salesEndDate ? new Date(type.salesEndDate) : null;
            
            // Validate dates
            if (salesStartDate && isNaN(salesStartDate.getTime())) {
              throw new Error(`Invalid sales start date for ticket type "${type.name}"`);
            }
            if (salesEndDate && isNaN(salesEndDate.getTime())) {
              throw new Error(`Invalid sales end date for ticket type "${type.name}"`);
            }
          } catch (dateError) {
            console.error('Error parsing dates:', dateError);
            throw new Error(`Invalid date format for ticket type "${type.name}"`);
          }
          
          ticketsToInsert.push({
            name: type.name,
            description: type.description || '',
            price: price,
            quantity: quantity,
            sales_start_date: salesStartDate,
            sales_end_date: salesEndDate
          });
        }
      } else {
        throw new Error('Either provide ticket_quantity and ticket_price or at least one ticket type');
      }

      // Insert ticket types if any
      if (ticketsToInsert.length > 0) {
        console.log('Preparing to insert ticket types:', ticketsToInsert);
        
        // Insert tickets one by one to get better error messages
        for (const ticket of ticketsToInsert) {
          console.log('Inserting ticket:', ticket);
          try {
            await client.query(
              `INSERT INTO public.ticket_types (
                event_id, name, description, price, quantity, sales_start_date, sales_end_date,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                event.id,
                ticket.name,
                ticket.description || null,
                ticket.price,
                ticket.quantity,
                ticket.sales_start_date || null,
                ticket.sales_end_date || null
              ]
            );
            console.log('Successfully inserted ticket type:', ticket.name);
          } catch (ticketError) {
            console.error('Error inserting ticket:', ticket, 'Error:', ticketError);
            throw new Error(`Failed to insert ticket type ${ticket.name}: ${ticketError.message}`);
          }
        }
      }

      // Process ticket types if any
      if (ticketTypes && ticketTypes.length > 0) {
        for (const [index, type] of ticketTypes.entries()) {
          // Handle dates safely
          let salesStartDate = null;
          let salesEndDate = null;
          
          try {
            salesStartDate = type.salesStartDate ? new Date(type.salesStartDate) : null;
            salesEndDate = type.salesEndDate ? new Date(type.salesEndDate) : null;
            
            // Validate dates
            if (salesStartDate && isNaN(salesStartDate.getTime())) {
              throw new Error(`Invalid sales start date for ticket type "${type.name}"`);
            }
            if (salesEndDate && isNaN(salesEndDate.getTime())) {
              throw new Error(`Invalid sales end date for ticket type "${type.name}"`);
            }
          } catch (dateError) {
            console.error('Error parsing dates:', dateError);
            throw new Error(`Invalid date format for ticket type "${type.name}"`);
          }
          
          const price = typeof type.price === 'string' ? parseFloat(type.price) : Number(type.price);
          const quantity = typeof type.quantity === 'string' ? 
            parseInt(type.quantity, 10) : 
            Math.max(1, Math.floor(Number(type.quantity) || 1));
          
          ticketsToInsert.push({
            name: type.name,
            description: type.description || '',
            price: price,
            quantity: quantity,
            sales_start_date: salesStartDate,
            sales_end_date: salesEndDate
          });
        }
      } else if (!ticket_quantity || !ticket_price) {
        throw new Error('Either provide ticket_quantity and ticket_price or at least one ticket type');
      }

      // Insert ticket types if any
      if (ticketsToInsert.length > 0) {
        console.log('Preparing to insert ticket types:', ticketsToInsert);
        
        for (const ticket of ticketsToInsert) {
          console.log('Inserting ticket:', ticket);
          try {
            await client.query(
              `INSERT INTO public.ticket_types (
                event_id, name, description, price, quantity, sales_start_date, sales_end_date,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                event.id,
                ticket.name,
                ticket.description || null,
                ticket.price,
                ticket.quantity,
                ticket.sales_start_date || null,
                ticket.sales_end_date || null
              ]
            );
            console.log('Successfully inserted ticket type:', ticket.name);
          } catch (ticketError) {
            console.error('Error inserting ticket:', ticket, 'Error:', ticketError);
            throw new Error(`Failed to insert ticket type ${ticket.name}: ${ticketError.message}`);
          }
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        data: {
          event
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create event error:', error);
      
      // Handle specific error cases
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({
          status: 'error',
          message: 'An event with similar details already exists.'
        });
      }
      
      const errorResponse = {
        status: 'error',
        message: error.message || 'An error occurred while creating the event'
      };
      
      if (process.env.NODE_ENV === 'development') {
        errorResponse.error = error.message;
        errorResponse.stack = error.stack;
      }
      
      return res.status(500).json(errorResponse);
      // If we get here, the event was created successfully
      res.status(201).json({
        status: 'success',
        data: {
          event
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create event error:', error);
      
      // Handle specific error cases
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({
          status: 'error',
          message: 'An event with similar details already exists.'
        });
      }
      
      const errorResponse = {
        status: 'error',
        message: error.message || 'An error occurred while creating the event'
      };
      
      if (process.env.NODE_ENV === 'development') {
        errorResponse.error = error.message;
        errorResponse.stack = error.stack;
      }
      
      return res.status(500).json(errorResponse);
    } finally {
      if (client) {
        client.release();
      }
    }
} finally {
  if (client) {
    client.release();
  }
}

export const getEvent = async (req, res) => {
try {
  const { id } = req.params;
  const event = await Event.findById(id);

  if (!event) {
    return res.status(404).json({
      status: 'error',
      message: 'Event not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      event
    }
  });
} catch (error) {
  console.error('Get event error:', error);
  res.status(500).json({
    status: 'error',
    message: 'An error occurred while fetching the event',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
};

export const getOrganizerEvents = async (req, res) => {
  try {
    const { 
      status,
      page = 1,
      limit = 10,
      sort = 'start_date',
      order = 'asc',
      search = ''
    } = req.query;
    
    // If user is not authenticated, return 401
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
    }
    
    const organizerId = req.user.id;
    const offset = (page - 1) * limit;
    
    // Build the base query
    let query = 'FROM events WHERE organizer_id = $1';
    const queryParams = [organizerId];
    let paramCount = 2;
    
    // Add status filter
    if (status === 'upcoming') {
      query += ` AND end_date >= NOW()`;
    } else if (status === 'past') {
      query += ` AND end_date < NOW()`;
    } else if (status === 'draft') {
      query += ` AND status = 'draft'`;
    } else if (status === 'published') {
      query += ` AND status = 'published'`;
    }
    
    // Add search filter
    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
      queryParams.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }
    
    // Validate sort field
    const validSortFields = ['name', 'start_date', 'end_date', 'created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'start_date';
    
    // Validate order
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total ${query}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get paginated events
    const eventsQuery = `
      SELECT * 
      ${query} 
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    const eventsResult = await pool.query(
      eventsQuery, 
      [...queryParams, limit, offset]
    );
    
    const events = eventsResult.rows;
    
    if (events.length === 0) {
      return res.status(200).json({
        status: 'success',
        pagination: {
          total: 0,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: 0
        },
        data: []
      });
    }
    
    // Get event IDs for batch querying
    const eventIds = events.map(event => event.id);
    
    // Get all ticket types for these events with their sold counts
    const ticketTypesQuery = `
      SELECT 
        tt.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status = 'paid') as sold
      FROM ticket_types tt
      WHERE tt.event_id = ANY($1)
    `;
    
    const { rows: allTicketTypes } = await pool.query(ticketTypesQuery, [eventIds]);
    
    // Group ticket types by event ID
    const ticketTypesByEvent = {};
    allTicketTypes.forEach(tt => {
      if (!ticketTypesByEvent[tt.event_id]) {
        ticketTypesByEvent[tt.event_id] = [];
      }
      ticketTypesByEvent[tt.event_id].push({
        ...tt,
        sold: parseInt(tt.sold || '0', 10),
        quantity: parseInt(tt.quantity || '0', 10),
        available: Math.max(0, (parseInt(tt.quantity || '0', 10) - parseInt(tt.sold || '0', 10)))
      });
    });
    
    // Get ticket counts for events without ticket types
    const eventsWithoutTicketTypes = events.filter(e => !ticketTypesByEvent[e.id] || ticketTypesByEvent[e.id].length === 0);
    if (eventsWithoutTicketTypes.length > 0) {
      const eventIdsWithoutTypes = eventsWithoutTicketTypes.map(e => e.id);
      const ticketCountsQuery = `
        SELECT 
          event_id,
          COUNT(*) as total_tickets_sold,
          COALESCE(SUM(price), 0) as total_revenue
        FROM tickets 
        WHERE event_id = ANY($1) AND status = 'paid'
        GROUP BY event_id
      `;
      
      const { rows: ticketCounts } = await pool.query(ticketCountsQuery, [eventIdsWithoutTypes]);
      
      // Add default ticket types for events without ticket types
      ticketCounts.forEach(count => {
        const event = events.find(e => e.id === count.event_id);
        if (event) {
          ticketTypesByEvent[event.id] = [{
            id: 'default',
            event_id: event.id,
            name: 'General Admission',
            description: 'General admission ticket',
            price: parseFloat(event.ticket_price || '0'),
            quantity: parseInt(event.ticket_quantity || '0', 10),
            sold: parseInt(count.total_tickets_sold || '0', 10),
            available: Math.max(0, (parseInt(event.ticket_quantity || '0', 10) - parseInt(count.total_tickets_sold || '0', 10))),
            sales_start_date: null,
            sales_end_date: null,
            is_default: true
          }];
        }
      });
    }
    
    // Enrich events with ticket type information
    const enrichedEvents = events.map(event => {
      const ticketTypes = ticketTypesByEvent[event.id] || [];
      
      // Calculate totals from ticket types
      const totals = ticketTypes.reduce((acc, tt) => ({
        sold: acc.sold + (parseInt(tt.sold) || 0),
        available: acc.available + (parseInt(tt.available) || 0),
        revenue: acc.revenue + ((parseInt(tt.sold) || 0) * parseFloat(tt.price || 0))
      }), { sold: 0, available: 0, revenue: 0 });
      
      // Add calculated fields to the event
      return {
        ...event,
        tickets_sold: totals.sold,
        available_tickets: totals.available,
        total_revenue: totals.revenue,
        // For backward compatibility, set ticket_quantity to the sum of ticket type quantities
        ticket_quantity: ticketTypes.length > 0 ? 
          ticketTypes.reduce((sum, tt) => sum + (parseInt(tt.quantity) || 0), 0) :
          parseInt(event.ticket_quantity || '0', 10)
      };
    });
    
    res.status(200).json({
      status: 'success',
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      },
      data: enrichedEvents
    });
  } catch (error) {
    console.error('Get organizer events error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateEvent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      location, 
      ticket_quantity, 
      ticket_price, 
      start_date, 
      end_date,
      image_data_url,
      status
    } = req.body;
    
    // Start transaction
    await client.query('BEGIN');

    // Check if the event exists and belongs to the organizer
    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    const event = eventResult.rows[0];
    
    if (!event) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }

    // Validate date range if dates are being updated
    if (start_date || end_date) {
      const currentStartDate = new Date(start_date || event.start_date);
      const currentEndDate = new Date(end_date || event.end_date);
      
      if (currentEndDate <= currentStartDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'End date must be after start date'
        });
      }
    }
    
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to update this event'
      });
    }

    // Validate image if provided
    if (image_data_url) {
      // Validate image format
      if (!image_data_url.startsWith('data:image/')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid image format. Must be a data URL starting with data:image/'
        });
      }

      // Validate image size (max 2MB)
      const imageSize = (image_data_url.length * 0.75); // Convert base64 to bytes
      if (imageSize > 2 * 1024 * 1024) { // 2MB
        return res.status(400).json({
          status: 'error',
          message: 'Image size exceeds 2MB limit'
        });
      }
    }

    // Build the update query dynamically based on provided fields
    const updateFields = [];
    const queryParams = [id];
    let paramIndex = 2; // Start from 2 because $1 is the event ID

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      queryParams.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      queryParams.push(description);
    }
    if (location !== undefined) {
      updateFields.push(`location = $${paramIndex++}`);
      queryParams.push(location);
    }
    if (ticket_quantity !== undefined) {
      updateFields.push(`ticket_quantity = $${paramIndex++}`);
      queryParams.push(parseInt(ticket_quantity, 10));
    }
    if (ticket_price !== undefined) {
      updateFields.push(`ticket_price = $${paramIndex++}`);
      queryParams.push(parseFloat(ticket_price));
    }
    if (start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex++}`);
      queryParams.push(new Date(start_date));
    }
    if (end_date !== undefined) {
      updateFields.push(`end_date = $${paramIndex++}`);
      queryParams.push(new Date(end_date));
    }
    if (image_data_url !== undefined) {
      updateFields.push(`image_url = $${paramIndex++}`);
      queryParams.push(image_data_url);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE events
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(query, queryParams);
    const updatedEvent = result.rows[0];

    await client.query('COMMIT');
    
    res.status(200).json({
      status: 'success',
      data: {
        event: updatedEvent
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update event error:', error);
    
    // Handle specific error cases
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        status: 'error',
        message: 'An event with similar details already exists.'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating the event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  } finally {
    client.release();
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the event exists and belongs to the organizer
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to delete this event'
      });
    }

    await Event.delete(id, req.user.id);
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while deleting the event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Check if the event exists and belongs to the organizer
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to update this event'
      });
    }

    const updatedEvent = await Event.updateStatus(id, status);
    
    res.status(200).json({
      status: 'success',
      data: {
        event: updatedEvent
      }
    });
  } catch (error) {
    console.error('Update event status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating the event status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getUpcomingEvents = async (req, res) => {
  const requestId = req.id || 'no-request-id';
  
  try {
    console.log(`[${requestId}] === getUpcomingEvents controller called ===`);
    console.log(`[${requestId}] Request URL: ${req.originalUrl}`);
    console.log(`[${requestId}] Query params:`, req.query);
    
    // Parse and validate limit parameter
    const limit = parseInt(req.query.limit, 10) || 20; // Default to 20 if not specified
    
    if (isNaN(limit) || limit < 1) {
      const errorMsg = `Invalid limit parameter: ${req.query.limit}. Must be a positive number.`;
      console.error(`[${requestId}] ${errorMsg}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid limit parameter. Must be a positive number.',
        requestId,
        receivedLimit: req.query.limit
      });
    }
    
    console.log(`[${requestId}] Fetching up to ${limit} upcoming events`);
    
    // Get upcoming events from the model
    const events = await Event.getUpcomingEvents(limit);
    
    if (!Array.isArray(events)) {
      console.error(`[${requestId}] Expected events to be an array, got:`, typeof events);
      return res.status(500).json({
        status: 'error',
        message: 'Unexpected response format from database',
        requestId
      });
    }
    
    console.log(`[${requestId}] Found ${events.length} upcoming events`);
    
    // Format the events data to ensure consistent structure
    const formattedEvents = events.map(event => ({
      id: event.id,
      name: event.name || 'Unnamed Event',
      description: event.description || '',
      location: event.location || 'Location not specified',
      start_date: event.start_date,
      end_date: event.end_date,
      image_url: event.image_url || '/images/default-event.jpg',
      status: event.status || 'draft',
      ticket_quantity: parseInt(event.ticket_quantity || '0', 10),
      available_tickets: parseInt(event.available_tickets || '0', 10),
      ticket_price: parseFloat(event.ticket_price || '0'),
      organizer_id: event.organizer_id,
      created_at: event.created_at,
      updated_at: event.updated_at,
      // Include any additional fields that might be needed by the frontend
      ...(event.ticket_types && { ticket_types: event.ticket_types })
    }));
    
    console.log(`[${requestId}] Successfully retrieved ${formattedEvents.length} upcoming events`);
    
    // Return the formatted events
    return res.status(200).json(formattedEvents);
    
  } catch (error) {
    console.error(`[${requestId}] Error in getUpcomingEvents:`, {
      message: error.message,
      stack: error.stack,
      originalUrl: req.originalUrl,
      query: req.query
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching upcoming events',
      requestId,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getDashboardEvents = async (req, res) => {
  try {
    const { 
      status = 'upcoming',
      limit = 5,
      sort = 'start_date',
      order = 'asc',
      search = ''
    } = req.query;

    // Convert limit to number and validate
    const limitNum = Math.min(parseInt(limit, 10) || 5, 50);
    
    // Validate sort field
    const validSortFields = ['start_date', 'created_at', 'name'];
    const sortField = validSortFields.includes(sort) ? sort : 'start_date';
    
    // Validate order
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    // Get organizer ID from authenticated user
    const organizerId = req.user.id;

    // Build the base query to get events with basic info
    let query = `
      SELECT e.*
      FROM events e
      WHERE e.organizer_id = $1
    `;

    const queryParams = [organizerId];
    let paramCount = 2;

    // Add status filter
    if (status === 'upcoming') {
      query += ` AND e.end_date >= NOW()`;
    } else if (status === 'past') {
      query += ` AND e.end_date < NOW()`;
    } else if (status === 'draft') {
      query += ` AND e.status = 'draft'`;
    } else if (status === 'published') {
      query += ` AND e.status = 'published'`;
    }

    // Add search filter
    if (search) {
      query += ` AND (LOWER(e.name) LIKE $${paramCount} OR LOWER(e.description) LIKE $${paramCount})`;
      queryParams.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    // Add sorting
    query += ` ORDER BY e.${sortField} ${sortOrder}`;
    
    // Add limit
    query += ` LIMIT $${paramCount}`;
    queryParams.push(limitNum);

    // Execute the query to get events
    const { rows: events } = await pool.query(query, queryParams);
    
    if (events.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { events: [] }
      });
    }
    
    // Get event IDs for batch querying ticket types and counts
    const eventIds = events.map(event => event.id);
    
    // Get ticket types for all events
    const ticketTypesQuery = `
      SELECT 
        tt.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status = 'paid') as sold
      FROM ticket_types tt
      WHERE tt.event_id = ANY($1)
    `;
    
    const { rows: allTicketTypes } = await pool.query(ticketTypesQuery, [eventIds]);
    
    // Group ticket types by event ID
    const ticketTypesByEvent = {};
    allTicketTypes.forEach(tt => {
      if (!ticketTypesByEvent[tt.event_id]) {
        ticketTypesByEvent[tt.event_id] = [];
      }
      ticketTypesByEvent[tt.event_id].push({
        ...tt,
        sold: parseInt(tt.sold || '0', 10),
        quantity: parseInt(tt.quantity || '0', 10),
        available: Math.max(0, (parseInt(tt.quantity || '0', 10) - parseInt(tt.sold || '0', 10)))
      });
    });
    
    // Get ticket counts for events without ticket types
    const eventsWithoutTicketTypes = events.filter(e => !ticketTypesByEvent[e.id] || ticketTypesByEvent[e.id].length === 0);
    if (eventsWithoutTicketTypes.length > 0) {
      const eventIdsWithoutTypes = eventsWithoutTicketTypes.map(e => e.id);
      const ticketCountsQuery = `
        SELECT 
          event_id,
          COUNT(*) as total_tickets_sold,
          COALESCE(SUM(price), 0) as total_revenue
        FROM tickets 
        WHERE event_id = ANY($1) AND status = 'paid'
        GROUP BY event_id
      `;
      
      const { rows: ticketCounts } = await pool.query(ticketCountsQuery, [eventIdsWithoutTypes]);
      
      // Add default ticket types for events without ticket types
      ticketCounts.forEach(count => {
        const event = events.find(e => e.id === count.event_id);
        if (event) {
          ticketTypesByEvent[event.id] = [{
            id: 'default',
            event_id: event.id,
            name: 'General Admission',
            description: 'General admission ticket',
            price: parseFloat(event.ticket_price || '0'),
            quantity: parseInt(event.ticket_quantity || '0', 10),
            sold: parseInt(count.total_tickets_sold || '0', 10),
            available: Math.max(0, (parseInt(event.ticket_quantity || '0', 10) - parseInt(count.total_tickets_sold || '0', 10))),
            sales_start_date: null,
            sales_end_date: null,
            is_default: true
          }];
        }
      });
    }
    
    // Enrich events with ticket type information
    const enrichedEvents = events.map(event => {
      const ticketTypes = ticketTypesByEvent[event.id] || [];
      
      // Calculate totals from ticket types
      const totals = ticketTypes.reduce((acc, tt) => ({
        sold: acc.sold + (parseInt(tt.sold) || 0),
        available: acc.available + (parseInt(tt.available) || 0),
        revenue: acc.revenue + ((parseInt(tt.sold) || 0) * parseFloat(tt.price || 0))
      }), { sold: 0, available: 0, revenue: 0 });
      
      // Add calculated fields to the event
      return {
        ...event,
        tickets_sold: totals.sold,
        available_tickets: totals.available,
        total_revenue: totals.revenue,
        ticket_types: ticketTypes,
        // For backward compatibility, set ticket_quantity to the sum of ticket type quantities
        ticket_quantity: ticketTypes.length > 0 ? 
          ticketTypes.reduce((sum, tt) => sum + (parseInt(tt.quantity) || 0), 0) :
          parseInt(event.ticket_quantity || '0', 10)
      };
    });

    res.status(200).json({
      status: 'success',
      results: enrichedEvents.length,
      data: {
        events: enrichedEvents
      }
    });
  } catch (error) {
    console.error('Get dashboard events error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching dashboard events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get ticket types for an event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getEventTicketTypes = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Event ID is required'
      });
    }

    // Get the event with ticket types
    const event = await Event.getPublicEvent(eventId);

    if (!event) {
      return res.status(404).json({
        status: 'fail',
        message: 'Event not found'
      });
    }

    // Get tickets sold count for each ticket type
    const ticketTypesWithAvailability = await Promise.all(
      event.ticket_types.map(async (tt) => {
        const soldResult = await pool.query(
          'SELECT COUNT(*) as sold FROM tickets WHERE ticket_type_id = $1',
          [tt.id]
        );
        
        const sold = parseInt(soldResult.rows[0].sold, 10) || 0;
        const maxQuantity = parseInt(tt.quantity || '0', 10);
        const available = Math.max(0, maxQuantity - sold);
        
        return {
          id: tt.id,
          name: tt.name,
          description: tt.description || '',
          price: parseFloat(tt.price) || 0,
          quantity: maxQuantity,
          sold: sold,
          available: available,
          is_sold_out: available <= 0,
          sales_start_date: tt.sales_start_date || null,
          sales_end_date: tt.sales_end_date || null,
          is_default: tt.is_default || false
        };
      })
    );

    // Format the response
    const response = {
      status: 'success',
      data: {
        event: {
          id: event.id,
          name: event.name,
          start_date: event.start_date,
          end_date: event.end_date,
          ticket_types: ticketTypesWithAvailability
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting event ticket types:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching event ticket types'
    });
  }
};

export const getPublicEvent = async (req, res) => {
  const requestId = req.id || 'no-request-id';
  
  console.log(`[${requestId}] === getPublicEvent controller called ===`);
  console.log(`[${requestId}] Request URL: ${req.originalUrl}`);
  console.log(`[${requestId}] Request params:`, req.params);
  
  const { eventId } = req.params;
  
  // Validate event ID
  if (!eventId || isNaN(parseInt(eventId, 10))) {
    const errorMsg = `Invalid event ID provided to getPublicEvent: ${eventId}`;
    console.error(`[${requestId}] ${errorMsg}`);
    return res.status(400).json({
      status: 'error',
      message: 'Invalid event ID format. Please provide a valid numeric event ID.',
      requestId,
      receivedId: eventId
    });
  }
  
  const numericEventId = parseInt(eventId, 10);
  
  try {
    console.log(`[${requestId}] Fetching public event with ID: ${numericEventId}`);
    const event = await Event.getPublicEvent(numericEventId);
    
    if (!event) {
      console.log(`[${requestId}] Event not found or not published for ID: ${numericEventId}`);
      return res.status(404).json({
        status: 'error',
        message: 'Event not found or not published',
        eventId: numericEventId,
        requestId
      });
    }
    
    // Ensure required fields exist
    const formattedEvent = {
      ...event,
      id: event.id || numericEventId,
      name: event.name || 'Unnamed Event',
      description: event.description || '',
      image_url: event.image_url || '/images/default-event.jpg',
      location: event.location || 'Location not specified',
      start_date: event.start_date,
      end_date: event.end_date,
      status: event.status || 'draft',
      ticket_quantity: parseInt(event.ticket_quantity || '0', 10),
      available_tickets: parseInt(event.available_tickets || event.ticket_quantity || '0', 10),
      ticket_price: parseFloat(event.ticket_price || '0'),
      created_at: event.created_at,
      updated_at: event.updated_at,
      organizer_id: event.organizer_id
    };
    
    console.log(`[${requestId}] Successfully retrieved event: ${formattedEvent.name} (ID: ${formattedEvent.id})`);
    return res.status(200).json(formattedEvent);
    
  } catch (error) {
    console.error(`[${requestId}] Error in getPublicEvent:`, {
      message: error.message,
      stack: error.stack,
      eventId: numericEventId,
      originalUrl: req.originalUrl
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching the event',
      requestId,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

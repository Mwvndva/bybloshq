import { query } from '../config/database.js';

import { AppError } from '../utils/errorHandler.js';

export default class TicketRepository {
  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Object>} Created ticket
   */
  static async createTicket(ticketData) {
    const {
      event_id,
      organizer_id,
      customer_name,
      customer_email,
      ticket_type,
      price,
      status = 'pending',
      metadata = {}
    } = ticketData;

    const sql = `
      INSERT INTO tickets (
        event_id,
        organizer_id,
        customer_name,
        customer_email,
        ticket_type_name,
        price,
        status,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      event_id,
      organizer_id,
      customer_name,
      customer_email,
      ticket_type,
      price,
      status,
      metadata
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Get tickets by organizer ID
   * @param {number} organizerId - Organizer ID
   * @param {number} limit - Limit number of results (default: 1000)
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Object containing tickets and total count
   */
  static async getTicketsByOrganizer(organizerId, limit = 1000, offset = 0) {
    // First get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.organizer_id = $1
    `;
    
    // Then get paginated results
    const ticketsQuery = `
      SELECT 
        t.*, 
        e.name as event_name,
        e.start_date as event_start_date,
        e.end_date as event_end_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.organizer_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    console.log('=== TicketRepository.getTicketsByOrganizer ===');
    console.log('organizerId:', organizerId, 'limit:', limit, 'offset:', offset);
    
    console.log('Executing count query:', countQuery, [organizerId]);
    console.log('Executing tickets query:', ticketsQuery, [organizerId, limit, offset]);

    try {
      const [countResult, ticketsResult] = await Promise.all([
        query(countQuery, [organizerId]),
        query(ticketsQuery, [organizerId, limit, offset])
      ]);
      
      console.log('Tickets query result count:', ticketsResult.rows.length);
      console.log('Total tickets count:', countResult.rows[0].total);
      
      if (ticketsResult.rows.length > 0) {
        console.log('Sample ticket from query:', ticketsResult.rows[0]);
      }
      
      return {
        tickets: ticketsResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset
      };
    } catch (error) {
      console.error('Error fetching tickets by organizer:', error);
      throw new Error('Failed to fetch tickets');
    }
  }

  /**
   * Get all tickets for a specific event without pagination
   * @param {number} eventId - Event ID
   * @param {number} organizerId - Organizer ID (for security)
   * @returns {Promise<Array>} List of tickets
   */
  static async getAllTicketsForEvent(eventId, organizerId) {
    console.log('=== TicketRepository.getAllTicketsForEvent ===');
    console.log('eventId:', eventId, 'organizerId:', organizerId);
    
    const queryText = `
      SELECT 
        t.*, 
        e.name as event_name,
        e.start_date as event_start_date,
        e.end_date as event_end_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.event_id = $1 AND t.organizer_id = $2
      ORDER BY t.created_at DESC
    `;

    try {
      console.log('Executing query:', queryText, [eventId, organizerId]);
      const result = await query(queryText, [eventId, organizerId]);
      console.log(`Found ${result.rows.length} tickets for event ${eventId}`);
      if (result.rows.length > 0) {
        console.log('Sample ticket from query:', result.rows[0]);
      }
      return result.rows;
    } catch (error) {
      console.error('Error fetching all tickets for event:', error);
      throw new Error('Failed to fetch all tickets for event');
    }
  }

  /**
   * Get tickets by event ID with pagination
   * @param {number} eventId - Event ID
   * @param {number} organizerId - Organizer ID (for security)
   * @param {number} limit - Limit number of results (default: 1000)
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Object containing tickets and total count
   */
  static async getTicketsByEvent(eventId, organizerId, limit = 1000, offset = 0) {
    // First get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.event_id = $1 AND t.organizer_id = $2
    `;
    
    // Then get paginated results
    const ticketsQuery = `
      SELECT 
        t.*, 
        e.name as event_name,
        e.start_date as event_start_date,
        e.end_date as event_end_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.event_id = $1 AND t.organizer_id = $2
      ORDER BY t.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    try {
      const [countResult, ticketsResult] = await Promise.all([
        query(countQuery, [eventId, organizerId]),
        query(ticketsQuery, [eventId, organizerId, limit, offset])
      ]);
      
      return {
        tickets: ticketsResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset
      };
    } catch (error) {
      console.error('Error fetching tickets by event:', error);
      throw new Error('Failed to fetch event tickets');
    }
  }

  /**
   * Get ticket by ID
   * @param {number} ticketId - Ticket ID
   * @param {number} organizerId - Organizer ID (for security)
   * @returns {Promise<Object|null>} Ticket or null if not found
   */
  /**
   * Get all tickets for a specific event without pagination
   * @param {number} eventId - Event ID
   * @param {number} organizerId - Organizer ID (for security)
   * @returns {Promise<Array>} List of tickets
   */
  static async getAllTicketsForEvent(eventId, organizerId) {
    const sql = `
      SELECT 
        t.*, 
        e.name as event_name,
        e.start_date as event_start_date,
        e.end_date as event_end_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.event_id = $1 AND t.organizer_id = $2
      ORDER BY t.created_at DESC
    `;

    try {
      const result = await query(sql, [eventId, organizerId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all tickets for event:', error);
      throw new Error('Failed to fetch event tickets');
    }
  }

  /**
   * Get ticket by ID
   * @param {number} ticketId - Ticket ID
   * @param {number} organizerId - Organizer ID (for security)
   * @returns {Promise<Object|null>} Ticket or null if not found
   */
  static async getTicketById(ticketId, organizerId) {
    const sql = `
      SELECT t.*, e.name as event_name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.id = $1 AND t.organizer_id = $2
    `;

    const result = await query(sql, [ticketId, organizerId]);
    return result.rows[0] || null;
  }

  /**
   * Update ticket status
   * @param {number} ticketId - Ticket ID
   * @param {string} status - New status
   * @param {number} organizerId - Organizer ID (for security)
   * @returns {Promise<Object>} Updated ticket
   */
  static async updateTicketStatus(ticketId, status, organizerId) {
    const sql = `
      UPDATE tickets
      SET status = $1
      WHERE id = $2 AND organizer_id = $3
      RETURNING *
    `;

    const result = await query(sql, [status, ticketId, organizerId]);
    return result.rows[0];
  }

  /**
   * Get ticket statistics for an organizer
   * @param {number} organizerId - Organizer ID
   * @returns {Promise<Object>} Ticket statistics
   */
  static async getTicketStats(organizerId) {
    const sql = `
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tickets,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_tickets,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN price ELSE 0 END), 0) as total_revenue
      FROM tickets
      WHERE organizer_id = $1
    `;

    const result = await query(sql, [organizerId]);
    return result.rows[0];
  }

  /**
   * Find a ticket by ticket number
   * @param {string} ticketNumber - The ticket number to find
   * @returns {Promise<Object|null>} The found ticket or null if not found
   */
  static async findByTicketNumber(ticketNumber) {
    const sql = `
      SELECT t.*, e.name as event_name
      FROM tickets t
      LEFT JOIN events e ON t.event_id = e.id
      WHERE t.ticket_number = $1
    `;
    
    const result = await query(sql, [ticketNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const ticket = result.rows[0];
    
    // Format the ticket object to match the expected structure
    return {
      ...ticket,
      event: {
        id: ticket.event_id,
        name: ticket.event_name
      }
    };
  }

  /**
   * Mark a ticket as scanned
   * @param {number} ticketId - The ID of the ticket to mark as scanned
   * @returns {Promise<Object>} The updated ticket
   */
  static async markAsScanned(ticketId) {
    try {
      console.log(`Marking ticket ${ticketId} as scanned...`);
      
      // Use a single atomic query to check and update the ticket
      const sql = `
        WITH current_ticket AS (
          SELECT * FROM tickets WHERE id = $1 FOR UPDATE
        ),
        updated_ticket AS (
          UPDATE tickets 
          SET 
            scanned = true,
            scanned_at = CASE 
              WHEN NOT current_ticket.scanned THEN NOW() 
              ELSE current_ticket.scanned_at 
            END,
            updated_at = NOW(),
            status = 'paid'
          FROM current_ticket
          WHERE tickets.id = $1 
            AND NOT current_ticket.scanned
          RETURNING tickets.*
        )
        SELECT * FROM updated_ticket
        UNION ALL
        SELECT * FROM current_ticket 
        WHERE NOT EXISTS (SELECT 1 FROM updated_ticket)
      `;
      
      const result = await query(sql, [ticketId]);
      
      if (result.rows.length === 0) {
        throw new Error('Ticket not found');
      }
      
      const ticket = result.rows[0];
      
      if (ticket.scanned_at) {
        console.log(`Successfully marked ticket ${ticketId} as scanned`);
      } else {
        console.log(`Ticket ${ticketId} was already scanned at ${ticket.scanned_at}`);
      }
      
      console.log(`Successfully marked ticket ${ticketId} as scanned`);
      return result.rows[0];
      
    } catch (error) {
      console.error(`Error marking ticket ${ticketId} as scanned:`, error);
      throw error; // Re-throw to be handled by the controller
    }
  }
}

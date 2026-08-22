import { pool } from '../config/database.js';

class Ticket {
  static async create(ticketData) {
    const { 
      name, description, price, quantity_available, 
      event_id, organizer_id, min_per_order = 1, 
      max_per_order, sales_start_date, sales_end_date, 
      is_active = true, metadata = null 
    } = ticketData;

    const query = `
      INSERT INTO tickets (
        name, description, price, quantity_available, 
        event_id, organizer_id, min_per_order, 
        max_per_order, sales_start_date, sales_end_date, 
        is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      name, description, price, quantity_available,
      event_id, organizer_id, min_per_order,
      max_per_order, sales_start_date, sales_end_date,
      is_active, metadata
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    return rows[0];
  }

  static async findByEventId(eventId) {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE event_id = $1', [eventId]);
    return rows;
  }

  static async update(id, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const values = Object.values(updates);
    values.push(id);
    
    const query = `
      UPDATE tickets 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }

  // Instance methods
  static async isAvailable(ticketId) {
    const ticket = await this.findById(ticketId);
    return ticket && ticket.quantity_available > 0;
  }

  static async isOnSale(ticketId) {
    const ticket = await this.findById(ticketId);
    if (!ticket || !ticket.is_active) return false;

    const now = new Date();
    const startDateValid = !ticket.sales_start_date || new Date(ticket.sales_start_date) <= now;
    const endDateValid = !ticket.sales_end_date || new Date(ticket.sales_end_date) >= now;
    
    return startDateValid && endDateValid;
  }
}

export default Ticket;

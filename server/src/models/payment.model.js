import { pool } from '../config/database.js';

class Payment {
  static async create(paymentData) {
    const {
      invoice_id,
      amount,
      currency = 'KES',
      status = 'pending',
      payment_method = 'mpesa',
      phone_number = null,
      email = null,
      ticket_id = null,
      ticket_type_id = null,  // New field
      event_id = null,
      organizer_id = null,
      metadata = null
    } = paymentData;

    // Build the query dynamically based on provided fields
    const fields = [
      'invoice_id', 'amount', 'currency', 'status', 'payment_method',
      'phone_number', 'email', 'ticket_id', 'ticket_type_id', 'event_id', 'organizer_id', 'metadata'
    ];
    
    // Only include fields that are not null/undefined
    const providedFields = fields.filter(field => paymentData[field] !== undefined && paymentData[field] !== null);
    
    const placeholders = providedFields.map((_, i) => `$${i + 1}`).join(', ');
    const fieldList = providedFields.join(', ');
    
    const query = `
      INSERT INTO payments (${fieldList})
      VALUES (${placeholders})
      RETURNING *
    `;

    const values = providedFields.map(field => {
      // Handle metadata serialization if needed
      if (field === 'metadata' && paymentData[field] && typeof paymentData[field] === 'object') {
        return JSON.stringify(paymentData[field]);
      }
      return paymentData[field];
    });

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findByInvoiceId(invoiceId) {
    const { rows } = await pool.query(`
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, phone_number, email, ticket_type_id,
        event_id, organizer_id, metadata, created_at, updated_at
      FROM payments 
      WHERE invoice_id = $1
    `, [invoiceId]);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    return rows[0];
  }

  static async updateStatus(invoiceId, status, metadata = null) {
    let query;
    let values;
    
    if (metadata) {
      query = `
        UPDATE payments 
        SET status = $1, 
            metadata = $2,
            updated_at = NOW()
        WHERE invoice_id = $3
        RETURNING *
      `;
      values = [status, metadata, invoiceId];
    } else {
      query = `
        UPDATE payments 
        SET status = $1, 
            updated_at = NOW()
        WHERE invoice_id = $2
        RETURNING *
      `;
      values = [status, invoiceId];
    }
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findByEventId(eventId) {
    const { rows } = await pool.query('SELECT * FROM payments WHERE event_id = $1', [eventId]);
    return rows;
  }

  static async findByOrganizerId(organizerId) {
    const { rows } = await pool.query('SELECT * FROM payments WHERE organizer_id = $1', [organizerId]);
    return rows;
  }

  static async getTotalSalesByEvent(eventId) {
    const { rows } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_sales FROM payments WHERE event_id = $1 AND status = $2',
      [eventId, 'completed']
    );
    return parseFloat(rows[0].total_sales) || 0;
  }

  static async update(id, updateData) {
    const fields = Object.keys(updateData);
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map(field => {
      // Handle metadata serialization if needed
      if (field === 'metadata' && updateData[field] && typeof updateData[field] === 'object') {
        return JSON.stringify(updateData[field]);
      }
      return updateData[field];
    });
    
    values.push(id); // Add ID as the last parameter
    
    const query = `
      UPDATE payments 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }
}

export default Payment;

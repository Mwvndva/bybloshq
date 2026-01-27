import { pool } from '../config/database.js';

class Payment {
  /**
   * Insert a new payment record
   */
  static async insert(client, data) {
    const fields = Object.keys(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      INSERT INTO payments (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const values = fields.map(f => typeof data[f] === 'object' && data[f] !== null ? JSON.stringify(data[f]) : data[f]);

    // Support both pool and client (for transactions)
    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  static async findByInvoiceId(invoiceId) {
    const { rows } = await pool.query(`
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        event_id, organizer_id, ticket_type_id, ticket_id,
        metadata, created_at, updated_at
      FROM payments 
      WHERE invoice_id = $1
    `, [invoiceId]);
    return rows[0];
  }

  static async findByReference(reference) {
    const { rows } = await pool.query(`
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        event_id, organizer_id, ticket_type_id, ticket_id,
        metadata, created_at, updated_at,
        provider_reference, api_ref
      FROM payments 
      WHERE provider_reference = $1 OR api_ref = $1
    `, [reference]);
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
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE invoice_id = $3
        RETURNING *
      `;
      values = [status, typeof metadata === 'string' ? metadata : JSON.stringify(metadata), invoiceId];
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

  static async update(client, id, updateData) {
    const fields = Object.keys(updateData);
    if (fields.length === 0) return null;

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map(field => {
      if (field === 'metadata' && updateData[field] && typeof updateData[field] === 'object') {
        return JSON.stringify(updateData[field]);
      }
      return updateData[field];
    });

    values.push(id);

    const query = `
      UPDATE payments 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;

    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }
}

export default Payment;

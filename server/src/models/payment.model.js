import { pool } from '../config/database.js';
import { toJsonb } from '../utils/order.utils.js';

class Payment {
  /**
   * RULE 2 — NO DYNAMIC SQL
   * Static insert for payment records.
   */
  static async insert(client, data) {
    const query = `
      INSERT INTO payments (
        invoice_id, amount, currency, status, payment_method, 
        mobile_payment, whatsapp_number, email, metadata, 
        provider_reference, api_ref, mpesa_receipt, raw_response, 
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb, NOW(), NOW()
      )
      RETURNING *
    `;

    const values = [
      data.invoice_id,                                  // $1
      data.amount,                                      // $2
      data.currency || 'KES',                           // $3
      data.status || 'pending',                         // $4
      data.payment_method || 'mpesa',                   // $5
      data.mobile_payment || null,                      // $6
      data.whatsapp_number || null,                     // $7
      data.email || null,                               // $8
      toJsonb(data.metadata || {}),                     // $9 (JSONB)
      data.provider_reference || null,                   // $10
      data.api_ref || null,                             // $11
      data.mpesa_receipt || null,                       // $12 (VARCHAR)
      toJsonb(data.raw_response || null)                // $13 (JSONB)
    ];

    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  static async findByInvoiceId(invoiceId) {
    const query = `
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        metadata, created_at, updated_at
      FROM payments 
      WHERE invoice_id = $1
    `;
    const { rows } = await pool.query(query, [invoiceId]);
    return rows[0];
  }

  static async findByReference(reference) {
    const query = `
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        metadata, created_at, updated_at,
        provider_reference, api_ref
      FROM payments 
      WHERE provider_reference = $1 OR api_ref = $1
    `;
    const { rows } = await pool.query(query, [reference]);
    return rows[0];
  }

  static async findByOrderReference(client, orderNumber, orderId) {
    const query = "SELECT id FROM payments WHERE invoice_id = $1 OR metadata->>'order_id' = $2::text LIMIT 1";
    const executor = client || pool;
    const { rows } = await executor.query(query, [orderNumber, String(orderId)]);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM payments WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async updateStatus(invoiceId, status, metadata = null) {
    const query = metadata ? `
      UPDATE payments 
      SET status = $1, 
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
      WHERE invoice_id = $3
      RETURNING *
    ` : `
      UPDATE payments 
      SET status = $1, 
          updated_at = NOW()
      WHERE invoice_id = $2
      RETURNING *
    `;

    const values = metadata
      ? [status, toJsonb(metadata), invoiceId]
      : [status, invoiceId];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * RULE 2 — NO DYNAMIC SQL
   * Static update for updatable payment fields.
   */
  static async update(client, id, data) {
    const query = `
      UPDATE payments 
      SET 
        status = COALESCE($1, status),
        metadata = COALESCE($2::jsonb, metadata),
        provider_reference = COALESCE($3, provider_reference),
        api_ref = COALESCE($4, api_ref),
        mpesa_receipt = COALESCE($5, mpesa_receipt),
        raw_response = COALESCE($6::jsonb, raw_response),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const values = [
      data.status ?? null,                             // $1
      data.metadata ? toJsonb(data.metadata) : null,   // $2
      data.provider_reference ?? null,                 // $3
      data.api_ref ?? null,                           // $4
      data.mpesa_receipt ?? null,                      // $5 (VARCHAR)
      data.raw_response ? toJsonb(data.raw_response) : null,   // $6
      id                                              // $7
    ];

    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  static async findByIdentifier(identifier) {
    const query = `
      SELECT * FROM payments 
      WHERE id::text = $1 
         OR provider_reference = $1 
         OR invoice_id = $1 
         OR api_ref = $1 
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [String(identifier)]);
    return rows[0];
  }

  static async updateMetadata(id, metadataUpdate) {
    const query = `
      UPDATE payments 
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [toJsonb(metadataUpdate), id]);
    return rows[0];
  }

  static async updateReference(id, reference) {
    const query = `
      UPDATE payments 
      SET provider_reference = $1, 
          api_ref = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [reference, id]);
    return rows[0];
  }

  static async findPending(hoursAgo = 24, limit = 50) {
    const query = `
      SELECT * FROM payments
      WHERE status = 'pending'
        AND created_at > NOW() - ($1 * INTERVAL '1 hour')
        AND created_at < NOW() - INTERVAL '1 minute'
      ORDER BY created_at ASC
      LIMIT $2
    `;
    const { rows } = await pool.query(query, [hoursAgo, limit]);
    return rows;
  }
}

export default Payment;


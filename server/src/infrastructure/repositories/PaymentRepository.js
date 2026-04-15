import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class PaymentRepository extends BaseRepository {
    constructor(db) {
        super('payments', db);
    }

    async insert(data, client = this.db) {
        const fields = Object.keys(data);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        const query = `
      INSERT INTO payments (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
        const values = fields.map(f => typeof data[f] === 'object' && data[f] !== null ? JSON.stringify(data[f]) : data[f]);

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async findByInvoiceId(invoiceId, client = this.db) {
        const query = `
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        metadata, created_at, updated_at, provider_reference, api_ref
      FROM payments 
      WHERE invoice_id = $1
    `;
        const result = await client.query(query, [invoiceId]);
        return toCamelCase(result.rows[0]);
    }

    async findByReference(reference, client = this.db) {
        const query = `
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        metadata, created_at, updated_at,
        provider_reference, api_ref
      FROM payments 
      WHERE provider_reference = $1 OR api_ref = $1
    `;
        const result = await client.query(query, [reference]);
        return toCamelCase(result.rows[0]);
    }

    async findByReferenceWithLock(reference, client = this.db) {
        const query = `
      SELECT 
        id, invoice_id, amount, currency, status, 
        payment_method, mobile_payment, whatsapp_number, email,
        metadata, created_at, updated_at,
        provider_reference, api_ref
      FROM payments 
      WHERE provider_reference = $1 OR api_ref = $1
      FOR UPDATE
    `;
        const result = await client.query(query, [reference]);
        return toCamelCase(result.rows[0]);
    }
    async updateStatus(invoiceId, status, metadata = null, client = this.db) {
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

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async update(id, updateData, client = this.db) {
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

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async updateProviderReference(id, reference, client = this.db) {
        const query = `
      UPDATE payments 
      SET provider_reference = $1, api_ref = $1, updated_at = NOW() 
      WHERE id = $2
      RETURNING *
    `;
        const result = await client.query(query, [reference, id]);
        return result.rows[0];
    }

    async findPendingCompletions(limit = 20) {
        const { rows } = await this.db.query(
            `SELECT * FROM payments
       WHERE status = 'completed'
       AND metadata->>'needs_completion' = 'true'
       AND updated_at > NOW() - INTERVAL '24 hours'
       ORDER BY updated_at ASC
       LIMIT $1`,
            [limit]
        );
        return rows;
    }

    async clearCompletionFlag(id) {
        await this.db.query(
            `UPDATE payments
       SET metadata = metadata - 'needs_completion'
       WHERE id = $1`,
            [id]
        );
    }

    async findPendingByTimeRange(hoursAgo, limit) {
        const { rows } = await this.db.query(
            `SELECT * FROM payments
       WHERE status = 'pending'
       AND created_at > NOW() - ($1 * INTERVAL '1 hour')
       ORDER BY created_at ASC
       LIMIT $2`,
            [hoursAgo, limit]
        );
        return rows;
    }
}

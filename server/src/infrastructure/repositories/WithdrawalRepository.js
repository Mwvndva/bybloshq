import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class WithdrawalRepository extends BaseRepository {
  constructor(db) {
    super('withdrawal_requests', db);
  }

  async create(data, client = this.db) {
    const { sellerId, amount, mpesaNumber, mpesaName, status = 'processing', apiCallPending = true } = data;
    const query = `
      INSERT INTO withdrawal_requests 
        (seller_id, amount, mpesa_number, mpesa_name, status, api_call_pending, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, amount, mpesa_number, mpesa_name, status, created_at
    `;
    const result = await client.query(query, [sellerId, amount, mpesaNumber, mpesaName, status, apiCallPending]);
    return toCamelCase(result.rows[0]);
  }

  async findByIdWithLock(id, client = this.db) {
    const query = `
      SELECT wr.*, s.whatsapp_number as entity_phone 
      FROM withdrawal_requests wr 
      LEFT JOIN sellers s ON wr.seller_id = s.id
      WHERE wr.id = $1 FOR UPDATE OF wr
    `;
    const result = await client.query(query, [id]);
    return toCamelCase(result.rows[0]);
  }

  async findByProviderReference(reference, client = this.db) {
    const query = 'SELECT * FROM withdrawal_requests WHERE provider_reference = $1';
    const result = await client.query(query, [reference]);
    return toCamelCase(result.rows[0]);
  }

  async updateStatus(id, newStatus, { providerReference = null, metadata = {} } = {}, client = this.db) {
    const query = `
      UPDATE withdrawal_requests 
      SET status = $1, 
          processed_at = NOW(),
          provider_reference = COALESCE($2, provider_reference),
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
      WHERE id = $4
      RETURNING *
    `;
    const result = await client.query(query, [newStatus, providerReference, JSON.stringify(metadata), id]);
    return toCamelCase(result.rows[0]);
  }

  async updateProviderInfo(id, reference, rawResponse, client = this.db) {
    const query = `
      UPDATE withdrawal_requests 
      SET provider_reference = $1, raw_response = $2, api_call_pending = FALSE
      WHERE id = $3
      RETURNING *
    `;
    const result = await client.query(query, [reference, JSON.stringify(rawResponse), id]);
    return toCamelCase(result.rows[0]);
  }

  async markApiCallFinished(id, rawResponse = null, client = this.db) {
    const query = 'UPDATE withdrawal_requests SET api_call_pending = FALSE, raw_response = $1 WHERE id = $2';
    await client.query(query, [rawResponse ? JSON.stringify(rawResponse) : null, id]);
  }

  async findPendingApiCalls(client = this.db) {
    const query = `
      SELECT wr.*, s.full_name, s.whatsapp_number
      FROM withdrawal_requests wr
      JOIN sellers s ON wr.seller_id = s.id
      WHERE wr.status = 'processing' 
        AND wr.api_call_pending = TRUE 
        AND wr.created_at > NOW() - INTERVAL '7 days'
    `;
    const result = await client.query(query);
    return result.rows.map(toCamelCase);
  }

  async findStuckWithdrawals(hoursAgo = 2, client = this.db) {
    const query = `
      SELECT wr.*, s.full_name as seller_name, s.whatsapp_number
      FROM withdrawal_requests wr
      LEFT JOIN sellers s ON wr.seller_id = s.id
      WHERE wr.status = 'processing'
        AND wr.created_at < NOW() - ($1 * INTERVAL '1 hour')
        AND wr.created_at > NOW() - INTERVAL '48 hours'
      ORDER BY wr.created_at ASC
    `;
    const result = await client.query(query, [hoursAgo]);
    return result.rows.map(toCamelCase);
  }

  async getWithdrawalsForSeller(sellerId, { limit = 20, offset = 0, status = null } = {}, client = this.db) {
    const params = [sellerId];
    const clauses = ['wr.seller_id = $1'];

    if (status) {
      params.push(status);
      clauses.push(`wr.status = $${params.length}`);
    }

    const where = clauses.join(' AND ');
    const query = `
      SELECT
        wr.id, wr.amount, wr.mpesa_number as "mpesaNumber", wr.mpesa_name as "mpesaName",
        wr.status, wr.provider_reference as "providerReference", wr.created_at as "createdAt",
        wr.processed_at as "processedAt",
        CASE
          WHEN wr.status = 'failed'
          THEN COALESCE(wr.metadata->>'api_error', wr.metadata->'payd_callback'->>'remarks', 'Unknown error')
          ELSE NULL
        END AS "failureReason",
        CASE
          WHEN wr.status = 'completed'
          THEN wr.metadata->'payd_callback'->>'third_party_trans_id'
          ELSE NULL
        END AS "mpesaReceipt"
      FROM withdrawal_requests wr
      WHERE ${where}
      ORDER BY wr.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM withdrawal_requests wr WHERE ${where}`;

    const [dataResult, countResult] = await Promise.all([
      client.query(query, [...params, limit, offset]),
      client.query(countQuery, params)
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10)
    };
  }

  async setReconciliationFlag(id, flag, client = this.db) {
    const query = `
      UPDATE withdrawal_requests 
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{reconciliation_flag}', $1::jsonb)
      WHERE id = $2
    `;
    await client.query(query, [JSON.stringify(flag), id]);
  }
}

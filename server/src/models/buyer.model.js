import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { toCamelCase } from '../utils/caseUtils.js';

class Buyer {
  /**
   * Internal helper for insertion to avoid duplication.
   */
  static async #insert(client, data) {
    const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, 
        city, location, latitude, longitude, full_address, user_id, 
        terms_accepted, terms_accepted_at,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        CASE WHEN $11 = true THEN NOW() ELSE NULL END, 
        NOW(), NOW()
      )
      RETURNING *
    `;
    const values = [
      data.fullName,          // $1
      data.email,             // $2
      data.mobilePayment,     // $3
      data.whatsappNumber,    // $4
      data.city,              // $5
      data.location,          // $6
      data.latitude,          // $7
      data.longitude,         // $8
      data.fullAddress,       // $9
      data.userId ?? null,    // $10
      data.termsAccepted ?? false // $11
    ];
    const { rows } = await (client || pool).query(query, values);
    return toCamelCase(rows[0]);
  }

  static async create(data, client = null) {
    return this.#insert(client, data);
  }

  static async createGuest(data, client = null) {
    return this.#insert(client, data);
  }

  static createInstance(row) {
    if (!row) return null;
    const buyer = new Buyer();
    Object.assign(buyer, toCamelCase(row));
    return buyer;
  }

  static async findByEmail(email) {
    if (!email) return null;
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE LOWER(email) = $1';
    const { rows } = await pool.query(query, [email.toLowerCase()]);
    return rows.length ? this.createInstance(rows[0]) : null;
  }

  static async findByPhone(phone) {
    if (!phone) return null;
    const normalized = phone.toString().replace(/\D/g, '');
    const phoneVariations = new Set([normalized]);

    if (normalized.startsWith('0') && normalized.length === 10) {
      phoneVariations.add('+254' + normalized.substring(1));
      phoneVariations.add('254' + normalized.substring(1));
    } else if (normalized.startsWith('254') && normalized.length === 12) {
      phoneVariations.add('+' + normalized);
      phoneVariations.add('0' + normalized.substring(3));
    } else if (normalized.length === 9) {
      phoneVariations.add('0' + normalized);
      phoneVariations.add('+254' + normalized);
      phoneVariations.add('254' + normalized);
    }

    const query = `
      SELECT *, user_id AS "userId" 
      FROM buyers 
      WHERE mobile_payment = ANY($1) OR whatsapp_number = ANY($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [Array.from(phoneVariations)]);
    return rows.length ? this.createInstance(rows[0]) : null;
  }

  static async findById(id) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows.length ? this.createInstance(rows[0]) : null;
  }

  static async findByUserId(userId) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE user_id = $1';
    const { rows } = await pool.query(query, [userId]);
    return rows.length ? this.createInstance(rows[0]) : null;
  }

  /**
   * RULE 2 — NO DYNAMIC SQL
   * Static update logic for verified fields.
   */
  static async update(id, data) {
    const query = `
      UPDATE buyers 
      SET 
        full_name = COALESCE($1, full_name),
        mobile_payment = COALESCE($2, mobile_payment),
        whatsapp_number = COALESCE($3, whatsapp_number),
        city = COALESCE($4, city),
        location = COALESCE($5, location),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        full_address = COALESCE($8, full_address),
        is_verified = COALESCE($9, is_verified),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `;

    const values = [
      data.fullName ?? null,    // $1
      data.mobilePayment ?? null, // $2
      data.whatsappNumber ?? null, // $3
      data.city ?? null,        // $4
      data.location ?? null,    // $5
      data.latitude ?? null,    // $6
      data.longitude ?? null,   // $7
      data.fullAddress ?? null, // $8
      data.isVerified ?? null,  // $9
      id                        // $10
    ];

    const { rows } = await pool.query(query, values);
    return rows.length ? toCamelCase(rows[0]) : null;
  }

  static async updateLocation(buyerId, { latitude, longitude, fullAddress }) {
    const query = `
      UPDATE buyers 
      SET latitude = $1, longitude = $2, full_address = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [latitude, longitude, fullAddress, buyerId]);
    return rows.length ? toCamelCase(rows[0]) : null;
  }

  static async updateUserId(buyerId, userId) {
    const query = 'UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL';
    await pool.query(query, [userId, buyerId]);
  }

  static async findByIdForUpdate(client, id) {
    const query = 'SELECT id, refunds FROM buyers WHERE id = $1 FOR UPDATE';
    const executor = client || pool;
    const { rows } = await executor.query(query, [id]);
    return rows[0];
  }

  static async adjustRefundBalance(client, id, amount) {
    const query = 'UPDATE buyers SET refunds = GREATEST(refunds + $1, 0), updated_at = NOW() WHERE id = $2';
    const executor = client || pool;
    await executor.query(query, [amount, id]);
  }
}

export default Buyer;


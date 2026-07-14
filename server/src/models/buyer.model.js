import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

// Convert snake_case to camelCase function
import { toCamelCase } from '../shared/utils/caseUtils.js';

class Buyer {
  // Create a new buyer
  static async create({ fullName, email, mobilePayment, whatsappNumber, city, location, latitude, longitude, fullAddress, userId = null, termsAccepted = false }, externalClient = null) {
    const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, 
        city, location, latitude, longitude, full_address, user_id, 
        terms_accepted, terms_accepted_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      fullName, email, mobilePayment, whatsappNumber,
      city, location, latitude, longitude, fullAddress, userId,
      termsAccepted
    ];
    const result = await (externalClient || pool).query(query, values);
    return toCamelCase(result.rows[0]);
  }

  static async createGuest({ fullName, email, mobilePayment, whatsappNumber, city, location, latitude, longitude, fullAddress, userId = null, termsAccepted = false }, externalClient = null) {
    const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, 
        city, location, latitude, longitude, full_address, user_id, 
        terms_accepted, terms_accepted_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      fullName, email, mobilePayment, whatsappNumber,
      city, location, latitude, longitude, fullAddress, userId,
      termsAccepted
    ];
    const result = await (externalClient || pool).query(query, values);
    return toCamelCase(result.rows[0]);
  }

  // Create a Buyer instance from database row
  static createInstance(row) {
    if (!row) return null;
    const buyer = new Buyer();
    Object.assign(buyer, toCamelCase(row));
    return buyer;
  }

  // Find buyer by email
  static async findByEmail(email) {
    if (!email) return null;
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE LOWER(email) = $1';
    const result = await pool.query(query, [email.toLowerCase()]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  static async findByPhone(phone) {
    if (!phone) return null;
    // Generate all possible phone formats to check
    let normalized = phone.toString().replace(/\D/g, ''); // Remove all non-digits

    const phoneVariations = new Set();
    phoneVariations.add(normalized);

    // 07XXXXXXXX -> +2547XXXXXXXX, 2547XXXXXXXX
    if (normalized.startsWith('0') && normalized.length === 10) {
      phoneVariations.add('+254' + normalized.substring(1));
      phoneVariations.add('254' + normalized.substring(1));
    }
    // 2547XXXXXXXX -> +2547XXXXXXXX, 07XXXXXXXX
    else if (normalized.startsWith('254') && normalized.length === 12) {
      phoneVariations.add('+' + normalized);
      phoneVariations.add('0' + normalized.substring(3));
    }
    // +2547XXXXXXXX -> 2547XXXXXXXX, 07XXXXXXXX
    else if (normalized.startsWith('254') && normalized.length === 12) {
      // already handled by Replace(\D)
    }
    // 7XXXXXXXX -> 07XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX
    else if (normalized.length === 9) {
      phoneVariations.add('0' + normalized);
      phoneVariations.add('+254' + normalized);
      phoneVariations.add('254' + normalized);
    }

    const query = `
      SELECT *, user_id AS "userId" 
      FROM buyers 
      WHERE mobile_payment = ANY($1) 
      OR whatsapp_number = ANY($1)
      LIMIT 1
    `;
    const result = await pool.query(query, [Array.from(phoneVariations)]);

    if (result.rows.length > 0) {
      // Log matched without actual value
      logger.debug('Found buyer with matched phone variation');
    }

    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by ID
  static async findById(id) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by user_id (for cross-role access)
  static async findByUserId(userId) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Update buyer
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Field name mapping from camelCase to snake_case
    const fieldMap = {
      fullName: 'full_name',
      mobilePayment: 'mobile_payment',
      whatsappNumber: 'whatsapp_number',
      city: 'city',
      location: 'location',
      latitude: 'latitude',
      longitude: 'longitude',
      fullAddress: 'full_address'
    };

    for (const [key, value] of Object.entries(updateData)) {
      // Skip password updates here - handle separately with updatePassword
      if (key === 'password') continue;

      const dbField = fieldMap[key];
      if (!dbField) continue;
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at
    fields.push('updated_at = NOW()');

    const query = `
      UPDATE buyers 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await pool.query(query, values);
    return result.rows.length ? toCamelCase(result.rows[0]) : null;
  }

  // Update buyer location coordinates
  static async updateLocation(buyerId, { latitude, longitude, fullAddress }) {
    const query = `
      UPDATE buyers 
      SET latitude = $1, longitude = $2, full_address = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [latitude, longitude, fullAddress, buyerId]);
    return result.rows.length ? toCamelCase(result.rows[0]) : null;
  }



  // Soft-delete: anonymise PII and deactivate the auth account so the buyer can
  // no longer sign in, while preserving legally-retained transaction records.
  static async softDeleteAccount(buyerId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tombstone = `deleted_buyer_${userId || buyerId}_${Date.now()}@deleted.byblos`;
      await client.query(
        `UPDATE buyers SET full_name = 'Deleted user', email = $1, mobile_payment = 'deleted',
           whatsapp_number = NULL, city = NULL, location = NULL, latitude = NULL, longitude = NULL,
           full_address = NULL, updated_at = NOW() WHERE id = $2`,
        [tombstone, buyerId]
      );
      if (userId) {
        await client.query(
          "UPDATE users SET is_active = FALSE, email = $1, password_hash = 'DELETED' WHERE id = $2",
          [tombstone, userId]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Buyer.softDeleteAccount failed', { buyerId, userId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }
}

export default Buyer;




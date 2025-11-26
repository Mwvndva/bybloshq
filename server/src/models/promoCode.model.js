import { pool } from '../config/database.js';

const PromoCode = {
  /**
   * Create a new promo code
   */
  async create(promoCodeData) {
    const {
      event_id,
      organizer_id,
      code,
      description,
      discount_type = 'percentage',
      discount_value,
      max_uses = null,
      min_purchase_amount = 0,
      valid_from = new Date(),
      valid_until = null,
      is_active = true
    } = promoCodeData;

    const result = await pool.query(
      `INSERT INTO promo_codes (
        event_id, organizer_id, code, description, discount_type, 
        discount_value, max_uses, min_purchase_amount, 
        valid_from, valid_until, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        event_id, organizer_id, code.toUpperCase().trim(), description,
        discount_type, discount_value, max_uses, min_purchase_amount,
        valid_from, valid_until, is_active
      ]
    );
    return result.rows[0];
  },

  /**
   * Find promo code by ID
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT * FROM promo_codes WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find promo code by code and event
   */
  async findByCode(eventId, code) {
    const result = await pool.query(
      `SELECT * FROM promo_codes 
       WHERE event_id = $1 AND code = $2`,
      [eventId, code.toUpperCase().trim()]
    );
    return result.rows[0];
  },

  /**
   * Get all promo codes for an event
   */
  async findByEvent(eventId, organizerId = null) {
    let query = `SELECT * FROM promo_codes WHERE event_id = $1`;
    const params = [eventId];

    if (organizerId) {
      query += ` AND organizer_id = $2`;
      params.push(organizerId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Get all promo codes for an organizer
   */
  async findByOrganizer(organizerId) {
    const result = await pool.query(
      `SELECT pc.*, e.name as event_name, e.start_date as event_start_date
       FROM promo_codes pc
       JOIN events e ON pc.event_id = e.id
       WHERE pc.organizer_id = $1
       ORDER BY pc.created_at DESC`,
      [organizerId]
    );
    return result.rows;
  },

  /**
   * Validate and get promo code for use
   */
  async validateForUse(eventId, code, purchaseAmount = 0) {
    const now = new Date();
    const promoCode = await this.findByCode(eventId, code);

    if (!promoCode) {
      return { valid: false, error: 'Promo code not found' };
    }

    if (!promoCode.is_active) {
      return { valid: false, error: 'Promo code is not active' };
    }

    if (new Date(promoCode.valid_from) > now) {
      return { valid: false, error: 'Promo code is not yet valid' };
    }

    if (promoCode.valid_until && new Date(promoCode.valid_until) < now) {
      return { valid: false, error: 'Promo code has expired' };
    }

    if (promoCode.max_uses !== null && promoCode.used_count >= promoCode.max_uses) {
      return { valid: false, error: 'Promo code has reached maximum uses' };
    }

    if (purchaseAmount < promoCode.min_purchase_amount) {
      return { 
        valid: false, 
        error: `Minimum purchase amount of ${promoCode.min_purchase_amount} required` 
      };
    }

    return { valid: true, promoCode };
  },

  /**
   * Calculate discount amount
   */
  calculateDiscount(promoCode, originalPrice) {
    if (promoCode.discount_type === 'percentage') {
      const discount = (originalPrice * promoCode.discount_value) / 100;
      return Math.round(discount * 100) / 100; // Round to 2 decimal places
    } else {
      // Fixed amount discount
      return Math.min(promoCode.discount_value, originalPrice);
    }
  },

  /**
   * Record promo code use
   */
  async recordUse(promoCodeId, ticketId, customerEmail, discountAmount, originalPrice, finalPrice) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert usage record
      await client.query(
        `INSERT INTO promo_code_uses (
          promo_code_id, ticket_id, customer_email, 
          discount_amount, original_price, final_price
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [promoCodeId, ticketId, customerEmail, discountAmount, originalPrice, finalPrice]
      );

      // Increment used_count
      await client.query(
        `UPDATE promo_codes 
         SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [promoCodeId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Update promo code
   */
  async update(id, organizerId, updates) {
    const {
      code,
      description,
      discount_type,
      discount_value,
      max_uses,
      min_purchase_amount,
      valid_from,
      valid_until,
      is_active
    } = updates;

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (code !== undefined) {
      setClause.push(`code = $${paramIndex++}`);
      values.push(code.toUpperCase().trim());
    }
    if (description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (discount_type !== undefined) {
      setClause.push(`discount_type = $${paramIndex++}`);
      values.push(discount_type);
    }
    if (discount_value !== undefined) {
      setClause.push(`discount_value = $${paramIndex++}`);
      values.push(discount_value);
    }
    if (max_uses !== undefined) {
      setClause.push(`max_uses = $${paramIndex++}`);
      values.push(max_uses);
    }
    if (min_purchase_amount !== undefined) {
      setClause.push(`min_purchase_amount = $${paramIndex++}`);
      values.push(min_purchase_amount);
    }
    if (valid_from !== undefined) {
      setClause.push(`valid_from = $${paramIndex++}`);
      values.push(valid_from);
    }
    if (valid_until !== undefined) {
      setClause.push(`valid_until = $${paramIndex++}`);
      values.push(valid_until);
    }
    if (is_active !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (setClause.length === 0) {
      return await this.findById(id);
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, organizerId);

    const result = await pool.query(
      `UPDATE promo_codes 
       SET ${setClause.join(', ')}
       WHERE id = $${paramIndex++} AND organizer_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0];
  },

  /**
   * Delete promo code
   */
  async delete(id, organizerId) {
    const result = await pool.query(
      `DELETE FROM promo_codes 
       WHERE id = $1 AND organizer_id = $2
       RETURNING id`,
      [id, organizerId]
    );
    return result.rows[0];
  },

  /**
   * Get usage statistics for a promo code
   */
  async getUsageStats(promoCodeId) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_uses,
        SUM(discount_amount) as total_discount_given,
        SUM(original_price) as total_original_revenue,
        SUM(final_price) as total_final_revenue
       FROM promo_code_uses
       WHERE promo_code_id = $1`,
      [promoCodeId]
    );
    return result.rows[0];
  }
};

export default PromoCode;


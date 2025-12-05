import { pool } from '../config/database.js';

const DiscountCode = {
  // Create a new discount code
  async create({
    event_id,
    code,
    description,
    discount_type,
    discount_value,
    min_order_amount = 0,
    max_discount_amount,
    usage_limit,
    valid_from,
    valid_until,
    created_by
  }) {
    const result = await pool.query(
      `INSERT INTO discount_codes 
       (event_id, code, description, discount_type, discount_value, min_order_amount, 
        max_discount_amount, usage_limit, valid_from, valid_until, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [event_id, code.toUpperCase(), description, discount_type, discount_value, 
       min_order_amount, max_discount_amount, usage_limit, valid_from, valid_until, created_by]
    );
    return result.rows[0];
  },

  // Get all discount codes for an event
  async getByEventId(event_id) {
    const result = await pool.query(
      `SELECT dc.*, 
              COUNT(dcu.id) as actual_usage_count
       FROM discount_codes dc
       LEFT JOIN discount_code_usage dcu ON dc.id = dcu.discount_code_id
       WHERE dc.event_id = $1
       GROUP BY dc.id
       ORDER BY dc.created_at DESC`,
      [event_id]
    );
    return result.rows;
  },

  // Get discount code by ID
  async findById(id) {
    const result = await pool.query(
      `SELECT dc.*, 
              COUNT(dcu.id) as actual_usage_count
       FROM discount_codes dc
       LEFT JOIN discount_code_usage dcu ON dc.id = dcu.discount_code_id
       WHERE dc.id = $1
       GROUP BY dc.id`,
      [id]
    );
    return result.rows[0];
  },

  // Get discount code by code (for validation)
  async findByCode(code) {
    const result = await pool.query(
      `SELECT dc.*, 
              COUNT(dcu.id) as actual_usage_count,
              e.name as event_name,
              e.end_date as event_end_date
       FROM discount_codes dc
       LEFT JOIN discount_code_usage dcu ON dc.id = dcu.discount_code_id
       LEFT JOIN events e ON dc.event_id = e.id
       WHERE dc.code = $1
       GROUP BY dc.id, e.name, e.end_date`,
      [code.toUpperCase()]
    );
    return result.rows[0];
  },

  // Update discount code
  async update(id, updates) {
    const {
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount_amount,
      usage_limit,
      valid_from,
      valid_until,
      is_active
    } = updates;

    const result = await pool.query(
      `UPDATE discount_codes 
       SET description = COALESCE($1, description),
           discount_type = COALESCE($2, discount_type),
           discount_value = COALESCE($3, discount_value),
           min_order_amount = COALESCE($4, min_order_amount),
           max_discount_amount = COALESCE($5, max_discount_amount),
           usage_limit = COALESCE($6, usage_limit),
           valid_from = COALESCE($7, valid_from),
           valid_until = COALESCE($8, valid_until),
           is_active = COALESCE($9, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [description, discount_type, discount_value, min_order_amount, 
       max_discount_amount, usage_limit, valid_from, valid_until, is_active, id]
    );
    return result.rows[0];
  },

  // Delete discount code
  async delete(id, event_id) {
    const result = await pool.query(
      'DELETE FROM discount_codes WHERE id = $1 AND event_id = $2 RETURNING id',
      [id, event_id]
    );
    return result.rows[0];
  },

  // Validate discount code
  async validate(code, order_amount = 0) {
    const discountCode = await this.findByCode(code);
    
    if (!discountCode) {
      return { valid: false, message: 'Invalid discount code' };
    }

    // Check if code is active
    if (!discountCode.is_active) {
      return { valid: false, message: 'Discount code is inactive' };
    }

    // Check validity dates
    const now = new Date();
    if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
      return { valid: false, message: 'Discount code is not yet valid' };
    }

    if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
      return { valid: false, message: 'Discount code has expired' };
    }

    // Check if event has ended
    if (discountCode.event_end_date && new Date(discountCode.event_end_date) < now) {
      return { valid: false, message: 'Event has ended' };
    }

    // Check usage limit
    if (discountCode.usage_limit && discountCode.actual_usage_count >= discountCode.usage_limit) {
      return { valid: false, message: 'Discount code usage limit reached' };
    }

    // Check minimum order amount
    if (discountCode.min_order_amount > 0 && order_amount < discountCode.min_order_amount) {
      return { 
        valid: false, 
        message: `Minimum order amount of ${discountCode.min_order_amount} required` 
      };
    }

    // Calculate discount amount
    let discount_amount;
    if (discountCode.discount_type === 'percentage') {
      discount_amount = (order_amount * discountCode.discount_value) / 100;
      // Apply maximum discount limit if set
      if (discountCode.max_discount_amount) {
        discount_amount = Math.min(discount_amount, discountCode.max_discount_amount);
      }
    } else {
      discount_amount = discountCode.discount_value;
    }

    // Ensure discount doesn't exceed order amount
    discount_amount = Math.min(discount_amount, order_amount);

    return {
      valid: true,
      discount_code: discountCode,
      discount_amount: discount_amount,
      final_amount: order_amount - discount_amount
    };
  },

  // Record discount code usage
  async recordUsage(discount_code_id, ticket_id, order_id, discount_amount, customer_email) {
    const result = await pool.query(
      `INSERT INTO discount_code_usage 
       (discount_code_id, ticket_id, order_id, discount_amount, customer_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [discount_code_id, ticket_id, order_id, discount_amount, customer_email]
    );

    // Update usage count
    await pool.query(
      `UPDATE discount_codes 
       SET usage_count = usage_count + 1 
       WHERE id = $1`,
      [discount_code_id]
    );

    return result.rows[0];
  },

  // Get discount code usage statistics
  async getUsageStats(discount_code_id) {
    const result = await pool.query(
      `SELECT 
          COUNT(*) as total_usage,
          SUM(discount_amount) as total_discount_given,
          MAX(used_at) as last_used_at,
          COUNT(DISTINCT customer_email) as unique_customers
       FROM discount_code_usage 
       WHERE discount_code_id = $1`,
      [discount_code_id]
    );
    return result.rows[0];
  }
};

export default DiscountCode;

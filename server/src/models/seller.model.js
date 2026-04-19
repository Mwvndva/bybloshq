import { pool } from '../config/database.js';
import { toCamelCase } from '../utils/caseUtils.js';
import logger from '../utils/logger.js';

class Seller {
  /**
   * Static find by ID (Rule 10).
   */
  static async findById(id) {
    const query = `
      SELECT 
        id, user_id AS "userId", full_name AS "fullName", shop_name AS "shopName", 
        email, whatsapp_number AS "whatsappNumber", city, location, 
        physical_address AS "physicalAddress", latitude, longitude,
        banner_image AS "bannerImage", theme, balance, 
        total_sales AS "totalSales", net_revenue AS "netRevenue", 
        client_count AS "clientCount", status, created_at AS "createdAt"
      FROM sellers 
      WHERE id = $1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  /** Alias — callers throughout the codebase use this name. */
  static async findSellerById(id) {
    return Seller.findById(id);
  }


  /**
   * Find and lock seller row (Rule 10).
   */
  static async findByIdForUpdate(client, id) {
    const query = `
      SELECT id, balance, full_name, whatsapp_number, status
      FROM sellers 
      WHERE id = $1 
      FOR UPDATE
    `;
    const { rows } = await client.query(query, [id]);
    return rows[0];
  }

  /**
   * Atomically adjust wallet balance.
   */
  static async adjustWalletBalance(client, sellerId, amount) {
    const query = `
      UPDATE sellers 
      SET balance = balance + $1, 
          updated_at = NOW() 
      WHERE id = $2 
      RETURNING balance
    `;
    const { rows } = await client.query(query, [amount, sellerId]);
    return rows[0];
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM sellers WHERE user_id = $1';
    const { rows } = await pool.query(query, [userId]);
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  static async findByShopName(shopName) {
    const query = 'SELECT * FROM sellers WHERE slug = $1 OR shop_name = $1';
    const { rows } = await pool.query(query, [shopName.toLowerCase()]);
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  /**
   * For backward compatibility with exported functions
   */
  static async create(data, client) {
    const { fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId = null, termsAccepted = false } = data;
    const query = `
      INSERT INTO sellers (full_name, shop_name, email, whatsapp_number, city, location, physical_address, latitude, longitude, user_id, terms_accepted, terms_accepted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END)
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId, termsAccepted]);
    return toCamelCase(rows[0]);
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM sellers WHERE LOWER(email) = $1';
    const { rows } = await pool.query(query, [email.toLowerCase()]);
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  static async updateUserId(sellerId, userId) {
    const query = 'UPDATE sellers SET user_id = $1 WHERE id = $2 AND user_id IS NULL';
    await pool.query(query, [userId, sellerId]);
  }

  static async findByReferralCode(code) {
    const query = 'SELECT id FROM sellers WHERE referral_code = $1';
    const { rows } = await pool.query(query, [code]);
    return rows[0];
  }

  static async updateReferralCode(sellerId, code) {
    const query = 'UPDATE sellers SET referral_code = $1 WHERE id = $2';
    await pool.query(query, [code, sellerId]);
  }

  static async setReferrer(sellerId, referrerId) {
    const query = 'UPDATE sellers SET referred_by_seller_id = $1 WHERE id = $2 AND referred_by_seller_id IS NULL';
    await pool.query(query, [referrerId, sellerId]);
  }

  static async activateReferral(sellerId) {
    const query = `
      UPDATE sellers
      SET referral_active_until = NOW() + INTERVAL '6 months'
      WHERE id = $1
        AND referred_by_seller_id IS NOT NULL
        AND referral_active_until IS NULL
      RETURNING *
    `;
    const { rows } = await pool.query(query, [sellerId]);
    return rows[0];
  }

  static async findActiveReferrals() {
    const query = `
      SELECT
        id AS referred_seller_id,
        shop_name AS referred_shop_name,
        referred_by_seller_id AS referrer_seller_id
      FROM sellers
      WHERE referred_by_seller_id IS NOT NULL
        AND referral_active_until > NOW()
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async adjustReferralEarnings(client, referrerId, amount) {
    const query = `
      UPDATE sellers
      SET balance = balance + $1,
          total_referral_earnings = total_referral_earnings + $1
      WHERE id = $2
    `;
    const executor = client || pool;
    await executor.query(query, [amount, referrerId]);
  }

  static async creditEscrowRelease(client, sellerId, payoutAmount, totalAmount) {
    const query = `
      UPDATE sellers
      SET balance     = balance     + $1,
          net_revenue = net_revenue + $1,
          total_sales = total_sales + $2,
          updated_at  = NOW()
      WHERE id = $3
    `;
    const executor = client || pool;
    await executor.query(query, [payoutAmount, totalAmount, sellerId]);
  }

  static async search(city, location = null) {
    let query = `
      SELECT 
        id, 
        full_name AS "fullName", 
        shop_name AS "shopName", 
        city, 
        location,
        theme,
        created_at AS "createdAt"
      FROM sellers 
      WHERE LOWER(city) = LOWER($1)
    `;

    const params = [city];

    if (location) {
      query += ' AND location ILIKE $2';
      params.push(`%${location}%`);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async updateBanner(sellerId, bannerUrl) {
    const query = 'UPDATE sellers SET banner_image = $1 WHERE id = $2 RETURNING id, banner_image AS "bannerImage"';
    const { rows } = await pool.query(query, [bannerUrl, sellerId]);
    return rows[0];
  }

  static async updateTheme(sellerId, theme) {
    const query = 'UPDATE sellers SET theme = $1 WHERE id = $2 RETURNING theme';
    const { rows } = await pool.query(query, [theme, sellerId]);
    return rows[0];
  }

  static async findAll() {
    const query = `
      SELECT id, user_id AS "userId", full_name as "name", email, whatsapp_number as "phone", status, city, location, created_at as "createdAt", shop_name as "shopName", balance
      FROM sellers ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async updateStatus(id, status) {
    const query = 'UPDATE sellers SET status = $1 WHERE id = $2 RETURNING *';
    const { rows } = await pool.query(query, [status, id]);
    return toCamelCase(rows[0]);
  }

  static async getMetrics(id) {
    const query = `
      SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN platform_fee_amount ELSE 0 END), 0) as total_commission,
          COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN seller_payout_amount ELSE 0 END), 0) as net_sales,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
      FROM product_orders WHERE seller_id = $1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async delete(client, id) {
    const query = 'DELETE FROM sellers WHERE id = $1';
    const executor = client || pool;
    await executor.query(query, [id]);
  }

  static async decrementClientCount(client, sellerIds) {
    const query = `
      UPDATE sellers 
      SET client_count = GREATEST(COALESCE(client_count, 0) - 1, 0)
      WHERE id = ANY($1)
    `;
    const executor = client || pool;
    await executor.query(query, [sellerIds]);
  }

  static async findSellersByClientUserId(client, userId) {
    const query = 'SELECT seller_id FROM seller_clients WHERE user_id = $1';
    const executor = client || pool;
    const { rows } = await executor.query(query, [userId]);
    return rows.map(r => r.seller_id);
  }

  static async deleteClientJunction(client, userId) {
    const query = 'DELETE FROM seller_clients WHERE user_id = $1';
    const executor = client || pool;
    await executor.query(query, [userId]);
  }

  static async deleteSellerJunction(client, sellerId) {
    const query = 'DELETE FROM seller_clients WHERE seller_id = $1';
    const executor = client || pool;
    await executor.query(query, [sellerId]);
  }

  static async isShopNameAvailable(shopName) {
    const query = 'SELECT 1 FROM sellers WHERE LOWER(shop_name) = $1 OR LOWER(slug) = $1';
    const { rows } = await pool.query(query, [shopName.toLowerCase()]);
    return rows.length === 0;
  }

  static async updateSeller(id, data, client) {
    const fields = [];
    const values = [];
    let i = 1;

    // Map camelCase to snake_case if necessary, or assume direct mapping
    const mapping = {
      fullName: 'full_name',
      shopName: 'shop_name',
      whatsappNumber: 'whatsapp_number',
      physicalAddress: 'physical_address',
      bannerImage: 'banner_image'
    };

    for (const [key, value] of Object.entries(data)) {
      const dbKey = mapping[key] || key;
      fields.push(`${dbKey} = $${i++}`);
      values.push(value);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const query = `UPDATE sellers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  static async becomeClient(sellerId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if already a client
      const checkQuery = 'SELECT 1 FROM seller_clients WHERE seller_id = $1 AND user_id = $2';
      const checkRes = await client.query(checkQuery, [sellerId, userId]);

      if (checkRes.rows.length > 0) {
        const { rows } = await client.query('SELECT client_count FROM sellers WHERE id = $1', [sellerId]);
        await client.query('COMMIT');
        return {
          alreadyClient: true,
          clientCount: rows[0]?.client_count || 0
        };
      }

      // Add to junction
      await client.query(
        'INSERT INTO seller_clients (seller_id, user_id, created_at) VALUES ($1, $2, NOW())',
        [sellerId, userId]
      );

      // Increment count
      const { rows } = await client.query(
        'UPDATE sellers SET client_count = COALESCE(client_count, 0) + 1 WHERE id = $1 RETURNING client_count',
        [sellerId]
      );

      await client.query('COMMIT');
      return {
        alreadyClient: false,
        clientCount: rows[0]?.client_count || 0
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async removeClient(sellerId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rowCount } = await client.query(
        'DELETE FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
        [sellerId, userId]
      );

      if (rowCount > 0) {
        await client.query(
          'UPDATE sellers SET client_count = GREATEST(COALESCE(client_count, 0) - 1, 0) WHERE id = $1',
          [sellerId]
        );
      }

      const { rows } = await client.query('SELECT client_count FROM sellers WHERE id = $1', [sellerId]);

      await client.query('COMMIT');
      return {
        clientCount: rows[0]?.client_count || 0
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Legacy exports for backward compatibility
export const createSeller = Seller.create;
export const findSellerById = Seller.findById;
export const findSellerByUserId = Seller.findByUserId;
export const findSellerByShopName = Seller.findByShopName;
export const isShopNameAvailable = Seller.isShopNameAvailable;
export const findSellerByEmail = Seller.findByEmail;
export const updateSeller = Seller.updateSeller;
export const becomeClient = Seller.becomeClient;
export const removeClient = Seller.removeClient;

export default Seller;

import { query } from '../../../infrastructure/database/database.js';

/**
 * Fetches a minimal user record (id, email, role, created_at) by id.
 * Returns undefined when not found.
 *
 * @param {number|string} userId
 * @returns {Promise<{id: number, email: string, role: string, created_at: string}|undefined>}
 */
export async function findByIdMinimal(userId) {
  const sql = {
    name: 'find-user-by-id-minimal',
    text: `SELECT id, email, role, created_at FROM users WHERE id = $1`,
    values: [userId]
  };
  const { rows } = await query(sql);
  return rows[0];
}

export async function findAdminAuthProfile(userId) {
  const userQuery = {
    name: 'find-admin-auth-profile-v2',
    text: `
      SELECT u.*, u.id as profile_id
      FROM users u 
      WHERE u.id = $1 AND (u.role = 'admin' OR u.role = 'marketing') AND u.is_active = true
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findBuyerAuthProfile(userId) {
  const userQuery = {
    name: 'find-buyer-auth-profile',
    text: `
      SELECT
        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
        b.id as profile_id, b.full_name, b.whatsapp_number,
        COALESCE(b.status, 'active') as status
      FROM users u
      LEFT JOIN buyers b ON u.id = b.user_id
      WHERE u.id = $1
        AND u.is_active = true
        AND (b.status = 'active' OR b.status IS NULL OR b.id IS NULL)
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findSellerAuthProfile(userId) {
  const userQuery = {
    name: 'find-seller-auth-profile',
    text: `
      SELECT 
        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
        s.id as profile_id, s.full_name, s.shop_name, s.whatsapp_number, s.city, s.location, s.balance, s.total_sales, s.status, s.referral_code, s.total_referral_earnings
      FROM users u 
      LEFT JOIN sellers s ON u.id = s.user_id 
      WHERE u.id = $1
        AND u.is_active = true
        AND COALESCE(s.status, 'active') = 'active'
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findCreatorAuthProfile(userId) {
  const userQuery = {
    name: 'find-creator-auth-profile',
    text: `
      SELECT
        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
        c.id as profile_id, c.first_name, c.last_name, c.mpesa_number, c.balance, c.total_sales, c.total_earnings, c.status, c.referral_code, c.total_referral_earnings
      FROM users u
      LEFT JOIN creators c ON u.id = c.user_id
      WHERE u.id = $1
        AND u.is_active = true
        AND c.id IS NOT NULL
        AND COALESCE(c.status, 'active') = 'active'
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findMarketingAuthProfile(userId) {
  const userQuery = {
    name: 'find-marketing-auth-profile-v2',
    text: `
      SELECT u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at, u.id as profile_id
      FROM users u
      WHERE u.id = $1 AND (u.role = 'marketing' OR u.role = 'admin') AND u.is_active = true
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findLogisticsAuthProfile(userId) {
  const userQuery = {
    name: 'find-logistics-auth-profile',
    text: `
      SELECT
        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
        lp.id as profile_id, lp.name as partner_name, lp.slug as partner_slug, lp.active as partner_active
      FROM users u
      LEFT JOIN logistics_partners lp ON u.id = lp.user_id
      WHERE u.id = $1
        AND u.is_active = true
        AND (lp.active = true OR lp.id IS NULL)
    `,
    values: [userId]
  };
  const { rows } = await query(userQuery);
  return rows[0];
}

export async function findCrossRolesByUserId(userId) {
  const userRes = await query({
    text: `SELECT email FROM users WHERE id = $1`,
    values: [userId]
  });
  const userEmail = userRes.rows[0]?.email ? userRes.rows[0].email.trim().toLowerCase() : null;

  const crossRoleQuery = {
    text: `
      SELECT 
        (SELECT id FROM buyers WHERE (user_id = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)) AND (status = 'active' OR status IS NULL) ORDER BY user_id DESC NULLS LAST LIMIT 1) as buyer_id,
        (SELECT id FROM sellers WHERE (user_id = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)) AND COALESCE(status, 'active') = 'active' ORDER BY user_id DESC NULLS LAST LIMIT 1) as seller_id,
        (SELECT id FROM creators WHERE (user_id = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)) AND (status = 'active' OR status IS NULL) ORDER BY user_id DESC NULLS LAST LIMIT 1) as creator_id
    `,
    values: [userId, userEmail]
  };
  const { rows } = await query(crossRoleQuery);
  const cross = rows[0] || { buyer_id: null, seller_id: null, creator_id: null };

  // Auto-link unlinked profile rows to this user_id
  if (cross.buyer_id) {
    query({ text: `UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL`, values: [userId, cross.buyer_id] }).catch(() => {});
  }
  if (cross.seller_id) {
    query({ text: `UPDATE sellers SET user_id = $1 WHERE id = $2 AND user_id IS NULL`, values: [userId, cross.seller_id] }).catch(() => {});
  }
  if (cross.creator_id) {
    query({ text: `UPDATE creators SET user_id = $1 WHERE id = $2 AND user_id IS NULL`, values: [userId, cross.creator_id] }).catch(() => {});
  }

  return cross;
}

// CRUD only
import { pool } from '../../../infrastructure/database/database.js';
import { toCamelCase } from '../../../shared/utils/caseUtils.js';
import logger from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/utils/errorHandler.js';

const SALT_ROUNDS = 10;

const query = (text, params) => pool.query(text, params);

export const createSeller = async (sellerData, externalClient = null) => {
  const { fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId = null, termsAccepted = false } = sellerData;
  const slug = shopName ? String(shopName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null;

  const result = await (externalClient || pool).query(
    `INSERT INTO sellers (full_name, shop_name, slug, email, whatsapp_number, city, location, physical_address, latitude, longitude, user_id, terms_accepted, terms_accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $12 = true THEN NOW() ELSE NULL END)
     RETURNING *`,
    [fullName, shopName, slug, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId, termsAccepted]
  );
  return toCamelCase(result.rows[0]);
};

export const findSellerByEmail = async (email) => {
  if (!email) return null;
  const result = await query(
    `SELECT * FROM sellers WHERE LOWER(email) = $1`,
    [email.toLowerCase()]
  );
  return toCamelCase(result.rows[0]);
};

export const findSellerByWhatsappNumber = async (whatsappNumber) => {
  if (!whatsappNumber) return null;
  const result = await query(
    `SELECT id, user_id AS "userId" FROM sellers WHERE whatsapp_number = $1 LIMIT 1`,
    [String(whatsappNumber).trim()]
  );
  return result.rows[0] || null;
};

export const findSellerByUserId = async (userId) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      slug,
      email, 
      whatsapp_number AS "whatsappNumber", 
      city,
      location,
      bio,
      avatar_url AS "avatarUrl",
      theme,
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      created_at AS "createdAt"
     FROM sellers 
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
};

export const findSellerByShopName = async (shopName) => {
  if (!shopName || typeof shopName !== 'string') return null;
  const rawInput = shopName.trim();
  if (!rawInput) return null;

  logger.debug('Executing findSellerByShopName query', { shopName: rawInput.replace(/[\n\r]/g, '') });

  const slugified = rawInput.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const unslugified = rawInput.replace(/-/g, ' ');

  const queryText = `
    SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      slug,
      email, 
      whatsapp_number AS "whatsappNumber", 
      city, 
      location, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      bio,
      avatar_url AS "avatarUrl",
      theme,
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      is_creator_marketplace_enabled AS "isCreatorMarketplaceEnabled",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      created_at AS "createdAt"
    FROM sellers 
    WHERE COALESCE(status, 'active') = 'active'
      AND (
        LOWER(TRIM(shop_name)) = LOWER(TRIM($1))
        OR (slug IS NOT NULL AND LOWER(TRIM(slug)) = LOWER(TRIM($1)))
        OR (slug IS NOT NULL AND LOWER(TRIM(slug)) = LOWER(TRIM($2)))
        OR LOWER(TRIM(shop_name)) = LOWER(TRIM($3))
      )
    ORDER BY 
      CASE 
        WHEN LOWER(TRIM(shop_name)) = LOWER(TRIM($1)) THEN 1
        WHEN slug IS NOT NULL AND LOWER(TRIM(slug)) = LOWER(TRIM($1)) THEN 2
        ELSE 3
      END
    LIMIT 1
  `;

  const result = await query(queryText, [rawInput, slugified, unslugified]);

  logger.debug('Query result details', {
    rowCount: result.rowCount
  });

  return result.rows[0];
};

export const isShopNameAvailable = async (shopName) => {
  // Basic check
  const result = await query("SELECT 1 FROM sellers WHERE LOWER(shop_name) = LOWER($1)", [shopName]);
  return result.rowCount === 0;
};

export const findSellerById = async (id) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      location, 
      city, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      bio,
      avatar_url AS "avatarUrl",
      theme, 
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      is_creator_marketplace_enabled AS "isCreatorMarketplaceEnabled",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
     FROM sellers 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

export const updateSeller = async (id, updates) => {
  logger.info('Updating seller record', {
    id,
    updatedFields: Object.keys(updates || {}).filter(k => k !== 'password')
  });

  if (!id) {
    logger.error('No ID provided for updateSeller');
    throw new Error('Seller ID is required for update');
  }

  // NOTE: `email` is intentionally NOT updatable here. Email is the auth identity,
  // owned by the users table (login uses users.email); sellers.email is seeded in
  // sync at registration. Allowing a profile PATCH to change sellers.email alone
  // desynced it from users.email. Email changes must go through a verified auth
  // flow that updates both, not this profile-update path.
  const { fullName, shopName, whatsappNumber, password, city, location, theme, instagramLink, instagram_link, tiktokLink, tiktok_link, facebookLink, facebook_link, creatorCommissionRate, creator_commission_rate } = updates || {};
  const updatesList = [];
  const values = [id];
  let paramCount = 1;

  if (fullName) {
    paramCount++;
    updatesList.push(`full_name = $${paramCount}`);
    values.push(fullName);
  }

  if (shopName) {
    paramCount++;
    updatesList.push(`shop_name = $${paramCount}`);
    values.push(shopName);
  }

  if (whatsappNumber) {
    paramCount++;
    updatesList.push(`whatsapp_number = $${paramCount}`);
    values.push(whatsappNumber);
  }

  // Removed password update from here - it is handled by User model

  if (city) {
    paramCount++;
    updatesList.push(`city = $${paramCount}`);
    values.push(city);
  }

  if (location) {
    paramCount++;
    updatesList.push(`location = $${paramCount}`);
    values.push(location);
  }



  // Handle theme update
  if (theme !== undefined) {
    paramCount++;
    updatesList.push(`theme = $${paramCount}`);
    values.push(theme);
  }

  // Handle instagram link update (accept both camelCase and snake_case)
  const instagramLinkToUpdate = instagramLink || instagram_link;
  // Allow empty string to clear the link
  if (instagramLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`instagram_link = $${paramCount}`);
    values.push(instagramLinkToUpdate);
  }

  // Handle tiktok link update
  const tiktokLinkToUpdate = tiktokLink || tiktok_link;
  if (tiktokLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`tiktok_link = $${paramCount}`);
    values.push(tiktokLinkToUpdate);
  }

  // Handle facebook link update
  const facebookLinkToUpdate = facebookLink || facebook_link;
  if (facebookLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`facebook_link = $${paramCount}`);
    values.push(facebookLinkToUpdate);
  }

  if (updates.bio !== undefined) {
    paramCount++;
    updatesList.push(`bio = $${paramCount}`);
    values.push(updates.bio);
  }

  if (updates.avatarUrl !== undefined || updates.avatar_url !== undefined) {
    const avatarUrlToUpdate = updates.avatarUrl !== undefined ? updates.avatarUrl : updates.avatar_url;
    paramCount++;
    updatesList.push(`avatar_url = $${paramCount}`);
    values.push(avatarUrlToUpdate || null);
  }

  const creatorCommissionRateToUpdate = creatorCommissionRate !== undefined ? creatorCommissionRate : creator_commission_rate;
  if (creatorCommissionRateToUpdate !== undefined) {
    const normalizedRate = Number(creatorCommissionRateToUpdate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0.01 || normalizedRate > 1) {
      throw new Error('Creator commission must be between 1% and 100%');
    }
    paramCount++;
    updatesList.push(`creator_commission_rate = $${paramCount}`);
    values.push(normalizedRate);
  }

  // Handle physical shop fields. If no physical address, coordinates MUST be null (not Nairobi sentinel)
  const hasShop = !!updates.physicalAddress;
  const lat = hasShop ? parseFloat(updates.latitude || 0) : null;
  const lng = hasShop ? parseFloat(updates.longitude || 0) : null;

  // Handle physical address update
  if (updates.physicalAddress !== undefined) {
    paramCount++;
    updatesList.push(`physical_address = $${paramCount}`);
    values.push(updates.physicalAddress);
  }

  // Handle coordinates
  if (updates.latitude !== undefined) {
    paramCount++;
    updatesList.push(`latitude = $${paramCount}`);
    values.push(updates.latitude);
  }

  if (updates.longitude !== undefined) {
    paramCount++;
    updatesList.push(`longitude = $${paramCount}`);
    values.push(updates.longitude);
  }

  if (updatesList.length === 0) {
    logger.warn('No valid fields to updateSeller', { id });
    throw new Error('No valid fields to update');
  }

  const queryText = `
    UPDATE sellers
    SET ${updatesList.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      city, 
      location, 
      theme, 
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      bio,
      avatar_url AS "avatarUrl",
      created_at AS "createdAt"
    `;


  try {
    const result = await query(queryText, values);

    if (!result.rows || result.rows.length === 0) {
      logger.warn('No rows returned from updateSeller', { id });
      throw new Error('No seller found with the given ID');
    }

    logger.info('Successfully updated seller', { id: result.rows[0].id });
    return result.rows[0];
  } catch (error) {
    logger.error('Database error in updateSeller', {
      message: error.message,
      code: error.code
    });
    throw error; // Re-throw to be caught by the controller
  }
};


// Soft-delete a seller: block if they still hold a balance, otherwise anonymise
// PII, hide the shop (status='deleted' + tombstoned unique name/slug), and
// deactivate the auth account. Orders/withdrawals are preserved via FK.
export const softDeleteSeller = async (sellerId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRes = await client.query('SELECT balance FROM sellers WHERE id = $1 FOR UPDATE', [sellerId]);
    if (!balRes.rows.length) {
      throw new AppError('Seller account not found.', 404);
    }
    if (Number(balRes.rows[0].balance || 0) > 0) {
      throw new AppError('Please withdraw your available balance before deleting your account.', 400);
    }
    const tag = `${userId || sellerId}_${Date.now()}`;
    const tombstone = `deleted_seller_${tag}@deleted.byblos`;
    await client.query(
      `UPDATE sellers SET status = 'deleted', full_name = 'Deleted user', email = $1,
         shop_name = $2, slug = $3, whatsapp_number = NULL, instagram_link = NULL,
         tiktok_link = NULL, facebook_link = NULL,
         city = NULL, location = NULL, physical_address = NULL,
         latitude = NULL, longitude = NULL, updated_at = NOW() WHERE id = $4`,
      [tombstone, `deleted-shop-${tag}`, `deleted-shop-${tag}`, sellerId]
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
    if (!(error instanceof AppError)) {
      logger.error('softDeleteSeller failed', { sellerId, userId, error: error.message });
    }
    throw error;
  } finally {
    client.release();
  }
};

// CRUD only
import { pool } from '../shared/db/database.js';
import { toCamelCase } from '../shared/utils/caseUtils.js';
import logger from '../shared/utils/logger.js';

const SALT_ROUNDS = 10;

const query = (text, params) => pool.query(text, params);

export const createSeller = async (sellerData, externalClient = null) => {
  const { fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId = null, termsAccepted = false } = sellerData;

  const result = await (externalClient || pool).query(
    `INSERT INTO sellers (full_name, shop_name, email, whatsapp_number, city, location, physical_address, latitude, longitude, user_id, terms_accepted, terms_accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END)
     RETURNING *`,
    [fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId, termsAccepted]
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

export const findSellerByUserId = async (userId) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      city,
      location,
      banner_image AS "bannerImage",
      bio,
      avatar_url AS "avatarUrl",
      theme,
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      client_count AS "clientCount",
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
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
  logger.debug('Executing findSellerByShopName query', { shopName: shopName?.replace(/[\n\r]/g, '') });

  const queryText = `
    SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      city, 
      location, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      banner_image AS "bannerImage",
      bio,
      avatar_url AS "avatarUrl",
      theme,
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      client_count AS "clientCount",
      created_at AS "createdAt"
    FROM sellers 
    WHERE slug = $1 OR shop_name = $1
  `;

  // SQL Query log removed for security/cleanliness

  const result = await query(queryText, [shopName.toLowerCase()]);

  logger.debug('Query result details', {
    rowCount: result.rowCount,
    hasBannerImage: !!result.rows[0]?.banner_image
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
      banner_image AS "bannerImage",
      bio,
      avatar_url AS "avatarUrl",
      theme, 
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      client_count AS "clientCount",
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

  const { fullName, shopName, email, whatsappNumber, password, city, location, bannerImage, banner_image, theme, instagramLink, instagram_link, tiktokLink, tiktok_link, facebookLink, facebook_link } = updates || {};
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

  if (email) {
    paramCount++;
    updatesList.push(`email = $${paramCount}`);
    values.push(email);
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



  // Handle banner image (accept both bannerImage and banner_image for backward compatibility)
  const bannerImageToUpdate = bannerImage || banner_image;
  if (bannerImageToUpdate) {
    paramCount++;
    updatesList.push(`banner_image = $${paramCount}`);
    values.push(bannerImageToUpdate);
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
      banner_image AS "bannerImage",
      theme, 
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      client_count AS "clientCount",
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


export const becomeClient = async (sellerId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if relationship already exists
    const check = await client.query(
      'SELECT 1 FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
      [sellerId, userId]
    );

    if (check.rowCount > 0) {
      // Already a client, just return current count or do nothing
      await client.query('ROLLBACK');
      const countResult = await client.query('SELECT client_count FROM sellers WHERE id = $1', [sellerId]);
      return { clientCount: countResult.rows[0]?.client_count || 0, alreadyClient: true };
    }

    // 2. Insert into seller_clients
    await client.query(
      'INSERT INTO seller_clients (seller_id, user_id) VALUES ($1, $2)',
      [sellerId, userId]
    );

    // 3. Increment client_count in sellers
    const updateResult = await client.query(
      'UPDATE sellers SET client_count = COALESCE(client_count, 0) + 1 WHERE id = $1 RETURNING client_count',
      [sellerId]
    );

    await client.query('COMMIT');
    return { clientCount: updateResult.rows[0].client_count, alreadyClient: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const removeClient = async (sellerId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if relationship exists
    const check = await client.query(
      'SELECT 1 FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
      [sellerId, userId]
    );

    if (check.rowCount === 0) {
      // Not a client, nothing to remove
      await client.query('ROLLBACK');
      const countResult = await client.query('SELECT client_count FROM sellers WHERE id = $1', [sellerId]);
      return { clientCount: countResult.rows[0]?.client_count || 0, wasClient: false };
    }

    // 2. Remove from seller_clients
    await client.query(
      'DELETE FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
      [sellerId, userId]
    );

    // 3. Decrement client_count in sellers
    const updateResult = await client.query(
      'UPDATE sellers SET client_count = GREATEST(COALESCE(client_count, 0) - 1, 0) WHERE id = $1 RETURNING client_count',
      [sellerId]
    );

    await client.query('COMMIT');
    return { clientCount: updateResult.rows[0].client_count, wasClient: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const findSellersByUserId = async (userId, options = {}) => {
  const page = Math.max(1, parseInt(options.page || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(options.limit || options.pageSize || '24', 10) || 24));
  const offset = (page - 1) * pageSize;
  const result = await query(
    `SELECT 
      s.id, 
      s.full_name AS "fullName", 
      s.shop_name AS "shopName", 
      s.city, 
      s.location, 
      s.physical_address AS "physicalAddress",
      s.latitude,
      s.longitude,
      s.banner_image AS "bannerImage",
      s.bio,
      s.avatar_url AS "avatarUrl",
      s.theme,
      s.instagram_link AS "instagramLink",
      s.client_count AS "clientCount",
      COALESCE(w.total_wishlist_count, 0) AS "totalWishlistCount",
      COALESCE(w.total_wishlist_count, 0) AS "wishlistCount",
      COALESCE(k.knock_count, 0) AS "knockCount",
      s.created_at AS "createdAt",
      COUNT(*) OVER() AS "totalCount"
     FROM sellers s
     JOIN seller_clients sc ON s.id = sc.seller_id
     LEFT JOIN LATERAL (
       SELECT COUNT(wl.id)::int AS total_wishlist_count
       FROM products p
       LEFT JOIN wishlists wl ON p.id = wl.product_id
       WHERE p.seller_id = s.id
     ) w ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS knock_count
       FROM seller_knocks sk
       WHERE sk.seller_id = s.id
         AND sk.created_at >= NOW() - INTERVAL '24 hours'
     ) k ON true
     WHERE sc.user_id = $1
     ORDER BY sc.created_at DESC, s.id ASC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );
  return {
    sellers: result.rows,
    pagination: {
      page,
      pageSize,
      total: parseInt(result.rows[0]?.totalCount || '0', 10),
      hasMore: offset + result.rows.length < parseInt(result.rows[0]?.totalCount || '0', 10)
    }
  };
};




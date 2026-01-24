// CRUD only
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

const query = (text, params) => pool.query(text, params);

export const createSeller = async (sellerData) => {
  const { fullName, shopName, email, phone, password, city, location, physicalAddress, latitude, longitude, userId = null } = sellerData;

  // Only hash password if we are creating a new user (no userId provided)
  let hashedPassword = password;
  if (!userId && password) {
    hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const result = await query(
    `INSERT INTO sellers (full_name, shop_name, email, phone, password, city, location, physical_address, latitude, longitude, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [fullName, shopName, email, phone, hashedPassword, city, location, physicalAddress, latitude, longitude, userId]
  );
  return result.rows[0];
};

export const findSellerByEmail = async (email) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      password, 
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      instagram_link AS "instagramLink",
      created_at AS "createdAt"
     FROM sellers 
     WHERE email = $1`,
    [email]
  );
  return result.rows[0];
};

export const findSellerByShopName = async (shopName) => {
  console.log('Executing findSellerByShopName query for:', shopName);

  const queryText = `
    SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      city, 
      location, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      banner_image AS "bannerImage",
      theme,
      instagram_link AS "instagramLink",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      created_at AS "createdAt"
    FROM sellers 
    WHERE slug = $1 OR shop_name = $1
  `;

  console.log('SQL Query:', queryText);

  const result = await query(queryText, [shopName.toLowerCase()]);

  console.log('Query result:', {
    rowCount: result.rowCount,
    hasBannerImage: result.rows[0] ? !!result.rows[0].banner_image : false,
    bannerImageLength: result.rows[0] && result.rows[0].banner_image
      ? result.rows[0].banner_image.length
      : 0
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
      phone, 
      location, 
      city, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      banner_image AS "bannerImage",
      theme, 
      instagram_link AS "instagramLink",
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
  console.log('Updating seller:', {
    id,
    updates: {
      ...updates,
      email: updates.email ? '[REDACTED]' : 'missing',
      phone: updates.phone ? '[REDACTED]' : 'missing'
    }
  });

  if (!id) {
    console.error('No ID provided for update');
    throw new Error('Seller ID is required for update');
  }

  const { fullName, shopName, email, phone, password, city, location, bannerImage, banner_image, theme, instagramLink, instagram_link } = updates || {};
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

  if (phone) {
    paramCount++;
    updatesList.push(`phone = $${paramCount}`);
    values.push(phone);
  }

  if (password) {
    paramCount++;
    updatesList.push(`password = $${paramCount}`);
    values.push(password);
  }

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

  // Handle physical address update
  if (updates.physicalAddress) {
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
    console.log('No valid fields to update');
    throw new Error('No valid fields to update');
  }

  const queryText = `
    UPDATE sellers
    SET ${updatesList.join(', ')}
    WHERE id = $1
    RETURNING 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      city, 
      location, 
      theme, 
      instagram_link AS "instagramLink",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      created_at AS "createdAt"
  `;

  console.log('Executing update query:', { queryText, values });

  try {
    const result = await query(queryText, values);

    if (!result.rows || result.rows.length === 0) {
      console.error('No rows returned from update query');
      throw new Error('No seller found with the given ID');
    }

    console.log('Successfully updated seller:', {
      id: result.rows[0].id,
      shopName: result.rows[0].shop_name,
      email: result.rows[0].email ? '[REDACTED]' : 'missing',
      phone: result.rows[0].phone ? '[REDACTED]' : 'missing'
    });
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateSeller:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      query: queryText,
      values
    });
    throw error; // Re-throw to be caught by the controller
  }
};

export const generateAuthToken = (seller) => {
  return jwt.sign(
    {
      id: seller.id,
      email: seller.email,
      role: 'seller' // Add role to the token payload
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // 24 hours expiration
  );
};

export const verifyPassword = async (candidatePassword, hashedPassword) => {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

export const createPasswordResetToken = async (email) => {
  // Generate a random token
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Hash the token before saving to database
  const hashedToken = await bcrypt.hash(token, SALT_ROUNDS);

  // Set token expiration (1 hour from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Save the hashed token and expiration to the database
  await query(
    `UPDATE sellers 
     SET password_reset_token = $1, 
         password_reset_expires = $2 
     WHERE email = $3`,
    [hashedToken, expiresAt, email]
  );

  // Return the unhashed token (to be sent via email)
  return token;
};

export const verifyPasswordResetToken = async (email, token) => {
  // Find the seller with the given email and a valid reset token
  const result = await query(
    `SELECT password_reset_token, password_reset_expires 
     FROM sellers 
     WHERE email = $1 AND password_reset_expires > NOW()`,
    [email]
  );

  if (!result.rows[0]) {
    return false;
  }

  const { password_reset_token: hashedToken } = result.rows[0];

  // Verify the token matches the hashed version in the database
  return await bcrypt.compare(token, hashedToken);
};

export const updatePassword = async (email, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE sellers SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE email = $2',
    [hashedPassword, email]
  );
  return true;
};

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const SALT_ROUNDS = 10;

export const createSeller = async (sellerData) => {
  const { fullName, shopName, email, phone, password, city, location } = sellerData;
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  
  const result = await query(
    `INSERT INTO sellers (full_name, shop_name, email, phone, password, city, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING 
       id, 
       full_name AS "fullName", 
       shop_name AS "shopName", 
       email, 
       phone, 
       city, 
       location, 
       total_sales AS "totalSales",
       net_revenue AS "netRevenue",
       balance,
       created_at AS "createdAt"`,
    [fullName, shopName, email, phone, hashedPassword, city, location]
  );
  
  return result.rows[0];
};

export const findSellerByEmail = async (email) => {
  const result = await query(
    `SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      password, 
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
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
      banner_image,
      theme,
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
  try {
    if (!shopName || typeof shopName !== 'string') {
      console.log('Invalid shop name:', shopName);
      return false;
    }
    
    // Convert the input shop name to the same format as the slug
    const slug = shopName.toLowerCase().replace(/\s+/g, '-');
    console.log('Checking shop name availability. Input:', shopName, 'Slug:', slug);
    
    // First, check if any shop name matches exactly (case-insensitive)
    const exactMatchResult = await query(
      `SELECT id, shop_name, slug FROM sellers WHERE LOWER(shop_name) = LOWER($1) OR slug = $2`,
      [shopName, slug]
    );
    
    console.log('Exact match results:', exactMatchResult.rows);
    
    if (exactMatchResult.rows.length > 0) {
      console.log('Shop name already exists:', exactMatchResult.rows[0]);
      return false;
    }
    
    // Also check for any similar slugs (just in case)
    const similarSlugResult = await query(
      `SELECT id, shop_name, slug FROM sellers WHERE slug = $1`,
      [slug]
    );
    
    console.log('Similar slug results:', similarSlugResult.rows);
    
    if (similarSlugResult.rows.length > 0) {
      console.log('Similar slug exists:', similarSlugResult.rows[0]);
      return false;
    }
    
    console.log('Shop name is available');
    return true;
  } catch (error) {
    console.error('Error in isShopNameAvailable:', error);
    return false; // Default to false on error to prevent duplicate shop names
  }
};

export const findSellerById = async (id) => {
  const result = await query(
    `SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      location, 
      city, 
      theme, 
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
  console.log('Updating seller:', { id, updates });
  
  if (!id) {
    console.error('No ID provided for update');
    throw new Error('Seller ID is required for update');
  }
  
  const { fullName, shopName, email, phone, password, city, location, bannerImage, banner_image, theme } = updates || {};
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
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    updatesList.push(`password = $${paramCount}`);
    values.push(hashedPassword);
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

  if (updatesList.length === 0) {
    throw new Error('No valid fields to update');
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
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      city, 
      location, 
      theme, 
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
    
    console.log('Successfully updated seller:', result.rows[0].id);
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
    { expiresIn: process.env.JWT_EXPIRES_IN }
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

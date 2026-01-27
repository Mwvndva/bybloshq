import { pool } from '../config/database.js';

import cacheService from '../services/cache.service.js';

// Get all products (public)
export const getProducts = async (req, res) => {
  try {
    const { aesthetic, city, location } = req.query;

    // 1. Generate Cache Key based on filters
    const cacheKey = `products:list:${aesthetic || 'all'}:${city || 'all'}:${location || 'all'}`;

    // 2. Try to get from Cache
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      // Return cached response
      return res.status(200).json(cachedData);
    }

    // TODO: move filtering logic to ProductModel later when it expands
    // For now we use the raw query builder style if filters exist, or the model for simple fetch
    // Actually, let's keep the controller logic but UPDATE query to include location fields

    let query = `
      SELECT p.*,
             p.is_digital as "isDigital",
             p.digital_file_name as "digitalFileName",
             s.id as seller_id,
             s.full_name as seller_name,
             s.whatsapp_number as seller_phone,
             s.email as seller_email,
             s.city as seller_city,
             s.location as seller_location,
             s.physical_address as physical_address,
             s.latitude as latitude,
             s.longitude as longitude,
             s.avatar_url as seller_avatar_url,
             s.bio as seller_bio,
             s.shop_name as seller_shop_name,
             s.created_at as seller_created_at,
             s.updated_at as seller_updated_at
      FROM products p
      JOIN sellers s ON p.seller_id = s.id
      WHERE p.status = $1
    `;

    const queryParams = ['available']; // Only show available products
    let paramCount = 2; // Start from 2 since we already have one parameter

    // Add aesthetic filter if provided
    if (aesthetic && aesthetic !== 'all') {
      query += ` AND p.aesthetic = $${paramCount++}`;
      queryParams.push(aesthetic);
    }

    // Add city filter if provided
    if (city) {
      query += ` AND LOWER(s.city) = LOWER($${paramCount++})`;
      queryParams.push(city);

      // Add location filter if provided and city is also provided
      // Use LIKE for partial matching to allow flexible location search
      if (location) {
        query += ` AND LOWER(s.location) LIKE LOWER($${paramCount++})`;
        queryParams.push(`%${location}%`);
      }
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, queryParams);

    // Transform results to include nested seller object
    const transformedResults = result.rows.map(row => {
      const product = { ...row };

      // Create seller object
      if (row.seller_id) {
        product.seller = {
          id: row.seller_id,
          fullName: row.seller_shop_name, // Use shop name instead of full name
          full_name: row.seller_shop_name,
          email: row.seller_email,
          phone: row.seller_phone,
          location: row.seller_location,
          city: row.seller_city,
          physicalAddress: row.physical_address,
          latitude: row.latitude,
          longitude: row.longitude,
          hasPhysicalShop: !!row.physical_address,
          avatarUrl: row.seller_avatar_url,
          avatar_url: row.seller_avatar_url,
          bio: row.seller_bio,
          shopName: row.seller_shop_name,
          shop_name: row.seller_shop_name,
          createdAt: row.seller_created_at,
          created_at: row.seller_created_at,
          updatedAt: row.seller_updated_at,
          updated_at: row.seller_updated_at
        };
      }

      // Remove individual seller fields from root level
      delete product.seller_id;
      delete product.seller_name;
      delete product.seller_phone;
      delete product.seller_email;
      delete product.seller_city;
      delete product.seller_location;
      delete product.physical_address;
      delete product.latitude;
      delete product.longitude;
      delete product.seller_avatar_url;
      delete product.seller_bio;
      delete product.seller_shop_name;
      delete product.seller_created_at;
      delete product.seller_updated_at;

      return product;
    });

    const responseData = {
      status: 'success',
      results: transformedResults.length,
      data: {
        products: transformedResults
      }
    };

    // 3. Store in Cache (60 seconds)
    await cacheService.set(cacheKey, responseData, 60);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single product (public)
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, 
              s.full_name as seller_name,
              s.whatsapp_number as seller_phone,
              s.email as seller_email
       FROM products p
       JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all unique aesthetics
export const getAesthetics = async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT aesthetic FROM products WHERE status = $1', ['available']);
    const aesthetics = result.rows.map(row => row.aesthetic).filter(Boolean);

    res.status(200).json({
      status: 'success',
      data: {
        aesthetics
      }
    });
  } catch (error) {
    console.error('Error fetching aesthetics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch aesthetics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get seller public info
export const getSellerPublicInfo = async (req, res) => {
  try {
    const { id } = req.params;

    // Only select columns that exist in the sellers table
    const result = await pool.query(
      `SELECT id, full_name, email, whatsapp_number as phone, created_at, updated_at
       FROM sellers 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    // Don't expose sensitive data
    const { password, reset_token, reset_token_expiry, ...sellerData } = result.rows[0];

    res.status(200).json({
      status: 'success',
      data: {
        seller: sellerData
      }
    });
  } catch (error) {
    console.error(`Error fetching seller ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch seller information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

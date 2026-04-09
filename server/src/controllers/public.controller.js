import { pool } from '../config/database.js';

import cacheService from '../services/cache.service.js';
import { sanitizePublicProduct, sanitizePublicSeller } from '../utils/sanitize.js';

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
             s.shop_name as seller_shop_name,
             s.city as seller_city,
             s.location as seller_location,
             s.physical_address as physical_address,
             s.latitude as latitude,
             s.longitude as longitude,
             s.avatar_url as seller_avatar_url,
             s.bio as seller_bio,
             s.theme as seller_theme,
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

    // Transform results to use sanitization DTOs
    const sanitizedProducts = result.rows.map(row => {
      const product = sanitizePublicProduct(row);

      // Inject nested seller info (also sanitized)
      product.seller = sanitizePublicSeller({
        ...row,
        id: row.seller_id,
        shopName: row.seller_shop_name,
        city: row.seller_city,
        location: row.seller_location,
        physicalAddress: row.physical_address,
        avatarUrl: row.seller_avatar_url,
        bio: row.seller_bio,
        theme: row.seller_theme,
      });

      return product;
    });

    const responseData = {
      status: 'success',
      results: sanitizedProducts.length,
      data: {
        products: sanitizedProducts
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
              s.shop_name,
              s.city as seller_city,
              s.location as seller_location,
              s.theme as seller_theme,
              s.physical_address,
              s.latitude,
              s.longitude
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

    const product = sanitizePublicProduct(result.rows[0]);
    product.seller = sanitizePublicSeller({
      ...result.rows[0],
      shopName: result.rows[0].shop_name,
      city: result.rows[0].seller_city,
      location: result.rows[0].seller_location,
      theme: result.rows[0].seller_theme,
      physicalAddress: result.rows[0].physical_address
    });

    res.status(200).json({
      status: 'success',
      data: { product }
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
    const cacheKey = 'products:aesthetics';
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const result = await pool.query('SELECT DISTINCT aesthetic FROM products WHERE status = $1', ['available']);
    const aesthetics = result.rows.map(row => row.aesthetic).filter(Boolean);

    const responseData = {
      status: 'success',
      data: {
        aesthetics
      }
    };

    await cacheService.set(cacheKey, responseData, 600); // 10 mins cache

    res.status(200).json(responseData);
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
      `SELECT id, shop_name, city, location, theme, created_at, updated_at
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

    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizePublicSeller(result.rows[0])
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
// Get all active sellers with wishlist count
export const getSellers = async (req, res) => {
  try {
    const cacheKey = 'public:sellers:list';
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const query = `
      SELECT 
        s.id, 
        s.full_name, 
        s.shop_name, 
        s.banner_image,
        s.theme,
        s.client_count,
        s.created_at,
        COUNT(w.id) as total_wishlist_count
      FROM sellers s
      LEFT JOIN products p ON s.id = p.seller_id
      LEFT JOIN wishlists w ON p.id = w.product_id
      GROUP BY s.id
      ORDER BY total_wishlist_count DESC
    `;

    const result = await pool.query(query);

    const sellers = result.rows.map(row => ({
      id: row.id,
      shopName: row.shop_name,
      shopLink: row.shop_name, // Use shop_name as the link slug
      bannerUrl: row.banner_image, // Mapped from banner_image
      avatarUrl: null, // avatar_url not available in sellers table
      theme: row.theme, // Mapped from theme
      clientCount: row.client_count || 0,
      totalWishlistCount: parseInt(row.total_wishlist_count, 10) || 0,
      createdAt: row.created_at
    }));

    const responseData = {
      status: 'success',
      results: sellers.length,
      data: {
        sellers
      }
    };

    await cacheService.set(cacheKey, responseData, 300); // 5 mins cache

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sellers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

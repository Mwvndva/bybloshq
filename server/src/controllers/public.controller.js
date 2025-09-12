import { pool } from '../config/database.js';

// Get all products (public)
export const getProducts = async (req, res) => {
  try {
    const { aesthetic } = req.query;
    
    let query = `
      SELECT p.*, 
             s.full_name as seller_name,
             s.phone as seller_phone,
             s.email as seller_email
      FROM products p
      JOIN sellers s ON p.seller_id = s.id
      WHERE p.status = $1
    `;
    
    const queryParams = ['available']; // Only show available products
    let paramCount = 2; // Start from 2 since we already have one parameter
    
    if (aesthetic && aesthetic !== 'all') {
      query += ` AND p.aesthetic = $${paramCount++}`;
      queryParams.push(aesthetic);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(query, queryParams);
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        products: result.rows
      }
    });
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
              s.phone as seller_phone,
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
      `SELECT id, full_name, email, phone, created_at, updated_at
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

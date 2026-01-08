import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

// Upload digital file handler
export const uploadDigitalFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    // Return the file path relative to server root or a downloadable URL structure
    // We'll store the relative path for now
    const filePath = `uploads/digital_products/${req.file.filename}`;

    res.status(200).json({
      status: 'success',
      data: {
        filePath,
        fileName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Error uploading digital file:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload file'
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      image,
      image_url,
      aesthetic = 'noir',
      // Digital Product Fields
      is_digital = false,
      digital_file_path,
      digital_file_name,
      // Service Product Fields
      product_type = 'physical',
      service_locations,
      service_options
    } = req.body;

    const sellerId = req.user?.id;

    logger.info('Received product data:', {
      name: name?.substring(0, 50),
      price,
      description: description?.substring(0, 50) + '...',
      imageLength: image?.length || 0,
      imageUrlLength: image_url?.length || 0,
      aesthetic,
      sellerId,
      is_digital,
      digital_file_name,
      product_type,
      service_locations,
      service_options
    });

    // Validate required fields
    if (!sellerId) {
      logger.error('No seller ID found in request');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Check for required fields
    if (!name || !price || !description || (!image && !image_url)) {
      logger.error('Missing required fields:', { name: !!name, price: !!price, description: !!description, image: !!image, image_url: !!image_url });
      return res.status(400).json({
        status: 'error',
        message: 'Name, price, description, and image are required'
      });
    }

    // Validate digital product fields if is_digital is true
    if (is_digital && !digital_file_path) {
      return res.status(400).json({
        status: 'error',
        message: 'Digital file is required for digital products'
      });
    }

    // Validate product_type enum
    const validProductTypes = ['physical', 'digital', 'service'];
    if (product_type && !validProductTypes.includes(product_type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid product type. Must be one of: physical, digital, service'
      });
    }

    // Validate service product fields
    if (product_type === 'service' && (!service_options || !service_options.availability_days)) {
      return res.status(400).json({
        status: 'error',
        message: 'Availability days are required for services'
      });
    }

    // Use image_url if provided, otherwise fall back to image
    const imageData = image_url || image;

    // Validate image format
    if (!imageData.startsWith('data:image/')) {
      logger.error('Invalid image format:', imageData?.substring(0, 50));
      return res.status(400).json({
        status: 'error',
        message: 'Invalid image format. Must be a data URL starting with data:image/'
      });
    }

    // Validate image size (max 2MB)
    const imageSize = (imageData.length * 0.75); // Convert base64 to bytes
    if (imageSize > 2 * 1024 * 1024) { // 2MB
      logger.error('Image size exceeds limit:', { size: imageSize });
      return res.status(400).json({
        status: 'error',
        message: 'Image size exceeds 2MB limit'
      });
    }

    logger.info('Creating product with validated image data');

    // Determine final product_type if strictly is_digital passed
    let finalProductType = product_type;
    if (is_digital) finalProductType = 'digital';

    // Insert into database
    const result = await pool.query(
      `INSERT INTO products (
        name, 
        price, 
        description, 
        image_url, 
        seller_id, 
        aesthetic,
        status,
        created_at,
        updated_at,
        is_digital,
        digital_file_path,
        digital_file_name,
        product_type,
        service_locations,
        service_options
      ) VALUES ($1, $2, $3, $4, $5, $6, 'available', NOW(), NOW(), $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name.trim(),
        parseFloat(price),
        description.trim(),
        imageData, // Store the full data URL
        sellerId,
        aesthetic,
        is_digital || false,
        digital_file_path || null,
        digital_file_name || null,
        finalProductType,
        service_locations || null,
        service_options || null
      ]
    );

    const product = result.rows[0];
    logger.info('Product created successfully:', {
      id: product.id,
      name: product.name,
      imageUrlLength: product.image_url?.length || 0,
      isDigital: product.is_digital,
      productType: product.product_type
    });

    if (!product) {
      throw new Error('Failed to create product - no product returned from database');
    }

    res.status(201).json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create product'
    });
  }
};

export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    logger.info('Fetching products for seller:', sellerId);

    // First check if the seller exists
    const sellerCheck = await pool.query('SELECT id FROM sellers WHERE id = $1', [sellerId]);
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    const query = `
      SELECT 
        p.*,
        p.created_at AS "createdAt",
        p.is_digital AS "isDigital",
        p.digital_file_name AS "digitalFileName",
        p.product_type AS "productType",
        p.service_locations AS "serviceLocations",
        p.service_options AS "serviceOptions",
        p.sold_at AS "soldAt"
      FROM products p
      WHERE p.seller_id = $1 
      ORDER BY p.created_at DESC
    `;

    logger.debug('Executing query:', query);

    const result = await pool.query(query, [sellerId]);

    // Transform null status/soldAt if needed (though now strict schema enforces defaults usually)
    const products = result.rows.map(p => ({
      ...p,
      status: p.status || 'published',
      soldAt: p.soldAt || null
    }));

    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products'
    });
  }
};

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    const query = `
      SELECT 
        p.*,
        p.created_at AS "createdAt",
        p.is_digital AS "isDigital",
        p.digital_file_name AS "digitalFileName",
        p.product_type AS "productType",
        p.service_locations AS "serviceLocations",
        p.service_options AS "serviceOptions",
        p.sold_at AS "soldAt"
      FROM products p
      WHERE p.id = $1 AND p.seller_id = $2
    `;

    logger.debug('Executing query:', query);

    const result = await pool.query(query, [id, sellerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found or unauthorized'
      });
    }

    const product = result.rows[0];

    // Normalize aliases
    product.status = product.status || 'published';
    product.soldAt = product.soldAt || null;

    res.status(200).json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateProduct = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const { name, price, description, image_url, aesthetic, status, soldAt } = req.body;

    logger.info('Updating product with data:', {
      id,
      sellerId,
      name,
      price,
      description,
      image_url: image_url ? '[image data present]' : 'no image',
      aesthetic,
      status,
      soldAt: soldAt ? '[soldAt provided]' : 'not provided'
    });

    // Start a transaction
    await client.query('BEGIN');

    // Check if columns exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      AND column_name IN ('sold_at', 'updated_at');
    `);

    const soldAtColumnExists = checkColumns.rows.some(row => row.column_name === 'sold_at');
    const updatedAtColumnExists = checkColumns.rows.some(row => row.column_name === 'updated_at');

    logger.debug('Database columns:', { soldAtColumnExists, updatedAtColumnExists });

    // Verify the product exists and belongs to the seller
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 AND seller_id = $2 FOR UPDATE',
      [id, sellerId]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.error('Product not found or unauthorized:', { id, sellerId });
      return res.status(404).json({
        status: 'error',
        message: 'Product not found or unauthorized'
      });
    }

    // Update only the fields that were provided
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    // Standard fields
    const standardFields = {
      name,
      price: price !== undefined ? parseFloat(price) : undefined,
      description,
      image_url,
      aesthetic
    };

    // Add standard fields to update (excluding status as we handle it separately)
    Object.entries(standardFields).forEach(([field, value]) => {
      if (value !== undefined && field !== 'status') {  // Skip status here as we handle it with soldAt
        updateFields.push(`${field} = $${paramCount++}`);
        updateValues.push(value);
      }
    });

    // Handle soldAt and status updates if sold_at column exists
    if (soldAtColumnExists) {
      if (soldAt !== undefined) {
        // If soldAt is being set, update both sold_at and status
        updateFields.push(`sold_at = $${paramCount++}`);
        updateValues.push(soldAt);

        // Update status based on soldAt value
        const newStatus = soldAt ? 'sold' : 'available';
        updateFields.push(`status = $${paramCount++}`);
        updateValues.push(newStatus);
      } else if (status) {
        // If status is explicitly provided, update it
        updateFields.push(`status = $${paramCount++}`);
        updateValues.push(status);
      }
    }

    // If no fields to update, return early
    if (updateFields.length === 0) {
      await client.query('COMMIT');
      return res.status(200).json({
        status: 'success',
        data: {
          product: productResult.rows[0]
        }
      });
    }

    // Add updated_at timestamp if the column exists
    if (updatedAtColumnExists) {
      updateFields.push(`updated_at = NOW()`);
    }

    // Add the ID parameters for the WHERE clause
    updateValues.push(id);
    updateValues.push(sellerId);

    // Log the update query for debugging
    logger.debug('Update query:', {
      query: `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${updateValues.length - 1} AND seller_id = $${updateValues.length} RETURNING *`,
      values: updateValues,
      paramCount,
      updateFields,
      updateValuesLength: updateValues.length
    });

    const query = `
      UPDATE products 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND seller_id = $${paramCount}
      RETURNING *
    `;

    logger.debug('Executing update query:', {
      query: query.replace(/\s+/g, ' ').trim(),
      values: updateValues.map(v =>
        typeof v === 'string' && v.length > 50 ? '[long string]' : v
      )
    });

    let result;
    try {
      result = await client.query(query, updateValues);
    } catch (queryError) {
      logger.error('Database query error:', {
        error: queryError,
        query,
        params: updateValues,
        stack: queryError.stack
      });
      throw queryError; // Re-throw to be caught by the outer catch
    }

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.error('No rows affected by update');
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update product'
      });
    }

    await client.query('COMMIT');

    logger.info('Product updated successfully:', result.rows[0]);

    res.status(200).json({
      status: 'success',
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    logger.error('Error updating product:', error);

    // Rollback transaction if it's still active
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Error rolling back transaction:', rollbackError);
    }

    // Check for specific error types
    let errorMessage = 'Failed to update product';
    let statusCode = 500;

    if (error.code === '23505') { // Unique violation
      errorMessage = 'A product with this name already exists';
      statusCode = 400;
    } else if (error.code === '23503') { // Foreign key violation
      errorMessage = 'Invalid reference in product data';
      statusCode = 400;
    } else if (error.code === '22P02') { // Invalid text representation
      errorMessage = 'Invalid data format';
      statusCode = 400;
    }

    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id; // Changed from req.seller.id to req.user.id

    // First verify the product exists and belongs to the seller
    const productResult = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND seller_id = $2',
      [id, sellerId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found or unauthorized'
      });
    }

    await pool.query('DELETE FROM products WHERE id = $1 AND seller_id = $2', [id, sellerId]);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete product'
    });
  }
};

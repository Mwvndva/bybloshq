import { pool } from '../config/database.js';

export const getSellerOrders = async (req, res) => {
  console.log('[SellerOrderController] Fetching seller orders...');
  const sellerId = req.user.id;
  
  try {
    // Get all products for this seller first using parameterized query
    const productsResult = await pool.query(
      'SELECT id FROM products WHERE seller_id = $1',
      [sellerId]
    );
    
    if (!productsResult.rows.length) {
      return res.json({ success: true, data: [] });
    }
    
    // Get all product IDs for the seller
    const productIds = productsResult.rows.map(p => p.id);
    
    if (!productIds.length) {
      return res.json({ success: true, data: [] });
    }
    
    // First, let's log the product IDs to verify their format
    console.log('Product IDs:', productIds);
    
    console.log('Product IDs (raw):', productIds);
    
    // Convert all product IDs to strings to match the order_items.product_id type
    const stringProductIds = productIds.map(id => String(id));
    console.log('Product IDs (as strings):', stringProductIds);
    
    // Simple query that handles the type casting explicitly
    const query = `
      WITH seller_products AS (
        -- Get all products for this seller, ensuring we have them as both text and integer
        SELECT 
          id,
          id::text as id_text
        FROM products 
        WHERE id::text = ANY($1::text[])
      )
      SELECT 
        o.*, 
        oi.id as item_id,
        oi.quantity,
        oi.product_price as price,
        oi.subtotal,
        p.id as product_id,
        p.name as product_name,
        p.image_url as product_image,
        json_build_object(
          'first_name', b.full_name,
          'last_name', '',
          'email', b.email
        ) as customer_info
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN seller_products sp ON oi.product_id = sp.id_text
      JOIN products p ON p.id = sp.id
      JOIN buyers b ON o.buyer_id = b.id
      ORDER BY o.created_at DESC
    `;
    
    // Log the query for debugging
    console.log('Using query with product IDs:', stringProductIds);
    
    // Execute the query with string product IDs
    const result = await pool.query(query, [stringProductIds]);
    const allOrders = result.rows;
    
    // Debug: Log the raw data we got from the database
    console.log('Raw orders from database:', JSON.stringify(allOrders, null, 2));
    
    // Group orders by order_id and include customer info
    const ordersMap = new Map();
    
    for (const row of allOrders) {
      const orderId = row.id;
      
      if (!ordersMap.has(orderId)) {
        const { 
          item_id, 
          product_id, 
          product_name, 
          product_image,
          customer_info,
          ...order 
        } = row;
        
        // Format the order to match frontend expectations
        ordersMap.set(orderId, {
          ...order,
          // Ensure numeric values are numbers
          total_amount: order.total_amount ? Number(order.total_amount) : 0,
          subtotal: order.subtotal ? Number(order.subtotal) : 0,
          shipping_cost: order.shipping_cost ? Number(order.shipping_cost) : 0,
          tax_amount: order.tax_amount ? Number(order.tax_amount) : 0,
          discount_amount: order.discount_amount ? Number(order.discount_amount) : 0,
          status: order.status || 'pending',
          created_at: order.created_at || new Date().toISOString(),
          updated_at: order.updated_at || new Date().toISOString(),
          // Add shipping_address with required fields
          shipping_address: {
            first_name: customer_info?.first_name || 'Customer',
            last_name: customer_info?.last_name || '',
            email: customer_info?.email || '',
            phone: order.phone || '',
            address1: order.shipping_address?.address1 || '',
            address2: order.shipping_address?.address2 || '',
            city: order.shipping_address?.city || '',
            country: order.shipping_address?.country || '',
            postal_code: order.shipping_address?.postal_code || ''
          },
          items: []
        });
      }
      
      const order = ordersMap.get(orderId);
      
      // Only add the item if it's not already in the items array
      if (!order.items.some(item => item.id === row.item_id)) {
        order.items.push({
          id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_image: row.product_image,
          quantity: Number(row.quantity) || 0,
          price: row.price ? Number(row.price) : 0,
          subtotal: row.subtotal ? Number(row.subtotal) : 0
        });
      }
    }
    
    // Convert map values to array (already sorted by created_at in the SQL query)
    const orders = Array.from(ordersMap.values());
    
    res.json({ success: true, data: orders });
    
  } catch (error) {
    console.error('[SellerOrderController] Error fetching seller orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Mark an order as delivered
export const markOrderAsDelivered = async (req, res) => {
  const { orderId } = req.params;
  const sellerId = req.user.id;
  
  try {
    // First verify that the order contains items from this seller
    const verifyResult = await pool.query(
      `SELECT oi.order_id 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id::text
       WHERE oi.order_id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [orderId, sellerId]
    );
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to this seller'
      });
    }
    
    // Update the order status to 'delivered'
    const updateResult = await pool.query(
      `UPDATE orders 
       SET status = 'delivered', 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [orderId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
    
    res.json({
      success: true,
      message: 'Order marked as delivered',
      order: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('[SellerOrderController] Error marking order as delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const sellerId = req.user.id;
  
  try {
    // First verify that the order contains items from this seller
    const verifyResult = await pool.query(
      `SELECT 1 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [orderId, sellerId]
    );
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not authorized'
      });
    }
    
    // Update the order status
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

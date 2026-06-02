import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

class OrderReadService {
  static async getSellerDetails(client, sellerId) {
    try {
      let sellerCheck;
      try {
        sellerCheck = await client.query(
          'SELECT id, user_id, physical_address, latitude, longitude, city, location, status FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
          [sellerId, 'active']
        );
      } catch (schemaError) {
        logger.warn('Seller schema issue, trying minimal query:', schemaError);
        sellerCheck = await client.query(
          'SELECT id, user_id, latitude, longitude FROM sellers WHERE id = $1 FOR UPDATE',
          [sellerId]
        );
      }

      if (sellerCheck.rows.length === 0) {
        throw new Error(`Seller with ID ${sellerId} not found or inactive`);
      }

      const sellerInfo = sellerCheck.rows[0];

      if (sellerInfo.user_id) {
        const userCheck = await client.query(
          'SELECT id, email, role FROM users WHERE id = $1',
          [sellerInfo.user_id]
        );

        if (userCheck.rows.length > 0) {
          const userInfo = userCheck.rows[0];
          sellerInfo.full_name = userInfo.role === 'seller' ? 'Seller' : userInfo.email;
          sellerInfo.email = userInfo.email;
          sellerInfo.whatsapp_number = null;

          try {
            const buyerContactCheck = await client.query(
              'SELECT full_name, whatsapp_number FROM buyers WHERE user_id = $1 LIMIT 1',
              [sellerInfo.user_id]
            );

            if (buyerContactCheck.rows.length > 0) {
              const buyerInfo = buyerContactCheck.rows[0];
              sellerInfo.full_name = sellerInfo.full_name || buyerInfo.full_name;
              sellerInfo.whatsapp_number = sellerInfo.whatsapp_number || buyerInfo.whatsapp_number;
            }
          } catch (buyerError) {
            logger.debug('Could not fetch buyer contact info:', buyerError);
          }
        }
      }

      sellerInfo.name = sellerInfo.full_name || 'Unknown Seller';
      return sellerInfo;
    } catch (err) {
      logger.error(`Error fetching seller info for ID ${sellerId}:`, err);
      throw err;
    }
  }

  static async getStatusNotificationDetails(orderId) {
    const fullOrderResult = await pool.query(
      `SELECT o.*, 
              b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, 
              b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
              b.latitude AS buyer_latitude, b.longitude AS buyer_longitude,
              COALESCE(s.full_name, u.email, 'Unknown Seller') as seller_name, 
              COALESCE(s.whatsapp_number, NULL) as seller_phone, 
              s.whatsapp_number as seller_whatsapp, 
              COALESCE(s.email, u.email) as seller_email, 
              s.physical_address as seller_address, s.shop_name,
              s.latitude as seller_latitude, s.longitude as seller_longitude,
              s.instagram_link, s.tiktok_link, s.facebook_link
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       LEFT JOIN sellers s ON o.seller_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (fullOrderResult.rows.length === 0) return null;

    const itemsResult = await pool.query(
      `SELECT oi.*, p.product_type::text as product_type, p.is_digital, p.name as product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    return { fullOrder: fullOrderResult.rows[0], items: itemsResult.rows };
  }

  static async getReceiptNotificationDetails(orderId) {
    const fullOrderResult = await pool.query(
      `SELECT o.*, 
              b.full_name          AS buyer_name_actual,
              b.mobile_payment     AS buyer_phone_actual,
              b.whatsapp_number    AS buyer_whatsapp_actual,
              b.email              AS buyer_email_actual,
              b.city               AS buyer_city,
              b.location           AS buyer_location_text,
              b.latitude           AS buyer_latitude,
              b.longitude          AS buyer_longitude,
              b.full_address       AS buyer_full_address,
              COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name, 
              COALESCE(s.whatsapp_number, NULL)                AS seller_phone, 
              COALESCE(s.email, u.email)                       AS seller_email, 
              s.physical_address   AS seller_address, s.latitude AS seller_latitude, s.longitude AS seller_longitude
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       LEFT JOIN sellers s ON o.seller_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    return fullOrderResult.rows[0] || null;
  }

  static async getFulfillmentNotificationDetails(orderId) {
    const fullOrderResult = await pool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.order_type, o.fulfillment_type, 
              o.metadata, o.custom_production_deadline_at, o.custom_production_grace_deadline_at,
              o.buyer_id, o.seller_id, o.location_address, o.location_lat, o.location_lng,
              o.service_title, o.service_requirements, o.payment_status, o.payment_method, o.payment_reference,
              o.notification_sent, o.total_quantity,
              b.full_name AS buyer_name, b.mobile_payment AS buyer_mobile_payment,
              b.email AS buyer_email,
              s.full_name AS seller_name, s.shop_name, s.whatsapp_number AS seller_phone, 
              s.email AS seller_email, s.physical_address AS seller_address,
              s.latitude AS seller_latitude, s.longitude AS seller_longitude,
              s.instagram_link, s.tiktok_link, s.facebook_link
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.id = $1`,
      [orderId]
    );

    return fullOrderResult.rows[0] || null;
  }
}

export default OrderReadService;

import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';

class OrderModel {
    /**
     * Pure DAO method to insert an order record
     */
    static async insert(client, data) {
        if (!data.order_number) throw new Error('Order number is required');
        if (!data.seller_id) throw new Error('Seller ID is required');
        if (!data.buyer_email) throw new Error('buyer_email is required for DB insert');

        const query = `
      INSERT INTO product_orders (
        order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
        payment_method, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number,
        notes, metadata, status, payment_status, service_requirements, is_debt, client_id, is_seller_initiated,
        fulfillment_type, delivery_location, order_type, total_quantity, reservation_expires_at,
        location_address, location_lat, location_lng, service_title, notification_sent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        $12, $13::jsonb, $14, $15, $16::jsonb, $17, $18, $19, 
        $20, $21::jsonb, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *
    `;

        const toStrictJson = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'string') {
                try {
                    JSON.parse(val);
                    return val;
                } catch (e) {
                    return JSON.stringify(val);
                }
            }
            return JSON.stringify(val);
        };

        const values = [
            data.order_number,                                     // $1
            data.buyer_id || null,                                 // $2
            data.seller_id,                                        // $3
            data.total_amount || 0,                                // $4
            data.platform_fee_amount || 0,                         // $5
            data.seller_payout_amount || 0,                        // $6
            data.payment_method || 'payd',                         // $7
            data.buyer_name || null,                               // $8
            data.buyer_email || null,                              // $9
            data.buyer_mobile_payment || null,                     // $10
            data.buyer_whatsapp_number || null,                    // $11
            data.notes || null,                                    // $12
            toStrictJson(data.metadata),                           // $13
            data.status || 'PENDING',                              // $14
            data.payment_status || 'pending',                      // $15
            toStrictJson(data.service_requirements),               // $16
            data.is_debt || false,                                 // $17
            data.client_id || null,                                // $18
            data.is_seller_initiated || false,                    // $19
            data.fulfillment_type || null,                         // $20
            toStrictJson(data.delivery_location),                  // $21
            data.order_type || 'PHYSICAL',                         // $22
            data.total_quantity || 1,                              // $23
            data.reservation_expires_at ? new Date(data.reservation_expires_at) : null, // $24
            data.location_address || null,                         // $25
            data.location_lat || null,                             // $26
            data.location_lng || null,                             // $27
            data.service_title || null,                            // $28
            data.notification_sent || false                       // $29
        ];

        const executor = client || pool;
        const result = await executor.query(query, values);
        return result.rows[0];
    }

    static async insertItems(client, orderId, items) {
        const itemValues = items.map(item => {
            const subtotal = item.subtotal || (item.price * item.quantity);
            return [
                orderId,
                item.productId,
                item.name || `Product ${item.productId}`,
                item.price,
                item.quantity,
                subtotal,
                {
                    ...(item.metadata || {}),
                    productType: item.productType || 'physical',
                    isDigital: item.isDigital || false
                }
            ];
        });

        const itemQuery = `
      INSERT INTO order_items (
        order_id, product_id, name, price, quantity, subtotal, metadata
      ) VALUES ${itemValues.map((_, i) =>
            `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
        ).join(', ')}
      RETURNING *
    `;

        const executor = client || pool;
        const result = await executor.query(itemQuery, itemValues.flat());
        return result.rows;
    }

    static async findById(orderId) {
        const query = 'SELECT * FROM product_orders WHERE id = $1';
        const result = await pool.query(query, [orderId]);
        return result.rows[0];
    }

    static async findByOrderNumber(orderNumber) {
        const query = 'SELECT * FROM product_orders WHERE order_number = $1';
        const result = await pool.query(query, [orderNumber]);
        return result.rows[0];
    }

    static async updateStatus(client, orderId, status) {
        const query = 'UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        const executor = client || pool;
        const result = await executor.query(query, [status, orderId]);
        return result.rows[0];
    }
}

export default OrderModel;

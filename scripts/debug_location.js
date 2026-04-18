const { pool } = require('./server/src/config/database');

async function debugLocation() {
    try {
        console.log('--- FETCHING RECENT SERVICE ORDERS ---');
        const ordersRes = await pool.query(`
      SELECT id, order_number, buyer_id, fulfillment_type, location_lat, location_lng, location_address, status 
      FROM product_orders 
      WHERE order_type = 'SERVICE' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        for (const order of ordersRes.rows) {
            console.log(`\nOrder: ${order.order_number} (ID: ${order.id})`);
            console.log(`Status: ${order.status}`);
            console.log(`Fulfillment: ${order.fulfillment_type}`);
            console.log(`Order Location: ${order.location_lat}, ${order.location_lng} - ${order.location_address}`);

            if (order.buyer_id) {
                const buyerRes = await pool.query(`
          SELECT id, full_name, latitude, longitude, full_address 
          FROM buyers 
          WHERE id = $1
        `, [order.buyer_id]);

                if (buyerRes.rows.length > 0) {
                    const buyer = buyerRes.rows[0];
                    console.log(`Buyer Profile: ${buyer.full_name} (ID: ${buyer.id})`);
                    console.log(`Buyer Location: ${buyer.latitude}, ${buyer.longitude} - ${buyer.full_address}`);
                } else {
                    console.log(`Buyer ID ${order.buyer_id} not found in buyers table!`);
                }
            }
        }
    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await pool.end();
    }
}

debugLocation();

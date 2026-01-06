
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { pool } = await import('../src/config/database.js');
const { default: Order } = await import('../src/models/order.model.js');

const API_URL = 'http://localhost:3000/api/payments/webhook/payd'; // Ensure port matches server

async function runCallbackTest() {
    const client = await pool.connect();
    try {
        console.log('=== INTEGRATION TEST: REAL WEBHOOK ===');

        // 1. Setup Data - Seller/Buyer
        const sellerId = await getOrCreateSeller(client);
        const buyerId = await getOrCreateBuyer(client);

        // 2. Create Digital Product
        const productId = await createDigitalProduct(client, sellerId);

        // 3. Create Order
        const orderData = {
            buyerId: buyerId,
            sellerId: sellerId,
            paymentMethod: 'payd',
            buyerName: 'Webhook Tester',
            buyerEmail: 'webhook@test.com',
            buyerPhone: '254722222222',
            metadata: {
                items: [{
                    productId: productId,
                    name: 'Webhook Digital Item',
                    price: 50,
                    quantity: 1,
                    subtotal: 50,
                    productType: 'digital',
                    isDigital: true
                }],
                product_type: 'digital',
                is_digital: true
            }
        };
        const order = await Order.createOrder(orderData);
        console.log(`Created Order ${order.id}`);

        // 4. Create Payment (Pending)
        const reference = 'PAYD-TEST-' + Date.now();
        await client.query(`
      INSERT INTO payments (
        invoice_id, amount, currency, status, payment_method, phone_number, email, 
        provider_reference, api_ref, metadata
      ) VALUES ($1, $2, 'KES', 'pending', 'payd', '254722222222', 'webhook@test.com', $3, $3, $4)
    `, [order.id, 50, reference, { order_id: order.id, product_type: 'digital' }]);

        console.log(`Created Payment with Ref: ${reference}`);

        // 5. Send HTTP Webhook to Server
        console.log(`Sending Webhook to ${API_URL}...`);
        const payload = {
            transaction_reference: reference, // Payd field
            reference: reference,             // Fallback
            result_code: 200,
            status: 'SUCCESS',
            amount: 50,
            phone_number: '254722222222'
        };

        try {
            const response = await axios.post(API_URL, payload);
            console.log('Server Response:', response.status, response.data);
        } catch (e) {
            console.error('Webhook Request Failed:', e.message);
            if (e.code === 'ECONNREFUSED') {
                console.error('Is the server running on port 3001?');
            }
            throw e;
        }

        // 6. Verify DB Update
        // Wait a moment for async processing
        await new Promise(r => setTimeout(r, 2000));

        const check = await client.query('SELECT status, payment_status FROM product_orders WHERE id = $1', [order.id]);
        const finalOrder = check.rows[0];
        console.log(`Final Order Status: ${finalOrder.status} (Expected: COMPLETED)`);

        if (finalOrder.status === 'COMPLETED') {
            console.log('SUCCESS: Webhook triggered completion correctly.');
        } else {
            console.error('FAILURE: Logic did not update status. Webhook might have been ignored or failed internally.');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

// Helpers (Same as before)
async function getOrCreateSeller(client) {
    const res = await client.query('SELECT id FROM sellers LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;
    const userRes = await client.query(`INSERT INTO users (email, password, role) VALUES ('wh_seller@test.com', 'hash', 'seller') ON CONFLICT DO NOTHING RETURNING id`);
    const uid = userRes.rows[0]?.id || (await client.query("SELECT id FROM users WHERE email='wh_seller@test.com'")).rows[0].id;
    const sellerRes = await client.query(`INSERT INTO sellers (user_id, store_name, status, phone) VALUES ($1, 'WH Store', 'active', '254700000000') RETURNING id`, [uid]);
    return sellerRes.rows[0].id;
}

async function getOrCreateBuyer(client) {
    const res = await client.query('SELECT id FROM buyers LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;
    const buyerRes = await client.query(`INSERT INTO buyers (email, full_name, phone, password_hash) VALUES ('wh_buyer@test.com', 'WH Buyer', '254711111111', 'hash') RETURNING id`);
    return buyerRes.rows[0].id;
}

async function createDigitalProduct(client, sellerId) {
    const query = `
    INSERT INTO products (
      seller_id, name, description, price, 
      image_url, status, product_type, is_digital,
      aesthetic, digital_file_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;
    const values = [
        sellerId, 'Webhook Dig Item', 'Desc', 50,
        'http://img.com', 'available', 'digital', true,
        'modern', 'file.pdf'
    ];
    const res = await client.query(query, values);
    return res.rows[0].id;
}

runCallbackTest();

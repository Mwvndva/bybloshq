
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { pool } = await import('../src/config/database.js');
const { default: PaymentService } = await import('../src/services/payment.service.js');
const { default: Order } = await import('../src/models/order.model.js');
import { v4 as uuidv4 } from 'uuid';

async function testDigitalFlow() {
    const client = await pool.connect();
    try {
        console.log('=== STARTING DIGITAL FLOW TEST ===');

        // 1. Get or Create Seller/Buyer
        const sellerId = await getOrCreateSeller(client);
        const buyerId = await getOrCreateBuyer(client);
        console.log(`Using Seller ${sellerId} and Buyer ${buyerId}`);

        // 2. Create a Digital Product
        const productId = await createDigitalProduct(client, sellerId);
        console.log('Created Digital Product:', productId);

        // 3. Create an Order
        const orderData = {
            buyerId: buyerId,
            sellerId: sellerId,
            paymentMethod: 'payd',
            buyerName: 'Test Buyer',
            buyerEmail: 'test@example.com',
            buyerPhone: '254123456789',
            metadata: {
                items: [{
                    productId: productId,
                    name: 'Test Digital Product',
                    price: 100,
                    quantity: 1,
                    subtotal: 100,
                    productType: 'digital',
                    isDigital: true
                }],
                product_type: 'digital',
                is_digital: true
            }
        };

        const order = await Order.createOrder(orderData);
        console.log('Created Order:', order.id, 'Status:', order.status);

        if (order.status !== 'PENDING') {
            console.warn('Initial status should be PENDING, got:', order.status);
        }

        // 4. Create Payment Record (Pending)
        const reference = 'REF-' + Date.now();

        // Check if payments table has invoice_id
        const insertPaymentQuery = `
      INSERT INTO payments (
        invoice_id, amount, currency, status, payment_method, phone_number, email, 
        provider_reference, api_ref, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

        const paymentValues = [
            order.id.toString(), '100', 'KES', 'pending', 'payd', '254123456789', 'test@example.com',
            reference, reference,
            {
                order_id: order.id,
                product_id: productId,
                product_type: 'digital',
                is_digital: true
            }
        ];

        const paymentResult = await client.query(insertPaymentQuery, paymentValues);
        const paymentDbId = paymentResult.rows[0].id;
        console.log('Created Pending Payment:', paymentDbId);

        // 5. Simulate Webhook
        console.log('Simulating Webhook...');
        const webhookData = {
            reference: reference,
            amount: 100,
            metadata: {
                phone: '254123456789',
                invoice_id: order.id.toString()
            }
        };

        const result = await PaymentService.handleSuccessfulPayment(webhookData);
        console.log('Webhook Result:', result);

        // 6. Check Order Status
        const updatedOrderResult = await client.query('SELECT status, payment_status FROM product_orders WHERE id = $1', [order.id]);
        const updatedOrder = updatedOrderResult.rows[0];

        console.log('Updated Order Status:', updatedOrder.status);
        console.log('Updated Payment Status:', updatedOrder.payment_status);

        if (updatedOrder.status === 'COMPLETED' && updatedOrder.payment_status === 'completed') {
            console.log('SUCCESS: Digital order completed correctly.');
        } else {
            console.error('FAILURE: Digital order status incorrect.');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

async function getOrCreateSeller(client) {
    const res = await client.query('SELECT id FROM sellers LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;

    // Create user first
    const userRes = await client.query(`
    INSERT INTO users (email, password, role) VALUES ('seller@test.com', 'hash', 'seller') 
    ON CONFLICT DO NOTHING RETURNING id
  `);
    let userId = userRes.rows[0]?.id;
    if (!userId) {
        const existing = await client.query("SELECT id FROM users WHERE email='seller@test.com'");
        userId = existing.rows[0].id;
    }

    const sellerRes = await client.query(`
    INSERT INTO sellers (user_id, store_name, status, phone) 
    VALUES ($1, 'Test Store', 'active', '254700000000') RETURNING id
  `, [userId]);
    return sellerRes.rows[0].id;
}

async function getOrCreateBuyer(client) {
    const res = await client.query('SELECT id FROM buyers LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;

    const buyerRes = await client.query(`
    INSERT INTO buyers (email, full_name, phone, password_hash) 
    VALUES ('buyer@test.com', 'Test Buyer', '254711111111', 'hash') RETURNING id
  `);
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
        sellerId, 'Test Digital Doc', 'A test PDF', 100,
        'http://example.com/image.jpg', 'available', 'digital', true,
        'minimalist', 'test.pdf'
    ];
    const res = await client.query(query, values);
    return res.rows[0].id;
}

testDigitalFlow();

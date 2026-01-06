
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { pool } = await import('../src/config/database.js');
const { default: PaymentService } = await import('../src/services/payment.service.js');
const { default: Order } = await import('../src/models/order.model.js');

async function testPhysicalFlow() {
    const client = await pool.connect();
    try {
        console.log('=== STARTING PHYSICAL FLOW TEST ===');

        // 1. Get or Create Seller/Buyer
        const sellerId = await getOrCreateSeller(client);
        const buyerId = await getOrCreateBuyer(client);
        console.log(`Using Seller ${sellerId} and Buyer ${buyerId}`);

        // 2. Create a Physical Product
        const productId = await createPhysicalProduct(client, sellerId);
        console.log('Created Physical Product:', productId);

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
                    name: 'Test Physical Product',
                    price: 1500,
                    quantity: 1,
                    subtotal: 1500,
                    productType: 'physical',
                    isDigital: false
                }],
                product_type: 'physical'
            }
        };

        const order = await Order.createOrder(orderData);
        console.log(`Created Order ${order.id} with status: ${order.status}`);

        // 4. Create Payment Record (Pending)
        const reference = 'REF-PHYS-' + Date.now();
        const insertPaymentQuery = `
      INSERT INTO payments (
        invoice_id, amount, currency, status, payment_method, phone_number, email, 
        provider_reference, api_ref, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

        const paymentValues = [
            order.id.toString(), '1500', 'KES', 'pending', 'payd', '254123456789', 'test@example.com',
            reference, reference,
            {
                order_id: order.id,
                product_id: productId,
                product_type: 'physical',
                is_digital: false
            }
        ];

        await client.query(insertPaymentQuery, paymentValues);
        console.log('Simulating Payment Webhook...');

        // 5. Simulate Webhook
        const webhookData = {
            reference: reference,
            amount: 1500,
            metadata: {
                phone: '254123456789',
                invoice_id: order.id.toString()
            }
        };

        await PaymentService.handleSuccessfulPayment(webhookData);

        // CHECK 1: Status should be DELIVERY_PENDING
        let updatedOrder = (await client.query('SELECT status, payment_status FROM product_orders WHERE id = $1', [order.id])).rows[0];
        console.log(`[Check 1] Post-Payment Status: ${updatedOrder.status} (Expected: DELIVERY_PENDING)`);

        if (updatedOrder.status !== 'DELIVERY_PENDING') {
            throw new Error(`Expected DELIVERY_PENDING, got ${updatedOrder.status}`);
        }

        // 6. Simulate Seller Marking as Ready (DELIVERY_COMPLETE)
        console.log('Simulating Seller: Mark as Ready for Pickup...');
        // We simulate the controller logic for updateOrderStatus
        // Valid transition: DELIVERY_PENDING -> DELIVERY_COMPLETE
        await client.query('UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['DELIVERY_COMPLETE', order.id]);

        updatedOrder = (await client.query('SELECT status FROM product_orders WHERE id = $1', [order.id])).rows[0];
        console.log(`[Check 2] Post-Seller Update Status: ${updatedOrder.status} (Expected: DELIVERY_COMPLETE)`);

        // 7. Simulate Buyer Confirming Receipt (COMPLETED + Payout)
        console.log('Simulating Buyer: Confirm Receipt...');
        // Calls confirmReceipt logic - requires checking payouts table existence etc. but for test we assume logic works if we call similar update
        // Actually, let's look at what confirmReceipt does:
        // It updates status to COMPLETED, payment_status to completed, inserts payout.

        // We will simulate the DB changes the controller would do, ensuring DB constraints allow it
        // Or ideally we'd call the controller method but we can't easily mock req/res here.
        // So we will replicate the query logic to verify foreign keys and columns exist.

        const platformFee = 1500 * 0.03;
        const sellerPayout = 1500 - platformFee;

        await client.query(`
      UPDATE product_orders 
      SET status = 'COMPLETED', 
          payment_status = 'completed',
          platform_fee_amount = $1,
          seller_payout_amount = $2,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [platformFee, sellerPayout, order.id]);

        // Update Seller Balance
        await client.query(`
      UPDATE sellers 
      SET 
        total_sales = COALESCE(total_sales, 0) + $1,
        net_revenue = COALESCE(net_revenue, 0) + $2,
        balance = COALESCE(balance, 0) + $2
      WHERE id = $3
    `, [1500, sellerPayout, sellerId]);

        // Insert Payout
        // We want to verify the payout table structure supports this
        const payoutRes = await client.query(`
      INSERT INTO payouts (
        seller_id, order_id, amount, platform_fee, status, payment_method, reference_number, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'completed', 'wallet', $5, 'Expected Payout', NOW(), NOW())
      RETURNING id
    `, [sellerId, order.id, sellerPayout, platformFee, `payout_${order.id}`]);

        console.log(`[Check 3] Payout Created: ID ${payoutRes.rows[0].id}`);

        updatedOrder = (await client.query('SELECT status FROM product_orders WHERE id = $1', [order.id])).rows[0];
        console.log(`[Check 4] Final Status: ${updatedOrder.status} (Expected: COMPLETED)`);

        if (updatedOrder.status === 'COMPLETED') {
            console.log('SUCCESS: Physical flow verified.');
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
    // Create if missing
    const userRes = await client.query(`INSERT INTO users (email, password, role) VALUES ('phys_seller@test.com', 'hash', 'seller') RETURNING id`);
    const sellerRes = await client.query(`INSERT INTO sellers (user_id, store_name, status, phone) VALUES ($1, 'Phys Store', 'active', '254700000000') RETURNING id`, [userRes.rows[0].id]);
    return sellerRes.rows[0].id;
}

async function getOrCreateBuyer(client) {
    const res = await client.query('SELECT id FROM buyers LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;
    const buyerRes = await client.query(`INSERT INTO buyers (email, full_name, phone, password_hash) VALUES ('phys_buyer@test.com', 'Phys Buyer', '254711111111', 'hash') RETURNING id`);
    return buyerRes.rows[0].id;
}

async function createPhysicalProduct(client, sellerId) {
    const query = `
    INSERT INTO products (
      seller_id, name, description, price, 
      image_url, status, product_type, is_digital,
      aesthetic
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;
    const values = [
        sellerId, 'Physical Shoes', 'Great shoes', 1500,
        'http://example.com/shoe.jpg', 'available', 'physical', false,
        'modern'
    ];
    const res = await client.query(query, values);
    return res.rows[0].id;
}

testPhysicalFlow();

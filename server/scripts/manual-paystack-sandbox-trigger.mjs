/**
 * manual-paystack-sandbox-trigger.mjs
 *
 * ONE-OFF MANUAL VERIFICATION TOOL, paired with
 * manual-paystack-sandbox-server.mjs (must already be running, tunneled via
 * ngrok, with that tunnel URL registered as the Paystack test-mode webhook
 * URL). Creates a real pending order+payment row, fires a REAL charge
 * against Paystack's live test-mode API using their documented test M-Pesa
 * number (no PIN/OTP required), then polls the database waiting for
 * Paystack's real webhook — delivered over the internet, verified by the
 * real HMAC check, processed by the real production code — to complete it.
 *
 * Reads server/.env.sandbox.test (gitignored, holds REAL Paystack test-mode
 * keys) — deliberately NOT .env.test, which the automated suite uses with a
 * mock Paystack URL and must never make a real outbound call on every run.
 *
 * Usage: node scripts/manual-paystack-sandbox-trigger.mjs
 *    or: DOTENV_CONFIG_PATH=.env.sandbox.test node scripts/manual-paystack-sandbox-trigger.mjs
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env.sandbox.test'), override: true });

const { pool } = await import('../src/infrastructure/database/database.js');
const PaystackProviderClient = (await import('../src/infrastructure/providers/PaystackProviderClient.js')).default;
const {
  createBuyer,
  createSeller,
  createCompletedOrder
} = await import('../test/helpers/factories.js');

const TEST_MPESA_NUMBER = '0710000000'; // Paystack's official "No PIN/OTP" M-Pesa test number
const AMOUNT_KES = 10; // small, real (test-mode) amount

async function main() {
  const buyer = await createBuyer({ email: 'sandbox-verify@example.com', mobilePayment: TEST_MPESA_NUMBER });
  const seller = await createSeller({});
  const order = await createCompletedOrder({
    buyerId: buyer.id,
    sellerId: seller.id,
    totalAmount: AMOUNT_KES,
    sellerPayoutAmount: AMOUNT_KES - 10 > 0 ? AMOUNT_KES - 10 : 0,
    platformFeeAmount: 10
  });
  await pool.query("UPDATE product_orders SET status = 'PENDING', payment_status = 'pending' WHERE id = $1", [order.id]);

  const reference = `sandbox-verify-${Date.now()}`;
  const { rows: [payment] } = await pool.query(
    `INSERT INTO payments (invoice_id, amount, status, order_id, metadata)
     VALUES ($1, $2, 'pending', $3, $4::jsonb) RETURNING *`,
    [reference, AMOUNT_KES, order.id, JSON.stringify({ order_id: order.id })]
  );

  console.log(`[TRIGGER] Created order ${order.id}, payment ${payment.id}, reference ${reference}`);
  console.log('[TRIGGER] Initiating REAL Paystack test-mode charge...');

  const client = new PaystackProviderClient();
  const result = await client.initiatePayment({
    email: buyer.email,
    amount: AMOUNT_KES,
    invoice_id: reference,
    api_ref: reference,
    phone: TEST_MPESA_NUMBER,
    narration: 'Byblos sandbox verification'
  });

  console.log('[TRIGGER] Paystack charge response:', JSON.stringify(result, null, 2));
  console.log('[TRIGGER] Waiting for the real webhook to arrive at the tunneled server (up to 60s)...');

  const deadline = Date.now() + 60_000;
  let finalPayment = null;
  let finalOrder = null;
  while (Date.now() < deadline) {
    const { rows: paymentRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
    finalPayment = paymentRows[0];
    if (finalPayment.status !== 'pending') break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }
  console.log('');

  const { rows: orderRows } = await pool.query('SELECT * FROM product_orders WHERE id = $1', [order.id]);
  finalOrder = orderRows[0];

  console.log('[TRIGGER] Final payment status:', finalPayment.status);
  console.log('[TRIGGER] Final order status:', finalOrder.status, '/ payment_status:', finalOrder.payment_status);
  console.log('[TRIGGER] Payment metadata:', JSON.stringify(finalPayment.metadata, null, 2));

  if (finalPayment.status === 'completed' && finalOrder.status === 'PAID') {
    console.log('[TRIGGER] ✅ REAL end-to-end round trip verified: Paystack charge -> real webhook delivery -> signature verified -> order marked PAID.');
  } else {
    console.log('[TRIGGER] ⚠️ Did not reach a completed state within the timeout. Inspect the values above and the sandbox server log.');
  }

  console.log(`[TRIGGER] order.id=${order.id} payment.id=${payment.id} buyer.id=${buyer.id} seller.id=${seller.id} — leaving in place for inspection; clean up manually when done.`);
  await pool.end();
}

main().catch((error) => {
  console.error('[TRIGGER] Failed:', error);
  process.exit(1);
});

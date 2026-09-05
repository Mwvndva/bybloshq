// Integration tests for the post-payment fulfillment flows: digital
// purchase + download, physical goods through every handoff/collection
// variant, and service bookings. Real database, real service-layer
// functions — the same functions the real routes call — not mocks.
//
// Each order starts life via createCompletedOrder({ status: 'PAID', ... })
// (a paid-but-not-yet-fulfilled order, exactly what the fulfillment queue
// picks up in production) and is driven forward using the actual production
// services: OrderFulfillmentTransitionService.executeFulfillment (the same
// call fulfillmentQueue.service.js makes), OrderHubDropoffService,
// LogisticsRequestService, LogisticsDashboardService.updateLegStatus (the
// same call the Mzigo Ego partner dashboard makes), and OrderService's
// buyer/seller confirmation methods.
//
// One combined t.after() hook per test, registered before any resource is
// created, with explicit children-before-parents cleanup order — see
// escrowRelease.integration.test.js for why (Node's test runner runs
// t.after() hooks in registration order, not reverse).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import OrderFulfillmentTransitionService from '../src/domains/orders/order/orderFulfillmentTransition.service.js';
import OrderHubDropoffService from '../src/domains/orders/order/orderHubDropoff.service.js';
import OrderService from '../src/domains/orders/order/OrderService.js';
import LogisticsRequestService from '../src/domains/logistics/logisticsRequest.service.js';
import LogisticsDashboardService from '../src/domains/logistics/logisticsDashboard.service.js';
import LogisticsQuoteService from '../src/domains/logistics/logisticsQuote.service.js';
import paymentService from '../src/domains/payments/payments/payment.service.js';
import { findVerifiedDigitalItem } from '../src/domains/commerce/repositories/digitalDownload.repository.js';
import {
  createBuyer,
  createSeller,
  createProduct,
  createOrderItem,
  createCompletedOrder,
  createPayment,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer
} from './helpers/factories.js';

// Real coordinates: hub is CBD (Dynamic Mall), this seller/buyer point is
// deliberately outside the CBD flat-fee radius so pickup/delivery fees are
// distance-rate (not the flat CBD fee) in both quote paths.
const NAIROBI_SUBURB_LOCATION = { address: 'Kilimani, Nairobi', latitude: -1.2921, longitude: 36.7825 };

async function runFulfillment(order) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await OrderFulfillmentTransitionService.executeFulfillment(client, order);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getOrder(orderId) {
  const { rows } = await pool.query('SELECT * FROM product_orders WHERE id = $1', [orderId]);
  return rows[0];
}

async function getMzigoPartnerId() {
  const { rows } = await pool.query("SELECT id FROM logistics_partners WHERE slug = 'mzigo-ego' AND active = TRUE LIMIT 1");
  assert.ok(rows[0], 'mzigo-ego logistics partner must be seeded for logistics tests to run');
  return rows[0].id;
}

describe('Digital product: purchase fulfillment + download (integration)', () => {
  test('completing a digital order grants access, releases escrow, and the buyer can download; a stranger cannot', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    const stranger = await createBuyer({});
    t.after(async () => { await cleanupBuyer(stranger.id).catch(() => {}); });
    seller = await createSeller({});
    product = await createProduct({
      sellerId: seller.id,
      productType: 'digital',
      isDigital: true,
      digitalFilePath: 'byblos/test-ebook.pdf',
      digitalFileName: 'ebook.pdf',
      price: 500
    });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 500,
      sellerPayoutAmount: 490,
      platformFeeAmount: 10,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'DIGITAL',
      fulfillmentType: 'DIGITAL'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 500, quantity: 1 });
    await createPayment({ orderId: order.id, amount: 500 });

    await runFulfillment(order);

    const finalOrder = await getOrder(order.id);
    assert.equal(finalOrder.status, 'COMPLETED', 'digital orders auto-complete in one pass');
    assert.equal(finalOrder.payment_status, 'completed');

    const { rows: accessRows } = await pool.query('SELECT * FROM digital_access WHERE order_id = $1', [order.id]);
    assert.equal(accessRows.length, 1, 'grantDigitalAccess must create exactly one digital_access row per digital item');
    assert.equal(accessRows[0].buyer_id, buyer.id);
    assert.match(accessRows[0].access_token, /^[0-9a-f]{64}$/, 'access_token must be a 32-byte hex token');

    // Escrow: digital completion releases funds immediately (no seller/buyer
    // handoff step to wait for), same code path as physical/service completion.
    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 490);
    const { rows: payoutRows } = await pool.query('SELECT amount FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows.length, 1);
    assert.equal(Number(payoutRows[0].amount), 490);

    // Download authorization: this is the real gate downloadDigitalProduct
    // uses (findVerifiedDigitalItem) — note it does NOT consult digital_access
    // / access_token at all; ownership is buyer_id + payment_status='completed'
    // + product.is_digital. Proven here rather than assumed.
    const downloadable = await findVerifiedDigitalItem({ orderId: order.id, buyerId: buyer.id, productId: product.id });
    assert.ok(downloadable, 'the paying buyer must be able to resolve the digital item for download');
    assert.equal(downloadable.digital_file_path, 'byblos/test-ebook.pdf');

    const strangerAttempt = await findVerifiedDigitalItem({ orderId: order.id, buyerId: stranger.id, productId: product.id });
    assert.equal(strangerAttempt, undefined, 'a buyer who did not pay for this order must not be able to download it');
  });
});

describe('Physical goods: seller self-dropoff at hub -> buyer collects from hub (integration)', () => {
  test('AWAITING_SELLER_ACTION -> seller dropoff -> READY_FOR_BUYER -> buyer collects -> COMPLETED + escrow release', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({ sellerId: seller.id, productType: 'physical', price: 800 });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 800,
      sellerPayoutAmount: 790,
      platformFeeAmount: 10,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'PHYSICAL',
      fulfillmentType: 'COURIER'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 800, quantity: 1 });
    await createPayment({ orderId: order.id, amount: 800 });

    await runFulfillment(order);
    assert.equal((await getOrder(order.id)).status, 'AWAITING_SELLER_ACTION', 'physical orders wait for seller handoff, never auto-complete');

    const afterSelect = await OrderHubDropoffService.selectHubDropoff(order.id, seller.id);
    assert.equal(afterSelect.status, 'FULFILLING');
    const { rows: requestRows } = await pool.query('SELECT * FROM logistics_requests WHERE order_id = $1', [order.id]);
    assert.equal(requestRows.length, 1);
    assert.equal(requestRows[0].metadata.seller_handoff_method, 'seller_dropoff');

    const afterDrop = await OrderHubDropoffService.markDroppedAtHub(order.id, seller.id);
    assert.equal(afterDrop.status, 'READY_FOR_BUYER', 'no door delivery was configured, so the buyer collects from the hub directly');

    const completed = await OrderService.markAsCollected(order.id, buyer.id);
    assert.equal(completed.status, 'COMPLETED');

    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 790);
    const { rows: payoutRows } = await pool.query('SELECT amount FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows.length, 1);
    assert.equal(Number(payoutRows[0].amount), 790);
  });
});

describe('Physical goods: Mzigo Ego pickup from seller location -> buyer collects from hub (integration)', () => {
  test('seller pays for pickup, rider collects + drops at hub, buyer collects -> COMPLETED (regression: was broken end-to-end)', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({ sellerId: seller.id, productType: 'physical', price: 1200 });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1200,
      sellerPayoutAmount: 1190,
      platformFeeAmount: 10,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'PHYSICAL',
      fulfillmentType: 'COURIER'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 1200, quantity: 1 });
    await createPayment({ orderId: order.id, amount: 1200 });

    await runFulfillment(order);
    assert.equal((await getOrder(order.id)).status, 'AWAITING_SELLER_ACTION');

    // --- This is the fix under test: PaymentService.initiateSellerPickupPayment
    // previously did not exist at all (the /orders/:id/request-pickup route
    // called a method with no implementation anywhere in the codebase — a
    // guaranteed 500 for every seller who tried this). A fake providerClient
    // stands in for the real Paystack STK push (covered separately by
    // paystackWebhook.integration.test.js / the sandbox scripts); everything
    // else here is real production code and a real database.
    let capturedCharge = null;
    const fakeProviderClient = {
      async initiatePayment(chargeData) {
        capturedCharge = chargeData;
        return { success: true, reference: `FAKE-PICKUP-REF-${order.id}`, status: 'pending', message: 'STK push sent' };
      }
    };

    const expectedQuote = LogisticsQuoteService.quoteSellerPickup(NAIROBI_SUBURB_LOCATION);
    const initiateResult = await paymentService.initiateSellerPickupPayment({
      orderId: order.id,
      sellerId: seller.id,
      pickupLocation: NAIROBI_SUBURB_LOCATION,
      mobilePayment: '0712345678'
    }, { providerClient: fakeProviderClient });

    assert.equal(initiateResult.alreadyPending, false);
    assert.equal(initiateResult.amount, expectedQuote.feeAmount);
    assert.ok(capturedCharge, 'the real STK-push call must actually be made');
    assert.equal(capturedCharge.phone, '0712345678');
    assert.equal(capturedCharge.email, seller.email, 'the pickup-fee charge is billed to the seller, not the buyer');

    const { rows: pickupPaymentRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [initiateResult.paymentId]);
    const pickupPayment = pickupPaymentRows[0];
    assert.equal(pickupPayment.status, 'pending');
    assert.equal(pickupPayment.metadata.payment_purpose, 'seller_pickup_fee');
    assert.equal(Number(pickupPayment.amount), expectedQuote.feeAmount);
    assert.equal(pickupPayment.provider_reference, `FAKE-PICKUP-REF-${order.id}`, 'the provider reference from the STK push must be persisted');

    const { rows: pickupLegRowsBefore } = await pool.query(
      "SELECT * FROM logistics_legs WHERE id = $1", [initiateResult.pickupLegId]
    );
    assert.equal(pickupLegRowsBefore[0].status, 'payment_pending');
    assert.equal(pickupLegRowsBefore[0].payer, 'seller');

    // Requesting again while the fee payment is still pending must not create
    // a duplicate leg/payment.
    const duplicateAttempt = await paymentService.initiateSellerPickupPayment({
      orderId: order.id,
      sellerId: seller.id,
      pickupLocation: NAIROBI_SUBURB_LOCATION,
      mobilePayment: '0712345678'
    }, { providerClient: fakeProviderClient });
    assert.equal(duplicateAttempt.alreadyPending, true);
    assert.equal(duplicateAttempt.paymentId, initiateResult.paymentId);
    const { rows: legCountRows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM logistics_legs ll
       JOIN logistics_requests lr ON lr.id = ll.logistics_request_id
       WHERE lr.order_id = $1 AND ll.leg_type = 'pickup'`,
      [order.id]
    );
    assert.equal(legCountRows[0].n, 1, 'no duplicate pickup leg must be created for an already-pending request');

    // Simulate the real webhook completing the pickup-fee payment (the
    // payment.events.js AppEvents.PAYMENT.COMPLETED handler already calls
    // this in production — exercised here directly, the way
    // paymentReceipt/webhook tests exercise CorePaymentService directly).
    await pool.query("UPDATE payments SET status = 'completed' WHERE id = $1", [pickupPayment.id]);
    const { rows: completedPaymentRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [pickupPayment.id]);
    const activation = await LogisticsRequestService.activateSellerPickupAfterPayment({
      payment: completedPaymentRows[0],
      order: await getOrder(order.id)
    });
    assert.equal(activation.activated, true);

    const { rows: pickupLegRowsAfterActivation } = await pool.query('SELECT * FROM logistics_legs WHERE id = $1', [initiateResult.pickupLegId]);
    assert.equal(pickupLegRowsAfterActivation[0].status, 'pending', 'paid pickup leg moves from payment_pending to pending, visible to the Mzigo dashboard');

    // Order must be untouched by the pickup-fee payment completing — it is a
    // secondary payment, not the order's own payment.
    assert.equal((await getOrder(order.id)).status, 'AWAITING_SELLER_ACTION');

    // --- Mzigo Ego rider progresses the pickup leg via the real partner
    // dashboard service, exactly as the partner app would call it.
    const partnerId = await getMzigoPartnerId();
    const partner = { userId: null, name: 'Mzigo Ego' };
    const requestId = initiateResult.requestId;

    await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'pickup', status: 'pickup_assigned' });
    await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'pickup', status: 'picked_up_from_seller' });
    const dropoffResult = await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'pickup', status: 'dropped_at_hub' });

    // --- This is the second half of the fix: without it, nothing ever
    // promotes the order past AWAITING_SELLER_ACTION for a courier-pickup
    // (as opposed to seller-self-dropoff) order with no door delivery, so
    // OrderService.markAsCollected below would throw "Illegal state
    // transition ... AWAITING_SELLER_ACTION -> COMPLETED".
    assert.equal(dropoffResult.orderStatus, 'READY_FOR_BUYER', 'a pickup leg reaching dropped_at_hub with no delivery leg must ready the order for buyer collection');
    assert.equal((await getOrder(order.id)).status, 'READY_FOR_BUYER');

    const completed = await OrderService.markAsCollected(order.id, buyer.id);
    assert.equal(completed.status, 'COMPLETED');

    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 1190);
  });

  test('cannot request pickup for an order that is not yet paid', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({ sellerId: seller.id, productType: 'physical', price: 400 });
    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 400,
      sellerPayoutAmount: 390,
      platformFeeAmount: 10,
      status: 'PENDING',
      paymentStatus: 'pending',
      orderType: 'PHYSICAL',
      fulfillmentType: 'COURIER'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 400, quantity: 1 });

    await assert.rejects(
      () => paymentService.initiateSellerPickupPayment({
        orderId: order.id,
        sellerId: seller.id,
        pickupLocation: NAIROBI_SUBURB_LOCATION,
        mobilePayment: '0712345678'
      }),
      /payment succeeds/i
    );
  });
});

describe('Physical goods: buyer door delivery (integration)', () => {
  test('seller drops at hub -> courier delivers to buyer door -> buyer confirms receipt -> COMPLETED + escrow release', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({ sellerId: seller.id, productType: 'physical', price: 900 });

    const deliveryQuote = LogisticsQuoteService.quoteBuyerDoorDelivery(NAIROBI_SUBURB_LOCATION);
    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 900 + deliveryQuote.feeAmount,
      sellerPayoutAmount: 890,
      platformFeeAmount: 10,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'PHYSICAL',
      fulfillmentType: 'COURIER',
      // pricing.buyer_delivery_fee is what OrderService._hasBuyerDoorDelivery
      // reads to know a delivery leg is still owed; delivery.door_delivery is
      // the separate flag LogisticsRequestService's hasDoorDelivery() checks
      // before activating a delivery leg after payment (both real,
      // independent checks — the checkout payload's client-supplied metadata
      // carries both in production).
      metadata: { pricing: { buyer_delivery_fee: deliveryQuote.feeAmount }, delivery: { door_delivery: true } }
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 900, quantity: 1 });
    const payment = await createPayment({ orderId: order.id, amount: order.total_amount });

    await runFulfillment(order);
    assert.equal((await getOrder(order.id)).status, 'AWAITING_SELLER_ACTION');

    const client = await pool.connect();
    let created;
    try {
      await client.query('BEGIN');
      created = await LogisticsRequestService.createDoorDeliveryPaymentPending(client, {
        order,
        payment,
        quote: deliveryQuote,
        buyer,
        product: { id: product.id, seller_id: seller.id },
        seller: { id: seller.id, full_name: seller.full_name, shop_name: seller.shop_name }
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    assert.equal(created.deliveryLeg.status, 'payment_pending');

    const activation = await LogisticsRequestService.activateDoorDeliveryAfterPayment({ payment, order: await getOrder(order.id) });
    assert.equal(activation.activated, true);

    const afterSelect = await OrderHubDropoffService.selectHubDropoff(order.id, seller.id);
    assert.equal(afterSelect.status, 'FULFILLING');
    const afterDrop = await OrderHubDropoffService.markDroppedAtHub(order.id, seller.id);
    assert.equal(afterDrop.status, 'FULFILLING', 'a door delivery is still owed, so the order must not jump to READY_FOR_BUYER on seller dropoff alone');

    const partnerId = await getMzigoPartnerId();
    const partner = { userId: null, name: 'Mzigo Ego' };
    const requestId = activation.requestId;

    await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'delivery', status: 'courier_assigned' });
    await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'delivery', status: 'out_for_delivery' });
    const deliveredResult = await LogisticsDashboardService.updateLegStatus({ partner, partnerId, requestId, legType: 'delivery', status: 'delivered' });

    assert.equal(deliveredResult.orderStatus, 'READY_FOR_BUYER');
    assert.equal((await getOrder(order.id)).status, 'READY_FOR_BUYER');

    const completed = await OrderService.confirmOrderReceipt(order.id, buyer.id);
    assert.equal(completed.status, 'COMPLETED');

    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 890);
  });
});

describe('Service booking (integration)', () => {
  test('PAID -> AWAITING_SELLER_ACTION -> seller confirms booking -> FULFILLING -> buyer confirms -> COMPLETED + escrow release', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({ sellerId: seller.id, productType: 'service', price: 2000 });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 2000,
      sellerPayoutAmount: 1990,
      platformFeeAmount: 10,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'SERVICE',
      fulfillmentType: 'BUYER_TO_SELLER'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, name: product.name, price: 2000, quantity: 1 });
    await createPayment({ orderId: order.id, amount: 2000 });

    await runFulfillment(order);
    assert.equal((await getOrder(order.id)).status, 'AWAITING_SELLER_ACTION');

    const confirmed = await OrderService.confirmBooking(order.id, seller.id);
    assert.equal(confirmed.status, 'FULFILLING');

    // Wrong seller must not be able to confirm someone else's booking.
    const otherSeller = await createSeller({});
    t.after(async () => { await cleanupSeller(otherSeller.id).catch(() => {}); });
    await assert.rejects(() => OrderService.confirmBooking(order.id, otherSeller.id), /not found|unauthorized/i);

    const completed = await OrderService.confirmOrderReceipt(order.id, buyer.id);
    assert.equal(completed.status, 'COMPLETED');

    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 1990);
    const { rows: payoutRows } = await pool.query('SELECT amount FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows.length, 1);
    assert.equal(Number(payoutRows[0].amount), 1990);
  });
});

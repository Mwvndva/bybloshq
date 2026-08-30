// Product checkout initiation — the focused orchestration layer that restores
// buyer checkout in the current architecture.
//
// Responsibilities (and ONLY these):
//   1. Validate product + seller (server-side; never trust client totals).
//   2. Derive authoritative money fields (checkoutPricing) + creator attribution
//      (reused resolveAttribution) + fulfillment (reused resolveFulfillmentType).
//   3. Create product_orders + payments (+ door-delivery logistics) atomically.
//   4. Charge Paystack AFTER commit; persist provider_reference.
//   5. Idempotency via the DB unique constraint on client_checkout_token.
//
// It never marks an order PAID — the signed webhook (completeVerifiedPayment)
// owns settlement. DB triggers own order-number, status-history, and payout-row
// creation. Reuses existing services; ports no legacy orchestrator.
import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import Payment from './payment.model.js';
import PaystackProviderClient from '../../../infrastructure/providers/PaystackProviderClient.js';
import CreatorService from '../../growth/creators/creator.service.js';
import { resolveFulfillmentType, FulfillmentType } from '../../../shared/utils/fulfillment.js';
import LogisticsQuoteService from '../../logistics/logisticsQuote.service.js';
import LogisticsRequestService from '../../logistics/logisticsRequest.service.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import { deriveOrderFinancials, roundMoney } from './checkoutPricing.js';

const PROVIDER = 'paystack';

function wantsDoorDelivery(metadata = {}) {
  const d = metadata.delivery || {};
  return (
    d.doorDelivery === true ||
    d.door_delivery === true ||
    d.deliveryMode === 'DOOR_DELIVERY' ||
    d.delivery_mode === 'DOOR_DELIVERY'
  );
}

// A 4xx from the provider means the request reached Paystack and was explicitly
// rejected (the charge did NOT initiate) → safe to mark the order failed.
// Network/timeout/5xx (no response) is ambiguous → leave the payment pending for
// the webhook/cron to settle, never falsely fail.
function isExplicitProviderFailure(err) {
  const code = err && err.statusCode;
  return typeof code === 'number' && code >= 400 && code < 500;
}

function extractDeliveryLocation(metadata = {}, location = {}) {
  const d = metadata.delivery || {};
  const loc = d.location || location || {};
  return {
    address: loc.address || loc.fullAddress || loc.full_address || location.address || null,
    lat: loc.lat ?? loc.latitude ?? location.lat ?? null,
    lng: loc.lng ?? loc.longitude ?? location.lng ?? null,
  };
}

// Insert a product_orders row. order_number is intentionally omitted so the
// DB trigger (generate_order_number, WHEN order_number IS NULL) owns generation
// — no application-level order-number generation.
async function insertProductOrder(client, data) {
  const fields = Object.keys(data);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const values = fields.map((f) =>
    data[f] !== null && typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]
  );
  const { rows } = await client.query(
    `INSERT INTO product_orders (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}

// Return an existing checkout attempt (idempotent replay) or null.
async function findExistingByToken(token) {
  const { rows } = await pool.query(
    `SELECT po.id AS order_id, po.order_number,
            p.id AS payment_id, p.provider_reference, p.status AS payment_status
       FROM product_orders po
       LEFT JOIN payments p ON p.metadata->>'order_id' = po.id::text
      WHERE po.client_checkout_token = $1
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT 1`,
    [token]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    success: true,
    idempotent: true,
    orderId: row.order_id,
    orderNumber: row.order_number,
    paymentId: row.payment_id,
    paymentResult: { reference: row.provider_reference, status: row.payment_status },
  };
}

/**
 * Initiate a product purchase.
 * @param {object} normalizedOrder - output of normalizeOrderInput
 * @param {object} [deps] - injectable dependencies (for testing)
 * @param {object} [deps.providerClient] - Paystack client with initiatePayment()
 */
export async function initiateProductPayment(normalizedOrder, deps = {}) {
  const { buyer, service, location = {}, metadata = {}, idempotencyKey } = normalizedOrder;
  if (!idempotencyKey) throw new Error('Checkout idempotency token is required');

  // 1. Resolve & validate product + seller.
  const { rows: prows } = await pool.query(
    `SELECT p.*,
            s.id AS seller_id, s.status AS seller_status, s.shop_name,
            s.full_name AS seller_name, s.email AS seller_email,
            s.whatsapp_number AS seller_whatsapp_number, s.city AS seller_city,
            s.location AS seller_location, s.physical_address AS seller_physical_address,
            s.latitude AS seller_latitude, s.longitude AS seller_longitude
       FROM products p
       JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = $1`,
    [service.id]
  );
  const product = prows[0];
  if (!product) throw new Error('Product not found');
  if (product.seller_status !== 'active') throw new Error('Seller is not accepting orders');
  if (product.status !== 'available') throw new Error('Product not available');

  // 2. Secure server-side pricing.
  const quantity = Math.max(1, Number.parseInt(service.quantity || 1, 10));
  const dbPrice = Number.parseFloat(product.price || 0);
  const subtotal = roundMoney(dbPrice * quantity);

  const productType = String(product.product_type || '').toLowerCase();
  const isDigital = product.is_digital === true || productType === 'digital';
  const isService = productType === 'service';
  const isPhysical = !isDigital && !isService;

  // Delivery (buyer-paid door delivery, physical only).
  const door = wantsDoorDelivery(metadata);
  let deliveryQuote = null;
  let deliveryFee = 0;
  if (door) {
    if (!isPhysical) throw new Error('Door delivery is only available for physical products.');
    deliveryQuote = LogisticsQuoteService.quoteBuyerDoorDelivery(extractDeliveryLocation(metadata, location));
    deliveryFee = roundMoney(deliveryQuote.feeAmount);
  }

  // Creator attribution: rate from the seller/creator agreement; commission on
  // the full subtotal (resolveAttribution is authoritative and reused as-is).
  const creatorCode = metadata.creator_code || metadata.creatorCode || metadata.creator;
  const creatorAttribution = await CreatorService.resolveAttribution({
    code: creatorCode,
    sellerId: Number.parseInt(product.seller_id, 10),
    productSubtotal: subtotal,
  });
  const creatorCommission = creatorAttribution?.commission_amount || 0;

  // Authoritative money fields.
  const fin = deriveOrderFinancials({ subtotal, deliveryFee, creatorCommission });

  // Fulfillment + order type (reused current resolver).
  const fulfillmentType = resolveFulfillmentType(
    {
      latitude: product.seller_latitude,
      longitude: product.seller_longitude,
      location: product.seller_location,
      physical_address: product.seller_physical_address,
    },
    productType,
    metadata
  );
  const orderType = isDigital
    ? OrderType.DIGITAL
    : isService
      ? OrderType.SERVICE
      : OrderType.PHYSICAL;

  // 3. Idempotent replay (fast path).
  const existing = await findExistingByToken(idempotencyKey);
  if (existing) return existing;

  const buyerPhone = buyer.mobilePayment || buyer.phone;

  // 4. Atomic order + payment (+ logistics) creation.
  const client = await pool.connect();
  let order;
  let payment;
  let apiRef;
  try {
    await client.query('BEGIN');

    const orderMetadata = {
      ...metadata,
      product_id: service.id,
      product_type: product.product_type,
      is_digital: product.is_digital,
      pricing: {
        product_subtotal: fin.subtotal,
        buyer_delivery_fee: fin.deliveryFee,
        buyer_service_charge: fin.serviceCharge,
        platform_fee: fin.platformFee,
        seller_payout: fin.sellerPayout,
        buyer_total: fin.buyerTotal,
        creator_commission: fin.creatorCommission,
        seller_payout_excludes_delivery_fee: true,
      },
      ...(creatorAttribution ? { creator_attribution: creatorAttribution } : {}),
    };

    const orderData = {
      // order_number intentionally omitted → generate_order_number trigger fills it.
      buyer_id: buyer.id,
      seller_id: product.seller_id,
      total_amount: fin.buyerTotal,
      platform_fee_amount: fin.platformFee,
      seller_payout_amount: fin.sellerPayout,
      payment_method: PROVIDER,
      buyer_name: buyer.name,
      buyer_email: buyer.email,
      buyer_mobile_payment: buyerPhone,
      buyer_whatsapp_number: buyerPhone,
      notes: metadata.narration || null,
      metadata: orderMetadata,
      status: OrderStatus.PAYMENT_PENDING,
      payment_status: 'pending',
      service_requirements: null,
      fulfillment_type: fulfillmentType,
      delivery_location: door ? extractDeliveryLocation(metadata, location) : null,
      order_type: orderType,
      total_quantity: quantity,
      reservation_expires_at: null,
      location_address: location.address || null,
      location_lat: location.lat ?? null,
      location_lng: location.lng ?? null,
      service_title: product.name,
      notification_sent: false,
      client_checkout_token: idempotencyKey,
    };

    try {
      order = await insertProductOrder(client, orderData);
    } catch (err) {
      // Unique violation on client_checkout_token ⇒ concurrent/duplicate
      // checkout: roll back and return the winning attempt WITHOUT charging.
      if (err.code === '23505') {
        await client.query('ROLLBACK');
        const dup = await findExistingByToken(idempotencyKey);
        if (dup) return dup;
      }
      throw err;
    }

    apiRef = `BYB-${order.id}-${Date.now()}`;
    payment = await Payment.insert(client, {
      invoice_id: String(order.id),
      email: buyer.email,
      mobile_payment: buyerPhone,
      whatsapp_number: buyerPhone,
      amount: fin.buyerTotal,
      status: 'pending',
      payment_method: PROVIDER,
      api_ref: apiRef,
      metadata: {
        order_id: order.id,
        api_ref: apiRef,
        order_number: order.order_number,
        product_id: service.id,
        seller_id: product.seller_id,
        pricing: orderMetadata.pricing,
        ...(creatorAttribution ? { creator_attribution: creatorAttribution } : {}),
      },
    });

    if (door && deliveryQuote) {
      await LogisticsRequestService.createDoorDeliveryPaymentPending(client, {
        order,
        payment,
        quote: deliveryQuote,
        buyer,
        product,
        seller: {
          id: product.seller_id,
          full_name: product.seller_name,
          shop_name: product.shop_name,
          email: product.seller_email,
          whatsapp_number: product.seller_whatsapp_number,
          city: product.seller_city,
          location: product.seller_location,
          physical_address: product.seller_physical_address,
          latitude: product.seller_latitude,
          longitude: product.seller_longitude,
        },
        idempotencyKey,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // 5. Initiate the gateway charge AFTER commit. Never mark PAID here.
  const providerClient = deps.providerClient || new PaystackProviderClient();
  try {
    const result = await providerClient.initiatePayment({
      email: buyer.email,
      amount: fin.buyerTotal,
      invoice_id: String(order.id),
      phone: buyerPhone,
      api_ref: apiRef,
      metadata: { order_id: order.id, api_ref: apiRef },
    });

    if (result?.reference) {
      await pool.query(
        `UPDATE payments SET provider_reference = COALESCE($1, provider_reference), updated_at = NOW() WHERE id = $2`,
        [result.reference, payment.id]
      );
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentId: payment.id,
      paymentResult: result,
    };
  } catch (gwErr) {
    // Explicit provider rejection (4xx): the charge did not initiate → fail the
    // order/payment so the buyer can retry cleanly.
    if (isExplicitProviderFailure(gwErr)) {
      logger.warn('[CHECKOUT] Provider explicitly rejected the charge; marking failed', {
        orderId: order.id,
        paymentId: payment.id,
        statusCode: gwErr.statusCode,
        error: gwErr.message,
      });
      await pool.query(`UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`, [payment.id]);
      await pool.query(
        `UPDATE product_orders SET status = 'FAILED', payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      return {
        success: false,
        failed: true,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment.id,
        paymentResult: { status: 'failed', message: gwErr.message },
      };
    }

    // Ambiguous outcome (network/timeout/5xx): the charge may or may not have
    // reached Paystack. Leave the payment PENDING — the signed webhook (resolving
    // by api_ref) settles it if it succeeded. Never mark paid or falsely failed.
    logger.error('[CHECKOUT] Gateway initiation ambiguous; leaving payment pending', {
      orderId: order.id,
      paymentId: payment.id,
      apiRef,
      error: gwErr.message,
    });
    return {
      success: true,
      pending: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentId: payment.id,
      paymentResult: {
        reference: apiRef,
        status: 'pending',
        message: 'Payment request accepted and pending confirmation.',
      },
    };
  }
}

export default { initiateProductPayment };

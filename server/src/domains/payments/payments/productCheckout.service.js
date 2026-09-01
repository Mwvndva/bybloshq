// Product checkout initiation — the focused orchestration layer that restores
// buyer checkout in the current architecture.
//
// Responsibilities (and ONLY these):
//   1. Validate product(s) + seller (server-side; never trust client totals).
//   2. Derive authoritative money fields (checkoutPricing) + creator attribution
//      (reused resolveAttribution) + fulfillment (reused resolveFulfillmentType).
//   3. Create product_orders + order_items + payments (+ door-delivery logistics)
//      atomically.
//   4. Charge Paystack AFTER commit; persist provider_reference.
//   5. Idempotency via the DB unique constraint on client_checkout_token.
//
// Supports a per-seller "bag": 1–5 line items from ONE seller checked out as a
// single order + single payment + single STK push. Multi-item bags are physical
// + digital only; services and custom/imported products keep their dedicated
// single-item flow (with per-item SLA / booking).
//
// It never marks an order PAID — the signed webhook (completeVerifiedPayment)
// owns settlement. DB triggers own order-number, status-history, and payout-row
// creation. Reuses existing services; ports no legacy orchestrator.
import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import Payment from './payment.model.js';
import PaystackProviderClient from '../../../infrastructure/providers/PaystackProviderClient.js';
import CreatorService from '../../growth/creators/creator.service.js';
import { resolveFulfillmentType } from '../../../shared/utils/fulfillment.js';
import LogisticsQuoteService from '../../logistics/logisticsQuote.service.js';
import LogisticsRequestService from '../../logistics/logisticsRequest.service.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import { deriveOrderFinancials, roundMoney } from './checkoutPricing.js';

const PROVIDER = 'paystack';
const MAX_BAG_ITEMS = 5;

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

// Parse the requested line items (multi-item bag or a single product) WITHOUT
// merging — the raw length is what the 5-product bag limit checks against.
function parseItems(normalizedOrder) {
  const { items, service } = normalizedOrder;
  let list = [];
  if (Array.isArray(items) && items.length > 0) {
    list = items.map((it) => ({
      productId: Number.parseInt(it.productId ?? it.product_id ?? it.id, 10),
      quantity: Math.max(1, Number.parseInt(it.quantity ?? 1, 10) || 1),
    }));
  } else if (service && service.id !== undefined && service.id !== null) {
    list = [{
      productId: Number.parseInt(service.id, 10),
      quantity: Math.max(1, Number.parseInt(service.quantity ?? 1, 10) || 1),
    }];
  }
  return list.filter((l) => Number.isInteger(l.productId) && l.productId > 0);
}

// Merge duplicate products into a single line (summing quantities).
function mergeQuantities(list) {
  const merged = new Map();
  for (const l of list) merged.set(l.productId, (merged.get(l.productId) || 0) + l.quantity);
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

// Columns that are PostgreSQL typed enums — they need explicit casts or PG
// rejects the INSERT with "column X is of type Y but expression is of type
// character varying" even when the string value is valid for the enum.
const ENUM_CASTS = {
  status: '::order_status',
  order_type: '::order_type',
  fulfillment_type: '::fulfillment_type',
};

// Insert a product_orders row. order_number is intentionally omitted so the
// DB trigger (generate_order_number, WHEN order_number IS NULL) owns generation.
async function insertProductOrder(client, data) {
  const fields = Object.keys(data);
  const placeholders = fields.map((f, i) => `$${i + 1}${ENUM_CASTS[f] || ''}`).join(', ');
  const values = fields.map((f) =>
    data[f] !== null && typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]
  );
  const { rows } = await client.query(
    `INSERT INTO product_orders (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}


// Insert one order_items row per line. Writes BOTH column pairs
// (name/price AND product_name/product_price): the order_items table historically
// merged two schemas, live read queries use product_name/product_price, and the
// master schema marks name/price NOT NULL — populating both satisfies every
// reader and constraint.
async function insertOrderItems(client, orderId, lines) {
  for (const line of lines) {
    const p = line.product;
    const itemMeta = {
      productType: p.product_type,
      isDigital: p.is_digital === true || String(p.product_type || '').toLowerCase() === 'digital',
      digitalFileName: p.digital_file_name || null,
      imageUrl: p.image_url || null,
    };
    await client.query(
      `INSERT INTO order_items
         (order_id, product_id, name, product_name, price, product_price, quantity, subtotal, metadata)
       VALUES ($1, $2, $3, $3, $4::numeric, $4::numeric, $5, $6::numeric, $7)`,
      [orderId, p.id, p.name, line.price, line.quantity, line.lineSubtotal, JSON.stringify(itemMeta)]
    );
  }
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
  const pstatus = String(row.payment_status || '').toLowerCase();
  const failed = pstatus === 'failed' || pstatus === 'cancelled';
  return {
    success: !failed,
    failed,
    idempotent: true,
    orderId: row.order_id,
    orderNumber: row.order_number,
    paymentId: row.payment_id,
    paymentResult: { reference: row.provider_reference, status: row.payment_status },
  };
}

/**
 * Initiate a product purchase (single product or a per-seller bag of 1–5 items).
 * @param {object} normalizedOrder - output of normalizeOrderInput (buyer, service|items, location, metadata, idempotencyKey)
 * @param {object} [deps] - injectable dependencies (for testing)
 * @param {object} [deps.providerClient] - Paystack client with initiatePayment()
 */
export async function initiateProductPayment(normalizedOrder, deps = {}) {
  const { buyer, location = {}, metadata = {}, idempotencyKey } = normalizedOrder;
  if (!idempotencyKey) throw new Error('Checkout idempotency token is required');

  const rawItems = parseItems(normalizedOrder);
  if (rawItems.length === 0) throw new Error('No valid items to check out');
  if (rawItems.length > MAX_BAG_ITEMS) throw new Error(`A bag can hold at most ${MAX_BAG_ITEMS} products`);
  const items = mergeQuantities(rawItems);
  const isMulti = items.length > 1;

  // 1. Load & validate all products (must share ONE active seller).
  const productIds = items.map((i) => i.productId);
  const { rows: prows } = await pool.query(
    `SELECT p.*,
            s.id AS seller_id, s.status AS seller_status, s.shop_name,
            s.full_name AS seller_name, s.email AS seller_email,
            s.whatsapp_number AS seller_whatsapp_number, s.city AS seller_city,
            s.location AS seller_location, s.physical_address AS seller_physical_address,
            s.latitude AS seller_latitude, s.longitude AS seller_longitude
       FROM products p
       JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ANY($1::int[])`,
    [productIds]
  );
  const productById = new Map(prows.map((r) => [Number(r.id), r]));
  for (const id of productIds) {
    if (!productById.has(id)) throw new Error('Product not found');
  }
  if (new Set(prows.map((r) => Number(r.seller_id))).size > 1) {
    throw new Error('All items in a bag must be from the same seller.');
  }
  const anyProduct = prows[0];
  if (anyProduct.seller_status !== 'active') throw new Error('Seller is not accepting orders');
  for (const r of prows) {
    if (r.status !== 'available') throw new Error('Product not available');
  }

  // 2. Build line items + secure per-line pricing.
  const lines = items.map((i) => {
    const p = productById.get(i.productId);
    const qty = Math.max(1, Number.parseInt(i.quantity, 10) || 1);
    const dbPrice = Number.parseFloat(p.price || 0);
    if (!Number.isFinite(dbPrice) || dbPrice <= 0) {
      throw new Error('Invalid order amount after secure calculation');
    }
    const lineSubtotal = roundMoney(dbPrice * qty);
    if (!(lineSubtotal > 0)) throw new Error('Invalid order amount after secure calculation');
    const productType = String(p.product_type || '').toLowerCase();
    const isDigital = p.is_digital === true || productType === 'digital';
    const isService = productType === 'service';
    const isPhysical = !isDigital && !isService;
    return {
      product: p,
      quantity: qty,
      price: roundMoney(dbPrice),
      lineSubtotal,
      productType,
      isDigital,
      isService,
      isPhysical,
      isCustom: isPhysical && p.is_custom_product === true,
      isImported: isPhysical && p.is_imported_product === true,
    };
  });

  // Multi-item bags are physical + digital only (v1).
  if (isMulti) {
    for (const l of lines) {
      if (l.isService) throw new Error('Services must be booked on their own, not in a bag.');
      if (l.isCustom || l.isImported) throw new Error('Custom and imported products must be bought on their own, not in a bag.');
    }
  }

  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const allDigital = lines.every((l) => l.isDigital);
  const anyPhysical = lines.some((l) => l.isPhysical);
  const singleLine = isMulti ? null : lines[0];

  // Custom / imported SLA — single-item only; derived from the AUTHORITATIVE row.
  const customInstructions = String(
    metadata.customization_instructions || metadata.custom_instructions || metadata.buyer_instructions || ''
  ).trim();
  let preHandoffSla = null;
  if (singleLine && singleLine.isCustom && singleLine.isImported) {
    throw new Error('Product cannot be both custom and imported.');
  }
  if (singleLine && singleLine.isCustom) {
    const productionDays = Number.parseInt(singleLine.product.production_days, 10);
    if (!Number.isInteger(productionDays) || productionDays < 1 || productionDays > 5) {
      throw new Error('Custom product is misconfigured. Please contact the seller.');
    }
    if (!customInstructions) {
      throw new Error('Customization instructions are required for this custom product.');
    }
    preHandoffSla = {
      type: 'custom_production',
      production_days: productionDays,
      customization_prompt: singleLine.product.customization_prompt || 'Describe your customization',
      buyer_instructions: customInstructions,
      delivery_starts_after_seller_handoff: true,
      source_product_id: singleLine.product.id,
    };
  } else if (singleLine && singleLine.isImported) {
    const importDays = Number.parseInt(singleLine.product.import_days, 10);
    if (![7, 14, 21, 30].includes(importDays)) {
      throw new Error('Imported product is misconfigured. Please contact the seller.');
    }
    preHandoffSla = {
      type: 'import_waiting',
      import_days: importDays,
      note: singleLine.product.import_note || 'Imported item. Delivery starts after seller handoff.',
      delivery_starts_after_seller_handoff: true,
      source_product_id: singleLine.product.id,
    };
  }

  // Delivery (buyer-paid door delivery; requires at least one physical item).
  const door = wantsDoorDelivery(metadata);
  let deliveryQuote = null;
  let deliveryFee = 0;
  if (door) {
    if (!anyPhysical) throw new Error('Door delivery is only available for physical products.');
    const buyerLoc = extractDeliveryLocation(metadata, location);
    const lat = Number(buyerLoc.lat);
    const lng = Number(buyerLoc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -5 || lat > 5 || lng < 33 || lng > 42) {
      throw new Error('Door delivery coordinates are required.');
    }
    deliveryQuote = LogisticsQuoteService.quoteBuyerDoorDelivery(buyerLoc);
    const minFee = roundMoney(Number(deliveryQuote.rateKesPerKm) || 0);
    deliveryFee = Math.max(roundMoney(deliveryQuote.feeAmount), minFee);
  }

  // Creator attribution on the aggregated subtotal (one code per checkout).
  const creatorCode = metadata.creator_code || metadata.creatorCode || metadata.creator;
  const creatorAttribution = await CreatorService.resolveAttribution({
    code: creatorCode,
    sellerId: Number.parseInt(anyProduct.seller_id, 10),
    productSubtotal: subtotal,
  });
  const creatorCommission = creatorAttribution?.commission_amount || 0;

  // Authoritative money fields.
  const fin = deriveOrderFinancials({ subtotal, deliveryFee, creatorCommission });

  // Fulfillment + order type from the aggregate.
  const effectiveType = allDigital ? 'digital' : (singleLine && singleLine.isService ? 'service' : 'physical');
  const fulfillmentType = resolveFulfillmentType(
    {
      latitude: anyProduct.seller_latitude,
      longitude: anyProduct.seller_longitude,
      location: anyProduct.seller_location,
      physical_address: anyProduct.seller_physical_address,
    },
    effectiveType,
    metadata
  );
  const orderType = allDigital
    ? OrderType.DIGITAL
    : (singleLine && singleLine.isService ? OrderType.SERVICE : OrderType.PHYSICAL);

  // 3. Idempotent replay (fast path).
  const existing = await findExistingByToken(idempotencyKey);
  if (existing) return existing;

  const buyerPhone = buyer.mobilePayment || buyer.phone;
  const headProduct = (lines.find((l) => l.isPhysical) || lines[0]).product;
  const serviceTitle = singleLine ? singleLine.product.name : `${lines.length} items`;

  // 4. Atomic order + items + payment (+ logistics) creation.
  const client = await pool.connect();
  let order;
  let payment;
  let apiRef;
  try {
    await client.query('BEGIN');

    // Per-line inventory reservation for stock-tracked products.
    for (const l of lines) {
      if (l.product.track_inventory === true) {
        const reserved = await client.query(
          `UPDATE products
              SET reserved_quantity = COALESCE(reserved_quantity, 0) + $2, updated_at = NOW()
            WHERE id = $1
              AND (COALESCE(quantity, 0) - COALESCE(reserved_quantity, 0)) >= $2
            RETURNING id`,
          [l.product.id, l.quantity]
        );
        if (reserved.rows.length === 0) throw new Error('Insufficient stock available');
      }
    }

    const orderMetadata = {
      ...metadata,
      product_id: headProduct.id,
      product_type: singleLine ? singleLine.product.product_type : (allDigital ? 'digital' : 'physical'),
      is_digital: singleLine ? singleLine.product.is_digital : allDigital,
      pre_handoff_sla: preHandoffSla,
      custom_product: singleLine && singleLine.isCustom
        ? {
            is_custom_product: true,
            production_days: preHandoffSla.production_days,
            customization_prompt: preHandoffSla.customization_prompt,
            buyer_instructions: preHandoffSla.buyer_instructions,
            delivery_starts_after_seller_handoff: true,
            source_product_id: singleLine.product.id,
          }
        : null,
      items: lines.map((l) => ({
        product_id: l.product.id,
        name: l.product.name,
        quantity: l.quantity,
        price: l.price,
        subtotal: l.lineSubtotal,
        product_type: l.product.product_type,
      })),
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
      seller_id: anyProduct.seller_id,
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
      pre_handoff_sla: preHandoffSla,
      fulfillment_type: fulfillmentType,
      delivery_location: door ? extractDeliveryLocation(metadata, location) : null,
      order_type: orderType,
      total_quantity: totalQuantity,
      reservation_expires_at: null,
      location_address: location.address || null,
      location_lat: location.lat ?? null,
      location_lng: location.lng ?? null,
      service_title: serviceTitle,
      notification_sent: false,
      client_checkout_token: idempotencyKey,
    };

    try {
      order = await insertProductOrder(client, orderData);
    } catch (err) {
      if (err.code === '23505') {
        await client.query('ROLLBACK');
        const dup = await findExistingByToken(idempotencyKey);
        if (dup) return dup;
      }
      throw err;
    }

    await insertOrderItems(client, order.id, lines);

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
        product_id: headProduct.id,
        seller_id: anyProduct.seller_id,
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
        product: headProduct,
        seller: {
          id: anyProduct.seller_id,
          full_name: anyProduct.seller_name,
          shop_name: anyProduct.shop_name,
          email: anyProduct.seller_email,
          whatsapp_number: anyProduct.seller_whatsapp_number,
          city: anyProduct.seller_city,
          location: anyProduct.seller_location,
          physical_address: anyProduct.seller_physical_address,
          latitude: anyProduct.seller_latitude,
          longitude: anyProduct.seller_longitude,
        },
        idempotencyKey,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch((rbErr) => logger.error('[CHECKOUT] Rollback failed', { error: rbErr.message }));
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
      // Release the reserved stock for every line so a declined charge doesn't hold inventory.
      for (const l of lines) {
        if (l.product.track_inventory === true) {
          await pool.query(
            `UPDATE products SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - $2, 0), updated_at = NOW() WHERE id = $1`,
            [l.product.id, l.quantity]
          ).catch((e) => logger.error('[CHECKOUT] Failed to release reserved stock', { productId: l.product.id, error: e.message }));
        }
      }
      return {
        success: false,
        failed: true,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment.id,
        paymentResult: { status: 'failed', message: gwErr.message },
      };
    }

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

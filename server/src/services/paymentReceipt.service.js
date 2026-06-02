import OrderReadService from './orderRead.service.js';
import logger from '../shared/utils/logger.js';
import {
  sendPaymentReceiptEmail,
  sendProductOrderConfirmationEmail
} from '../shared/utils/email.js';

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isLogisticsFeePayment(payment = {}) {
  const metadata = parseJson(payment.metadata);
  return metadata.payment_purpose === 'seller_pickup_fee'
    || metadata.logistics_payment_type === 'seller_pickup_fee';
}

function getBuyerDeliveryFee(payment = {}) {
  const metadata = parseJson(payment.metadata);
  const deliveryFee = metadata.buyer_delivery_fee
    ?? metadata.delivery?.quote?.fee_amount
    ?? metadata.delivery?.quote?.feeAmount
    ?? metadata.pricing?.buyer_delivery_fee
    ?? 0;

  const normalizedFee = Number(deliveryFee);
  return Number.isFinite(normalizedFee) && normalizedFee > 0 ? normalizedFee : 0;
}

function getBuyerServiceCharge(payment = {}) {
  const metadata = parseJson(payment.metadata);
  const serviceCharge = metadata.buyer_service_charge
    ?? metadata.product_service_charge
    ?? metadata.pricing?.buyer_service_charge
    ?? metadata.pricing?.product_service_charge
    ?? 0;

  const normalizedCharge = Number(serviceCharge);
  return Number.isFinite(normalizedCharge) && normalizedCharge > 0 ? normalizedCharge : 0;
}

function buildReceiptId(payment = {}) {
  const metadata = parseJson(payment.metadata);
  return metadata.receipt_id || `BYB-RCPT-${String(payment.id).padStart(8, '0')}`;
}

function normalizeEmailItems(items = [], payment = {}) {
  const normalizedItems = items.map(item => ({
    ...item,
    name: item.name || item.product_name || item.title || `Product ${item.product_id || item.productId || ''}`.trim(),
    price: item.price ?? item.product_price ?? item.unit_price ?? 0,
    quantity: item.quantity ?? 1,
    subtotal: item.subtotal ?? ((Number(item.product_price || item.price || 0)) * Number(item.quantity || 1)),
    product_type: item.product_type || item.metadata?.productType || null,
    is_digital: item.is_digital ?? item.metadata?.isDigital ?? false
  }));

  const buyerDeliveryFee = getBuyerDeliveryFee(payment);
  if (buyerDeliveryFee > 0) {
    normalizedItems.push({
      name: 'Door delivery fee',
      price: buyerDeliveryFee,
      quantity: 1,
      subtotal: buyerDeliveryFee,
      product_type: 'delivery_fee',
      is_digital: false,
      metadata: {
        line_item_type: 'buyer_delivery_fee'
      }
    });
  }

  const buyerServiceCharge = getBuyerServiceCharge(payment);
  if (buyerServiceCharge > 0) {
    normalizedItems.push({
      name: 'Byblos service charge (2%)',
      price: buyerServiceCharge,
      quantity: 1,
      subtotal: buyerServiceCharge,
      product_type: 'service_charge',
      is_digital: false,
      metadata: {
        line_item_type: 'buyer_service_charge'
      }
    });
  }

  return normalizedItems;
}

function buildSellerPickupItems(payment = {}) {
  const metadata = parseJson(payment.metadata);
  const pickup = metadata.pickup || {};
  const quote = pickup.quote || {};
  const feeAmount = Number(payment.amount || quote.fee_amount || quote.feeAmount || 0);

  return [{
    name: 'Seller pickup fee',
    price: Number.isFinite(feeAmount) ? feeAmount : 0,
    quantity: 1,
    subtotal: Number.isFinite(feeAmount) ? feeAmount : 0,
    product_type: 'pickup_fee',
    is_digital: false,
    metadata: {
      line_item_type: 'seller_pickup_fee',
      pickup_address: pickup.address || quote.origin?.address || null
    }
  }];
}

function buildEmailPayload({ payment, order, fullOrder, items }) {
  const orderMetadata = parseJson(fullOrder.metadata);
  const paymentMetadata = parseJson(payment.metadata);
  const paidAt = paymentMetadata.completed_at || payment.updated_at || fullOrder.updated_at || new Date().toISOString();
  const receiptId = buildReceiptId(payment);
  const transactionId = payment.mpesa_receipt
    || payment.provider_reference
    || payment.api_ref
    || fullOrder.payment_reference
    || receiptId;

  return {
    ...fullOrder,
    buyer_name: fullOrder.buyer_name_actual || fullOrder.buyer_name || order?.buyer_name || 'Customer',
    buyer_email: fullOrder.buyer_email_actual || fullOrder.buyer_email || payment.email || order?.buyer_email,
    order_number: fullOrder.order_number || order?.order_number,
    total_amount: payment.amount || fullOrder.total_amount || order?.total_amount,
    payment_method: payment.payment_method || fullOrder.payment_method || order?.payment_method,
    payment_reference: transactionId,
    transaction_id: transactionId,
    provider_reference: payment.provider_reference || null,
    receipt_id: receiptId,
    paid_at: paidAt,
    created_at: fullOrder.created_at || order?.created_at || paidAt,
    metadata: orderMetadata,
    payment_metadata: paymentMetadata,
    pre_handoff_sla: orderMetadata.pre_handoff_sla || null,
    custom_product: orderMetadata.custom_product || null,
    custom_production_deadline_at: fullOrder.custom_production_deadline_at || orderMetadata.pre_handoff_sla?.ready_deadline_at || orderMetadata.custom_product?.production_deadline_at || null,
    custom_production_grace_deadline_at: fullOrder.custom_production_grace_deadline_at || orderMetadata.pre_handoff_sla?.ready_grace_deadline_at || orderMetadata.custom_product?.production_grace_deadline_at || null,
    items
  };
}

class PaymentReceiptService {
  static async buildBuyerPaymentEmailPayload({ payment, order }) {
    if (!payment?.id || !order?.id || isLogisticsFeePayment(payment)) {
      return null;
    }

    const details = await OrderReadService.getStatusNotificationDetails(order.id);
    const fullOrder = details?.fullOrder || order;
    const items = normalizeEmailItems(details?.items || [], payment);
    const payload = buildEmailPayload({ payment, order, fullOrder, items });

    if (!payload.buyer_email) {
      logger.warn('[PaymentReceiptService] Skipping paid order emails because buyer email is missing', {
        paymentId: payment.id,
        orderId: order.id
      });
      return null;
    }

    return payload;
  }

  static async sendBuyerEmailsAfterPayment({ eventBus, eventId, payment, order }) {
    const payload = await this.buildBuyerPaymentEmailPayload({ payment, order });
    if (!payload) return { skipped: true };

    const buyerEmail = payload.buyer_email;
    const sellerEmail = payload.seller_email || order?.seller_email || null;

    await eventBus.deliverRecipient(
      eventId,
      `payment:${payment.id}:buyer:order_confirmation`,
      () => sendProductOrderConfirmationEmail(buyerEmail, payload),
      { channel: 'email' }
    );

    await eventBus.deliverRecipient(
      eventId,
      `payment:${payment.id}:buyer:payment_receipt`,
      () => sendPaymentReceiptEmail(buyerEmail, payload),
      { channel: 'email' }
    );

    if (sellerEmail) {
      await eventBus.deliverRecipient(
        eventId,
        `payment:${payment.id}:seller:payment_receipt_copy`,
        () => sendPaymentReceiptEmail(
          sellerEmail,
          {
            ...payload,
            buyer_name: payload.seller_name || order?.seller_name || 'Seller',
            buyer_email: sellerEmail,
            receipt_title: 'Seller Payment Receipt Copy',
            billing_label: 'Seller',
            confirmation_note: 'Buyer payment confirmed. This receipt copy is for your seller records.'
          },
          true
        ),
        { channel: 'email' }
      );
    } else {
      logger.warn('[PaymentReceiptService] Skipping seller payment receipt copy because seller email is missing', {
        paymentId: payment.id,
        orderId: order.id
      });
    }

    return {
      delivered: true,
      receiptId: payload.receipt_id,
      sellerReceiptDelivered: Boolean(sellerEmail)
    };
  }

  static async buildSellerPickupReceiptPayload({ payment, order }) {
    if (!payment?.id || !order?.id || !isLogisticsFeePayment(payment)) {
      return null;
    }

    const details = await OrderReadService.getStatusNotificationDetails(order.id);
    const fullOrder = details?.fullOrder || order;
    const items = buildSellerPickupItems(payment);
    const payload = buildEmailPayload({ payment, order, fullOrder, items });
    const metadata = parseJson(payment.metadata);
    const pickup = metadata.pickup || {};
    const sellerEmail = fullOrder.seller_email || payment.email || order.seller_email;
    const sellerName = fullOrder.seller_name || order.seller_name || 'Seller';

    if (!sellerEmail) {
      logger.warn('[PaymentReceiptService] Skipping pickup receipt because seller email is missing', {
        paymentId: payment.id,
        orderId: order.id
      });
      return null;
    }

    return {
      ...payload,
      buyer_name: sellerName,
      buyer_email: sellerEmail,
      total_amount: payment.amount,
      receipt_type: 'seller_pickup_fee',
      receipt_title: 'Pickup Fee Receipt',
      billing_label: 'Paid By',
      confirmation_note: 'Pickup fee confirmed. Mzigo Ego can now process pickup for this package.',
      pickup_address: pickup.address || null
    };
  }

  static async sendSellerPickupReceiptAfterPayment({ eventBus, eventId, payment, order }) {
    const payload = await this.buildSellerPickupReceiptPayload({ payment, order });
    if (!payload) return { skipped: true };

    await eventBus.deliverRecipient(
      eventId,
      `payment:${payment.id}:seller:pickup_receipt`,
      () => sendPaymentReceiptEmail(payload.buyer_email, payload, true),
      { channel: 'email' }
    );

    return {
      delivered: true,
      receiptId: payload.receipt_id
    };
  }
}

export default PaymentReceiptService;

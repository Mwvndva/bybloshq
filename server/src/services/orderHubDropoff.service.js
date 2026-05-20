/**
 * OrderHubDropoffService — Seller hub-dropoff flow.
 *
 * Two public operations:
 *   - selectHubDropoff: seller chooses hub-dropoff as the handoff
 *     method. Creates / promotes a logistics_request and stamps the
 *     order with the dropoff_selected handoff status.
 *   - markDroppedAtHub: seller confirms the package has been dropped
 *     at the hub. Advances the order toward READY_FOR_BUYER or
 *     FULFILLING depending on whether door delivery is configured.
 *
 * Extracted from order.service.js. Order-level predicates
 * (_isPaidOrder, _isPhysicalOnlineOrder, _hasActivePickup,
 * _hasBuyerDoorDelivery, _parseMetadata) and the post-commit
 * _emitOrderUpdate notifier remain on OrderService and are re-used
 * via static calls — they're shared with other order flows.
 */
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import { OrderStatus } from '../shared/constants/enums.js';
import eventBus from '../events/eventBus.js';
import OrderService from './order.service.js';
import LogisticsRequestService from './logisticsRequest.service.js';
import * as orderHubDropoffRepository from '../repositories/orderHubDropoff.repository.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function ensureSellerDropoffRequest(client, order, deadlineAt, status = 'active') {
  const partner = await LogisticsRequestService.getMzigoEgoPartner(client);
  return orderHubDropoffRepository.upsertLogisticsRequest({
    orderId: order.id,
    partnerId: partner.id,
    packageCode: `BYB-LOG-${order.id}`,
    status,
    deadlineAt,
    metadata: {
      source: 'seller_hub_dropoff',
      seller_handoff_method: 'seller_dropoff',
      seller_handoff_status: status === 'completed' ? 'dropped_at_hub' : 'dropoff_selected',
      hub_dropoff_deadline_at: deadlineAt.toISOString()
    }
  }, client);
}

class OrderHubDropoffService {
  /**
   * Seller selects hub-dropoff handoff for an order. Creates / promotes
   * the underlying logistics_request, stamps the order with
   * dropoff_selected handoff metadata, and enqueues the new-order
   * notification for the logistics partner.
   */
  static async selectHubDropoff(orderId, sellerId) {
    const client = await pool.connect();
    let oldStatus = null;
    const newStatus = OrderStatus.FULFILLING;
    let newOrderNotificationEvent = null;

    try {
      await client.query('BEGIN');

      const order = await orderHubDropoffRepository.findOrderWithLegsForUpdate(
        { orderId, sellerId },
        client
      );

      if (!order) {
        throw new Error('Order not found or unauthorized');
      }
      if (!OrderService._isPaidOrder(order)) {
        throw new Error('Seller handoff can only be selected after buyer payment succeeds');
      }
      if (!OrderService._isPhysicalOnlineOrder(order)) {
        throw new Error('Hub drop-off is only available for paid physical orders from online shops');
      }
      if (OrderService._hasActivePickup(order)) {
        throw new Error('Hub drop-off cannot be selected while Mzigo pickup is active or payment is pending');
      }

      oldStatus = order.status;
      const metadata = OrderService._parseMetadata(order.metadata);
      const existingHandoff = metadata.seller_handoff || {};
      const deadlineAt = existingHandoff.deadline_at
        ? new Date(existingHandoff.deadline_at)
        : new Date(Date.now() + TWENTY_FOUR_HOURS_MS);
      const request = await ensureSellerDropoffRequest(client, order, deadlineAt, 'active');

      const handoff = {
        method: 'seller_dropoff',
        status: 'dropoff_selected',
        deadline_at: deadlineAt.toISOString(),
        selected_at: existingHandoff.selected_at || new Date().toISOString(),
        logistics_request_id: request.id
      };

      const updatedOrder = await orderHubDropoffRepository.updateOrderStatusAndHandoff({
        orderId: order.id,
        status: newStatus,
        handoff
      }, client);

      await orderHubDropoffRepository.insertTrackingEvent({
        requestId: request.id,
        eventKey: `logistics.seller_dropoff.selected:${order.id}`,
        eventType: 'seller_handoff.dropoff_selected',
        status: 'dropoff_selected',
        message: 'Seller selected hub drop-off. Package must be dropped at the hub within 24 hours.',
        actorUserId: null,
        metadata: { order_id: order.id, seller_id: sellerId, deadline_at: deadlineAt.toISOString() }
      }, client);

      newOrderNotificationEvent = await LogisticsRequestService.enqueueNewOrderNotification(client, {
        requestId: request.id,
        orderId: order.id,
        source: 'seller_hub_dropoff'
      });

      await client.query('COMMIT');
      eventBus.dispatchAfterCommit(newOrderNotificationEvent?.eventId, 'HubDropoffNewOrderNotification');
      await OrderService._emitOrderUpdate(
        order.id,
        oldStatus,
        newStatus,
        'Seller selected hub drop-off. Hub deadline is 24 hours.',
        'OrderHubDropoffService.selectHubDropoff'
      );
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => { });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seller confirms the package has physically been dropped at the hub.
   * Advances the order to READY_FOR_BUYER (or FULFILLING when a door
   * delivery is in play) and stamps the logistics request as active.
   */
  static async markDroppedAtHub(orderId, sellerId) {
    const client = await pool.connect();
    let oldStatus = null;

    try {
      await client.query('BEGIN');

      const order = await orderHubDropoffRepository.findOrderWithLegsForUpdate(
        { orderId, sellerId },
        client
      );

      if (!order) {
        throw new Error('Order not found or unauthorized');
      }
      if (!OrderService._isPaidOrder(order)) {
        throw new Error('Package can only be marked dropped at hub after buyer payment succeeds');
      }
      if (!OrderService._isPhysicalOnlineOrder(order)) {
        throw new Error('Hub drop-off is only available for paid physical orders from online shops');
      }
      if (OrderService._hasActivePickup(order)) {
        throw new Error('Package cannot be marked as seller dropped off while Mzigo pickup is active');
      }

      oldStatus = order.status;
      const metadata = OrderService._parseMetadata(order.metadata);
      const existingHandoff = metadata.seller_handoff || {};
      const deadlineAt = existingHandoff.deadline_at
        ? new Date(existingHandoff.deadline_at)
        : new Date(Date.now() + TWENTY_FOUR_HOURS_MS);
      const request = order.logistics_request_id
        ? { id: order.logistics_request_id }
        : await ensureSellerDropoffRequest(client, order, deadlineAt, 'active');

      const hasDoorDelivery = OrderService._hasBuyerDoorDelivery(order) || !!order.delivery_leg_id;
      const newStatus = hasDoorDelivery ? OrderStatus.FULFILLING : OrderStatus.READY_FOR_BUYER;
      const droppedAtHubAt = new Date().toISOString();
      const handoff = {
        method: 'seller_dropoff',
        status: 'dropped_at_hub',
        deadline_at: deadlineAt.toISOString(),
        selected_at: existingHandoff.selected_at || droppedAtHubAt,
        dropped_at_hub_at: droppedAtHubAt,
        logistics_request_id: request.id
      };

      const updatedOrder = await orderHubDropoffRepository.updateOrderStatusAndHandoff({
        orderId: order.id,
        status: newStatus,
        handoff
      }, client);

      await orderHubDropoffRepository.markLogisticsRequestActiveOnDrop({
        requestId: request.id,
        metadataPatch: {
          seller_handoff_method: 'seller_dropoff',
          seller_handoff_status: 'dropped_at_hub',
          seller_dropped_at_hub_at: droppedAtHubAt
        }
      }, client);

      await orderHubDropoffRepository.insertTrackingEvent({
        requestId: request.id,
        eventKey: `logistics.seller_dropoff.dropped_at_hub:${order.id}`,
        eventType: 'seller_handoff.dropped_at_hub',
        status: 'dropped_at_hub',
        message: hasDoorDelivery
          ? 'Seller dropped the package at the hub. Door delivery can proceed.'
          : 'Seller dropped the package at the hub. Buyer can collect from the hub.',
        actorUserId: null,
        metadata: { order_id: order.id, seller_id: sellerId, has_door_delivery: hasDoorDelivery }
      }, client);

      await client.query('COMMIT');
      await OrderService._emitOrderUpdate(
        order.id,
        oldStatus,
        newStatus,
        hasDoorDelivery ? 'Package dropped at hub. Door delivery will proceed.' : 'Package dropped at hub. Buyer can collect from the hub.',
        'OrderHubDropoffService.markDroppedAtHub'
      );
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => { });
      logger.error('[HubDropoff] markDroppedAtHub error:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default OrderHubDropoffService;

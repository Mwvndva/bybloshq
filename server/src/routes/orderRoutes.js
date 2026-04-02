import express from 'express';
import {
  createOrder,
  getUserOrders,
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
  confirmReceipt,
  cancelOrder,
  sellerCancelOrder,
  downloadDigitalProduct,
  createSellerClientOrder,
  locationPreview,
  getByReference
} from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, updateOrderStatusSchema } from '../validations/order.validation.js';

const router = express.Router();

// Apply protection to all order routes
router.use(protect);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order
 */
router.post(
  '/',
  validate(createOrderSchema),
  createOrder
);

/**
 * @swagger
 * /api/orders/user:
 *   get:
 *     summary: Get orders for the authenticated user
 */
router.get('/user', getUserOrders);

/**
 * @swagger
 * /api/orders/reference/{reference}:
 *   get:
 *     summary: Get order by order number or payment reference
 */
router.get('/reference/:reference', getByReference);

/**
 * @swagger
 * /api/orders/seller:
 *   get:
 *     summary: Get all orders for the authenticated seller
 */
router.get('/seller', getSellerOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 */
router.get('/:id', getOrderById);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order status
 */
router.patch(
  '/:id/status',
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

/**
 * @swagger
 * /api/orders/{id}/confirm-receipt:
 *   patch:
 *     summary: Confirm order receipt (buyer)
 */
router.patch(
  '/:id/confirm-receipt',
  confirmReceipt
);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel order (buyer)
 */
router.patch(
  '/:id/cancel',
  cancelOrder
);

/**
 * @swagger
 * /api/orders/{id}/seller-cancel:
 *   patch:
 *     summary: Cancel order (seller)
 */
router.patch(
  '/:id/seller-cancel',
  sellerCancelOrder
);

/**
 * @swagger
 * /api/orders/{orderId}/download/{productId}:
 *   get:
 *     summary: Download digital product
 */
router.get(
  '/:orderId/download/:productId',
  downloadDigitalProduct
);

/**
 * @swagger
 * /api/orders/client-order:
 *   post:
 *     summary: Create a client order (seller-initiated)
 */
router.post(
  '/client-order',
  createSellerClientOrder
);

router.post(
  '/location-preview',
  locationPreview
);

export default router;

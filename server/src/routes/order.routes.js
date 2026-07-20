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
  locationPreview,
  getByReference,
  getOrderLiveLocation
} from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateOrderStatusSchema } from '../validations/order.validation.js';

const router = express.Router();

/**
 * @swagger
 * /api/orders/reference/{reference}:
 *   get:
 *     summary: Get order by order number or payment reference (Public)
 */
router.get('/reference/:reference', getByReference);

// Apply protection to all other order routes
router.use(protect);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Retired direct order creation endpoint
 */
router.post(
  '/',
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
 * /api/orders/{id}/live-location:
 *   get:
 *     summary: Phase-scoped live courier location for the order's buyer or seller
 */
router.get('/:id/live-location', getOrderLiveLocation);

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

router.post(
  '/location-preview',
  locationPreview
);

export default router;

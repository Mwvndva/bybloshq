import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Debug middleware to log all requests to order routes
router.use((req, res, next) => {
  console.log(`[Order Routes] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Get all orders for a buyer
router.get('/buyers/:buyerId/orders', 
  (req, res, next) => {
    console.log('Hit /buyers/:buyerId/orders route');
    next();
  },
  protect,
  orderController.getBuyerOrders
);

// Get order details by ID
router.get('/orders/:orderId', 
  (req, res, next) => {
    console.log('Hit /orders/:orderId route');
    next();
  },
  protect,
  orderController.getOrderDetails
);

// Create a new order
router.post('/buyers/:buyerId/orders', 
  (req, res, next) => {
    console.log('Hit POST /buyers/:buyerId/orders route');
    next();
  },
  protect,
  orderController.createOrder
);

// Update order status
router.patch('/orders/:orderId/status', 
  (req, res, next) => {
    console.log('Hit PATCH /orders/:orderId/status route');
    next();
  },
  protect,
  orderController.updateOrderStatus
);

// Confirm order (buyer confirms receipt)
router.post('/:orderId/confirm', 
  (req, res, next) => {
    console.log('Hit POST /:orderId/confirm route');
    next();
  },
  protect,
  orderController.confirmOrder
);

// Check order status by reference (public endpoint)
router.get('/reference/:reference', 
  (req, res, next) => {
    console.log('Hit GET /reference/:reference route');
    next();
  },
  orderController.getOrderStatusByReference
);

export default router;

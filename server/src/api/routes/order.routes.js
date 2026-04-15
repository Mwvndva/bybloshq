import express from 'express';
import { orderController } from '../controllers/OrderController.js';
import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createOrderSchema, updateOrderStatusSchema } from '../../validations/order.validation.js';

const router = express.Router();

router.get('/reference/:reference', (req, res) => orderController.getByReference(req, res));

router.use(protect);

router.post('/', validate(createOrderSchema), (req, res) => orderController.createOrder(req, res));
router.get('/user', (req, res) => orderController.getUserOrders(req, res));
router.get('/seller', (req, res) => orderController.getSellerOrders(req, res));
router.get('/:id', (req, res) => orderController.getOrderById(req, res));
router.patch('/:id/status', validate(updateOrderStatusSchema), (req, res) => orderController.updateOrderStatus(req, res));

// ... other routes

export default router;

import express from 'express';
import authRoutes from './auth.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import withdrawalRoutes from './withdrawal.routes.js';
import sellerRoutes from './seller.routes.js';
import productRoutes from './product.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/sellers', sellerRoutes);
router.use('/products', productRoutes);

export default router;

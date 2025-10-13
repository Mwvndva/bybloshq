import { Router } from 'express';
import { body, param } from 'express-validator';
import pesapalV2Controller from '../controllers/pesapal-v2.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v2/payments/pesapal/initiate:
 *   post:
 *     tags: [Payments V2]
 *     summary: Initiate Pesapal payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *               - customer
 *               - billingAddress
 *               - items
 *               - sellerId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Optional order ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 default: KES
 *                 description: Currency code
 *               description:
 *                 type: string
 *                 description: Payment description
 *               customer:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - email
 *                   - phone
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *               billingAddress:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - email
 *                   - phone
 *                   - countryCode
 *                   - address
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   countryCode:
 *                     type: string
 *                     default: KE
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                     default: Nairobi
 *                   state:
 *                     type: string
 *                     default: Nairobi
 *                   postalCode:
 *                     type: string
 *                     default: '00100'
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - name
 *                     - price
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *               sellerId:
 *                 type: string
 *                 description: ID of the seller
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                     orderId:
 *                       type: string
 *                     orderNumber:
 *                       type: string
 *                     reference:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/initiate',
  protect,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('description').notEmpty().withMessage('Description is required'),
    body('customer').isObject().withMessage('Customer details are required'),
    body('customer.firstName').notEmpty().withMessage('Customer first name is required'),
    body('customer.lastName').notEmpty().withMessage('Customer last name is required'),
    body('customer.email').isEmail().withMessage('Valid customer email is required'),
    body('customer.phone').notEmpty().withMessage('Customer phone is required'),
    body('billingAddress').isObject().withMessage('Billing address is required'),
    body('billingAddress.firstName').notEmpty().withMessage('Billing first name is required'),
    body('billingAddress.lastName').notEmpty().withMessage('Billing last name is required'),
    body('billingAddress.email').isEmail().withMessage('Valid billing email is required'),
    body('billingAddress.phone').notEmpty().withMessage('Billing phone is required'),
    body('billingAddress.countryCode').notEmpty().withMessage('Country code is required'),
    body('billingAddress.address').notEmpty().withMessage('Address is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.name').notEmpty().withMessage('Product name is required'),
    body('items.*.price').isNumeric().withMessage('Product price must be a number'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('sellerId').notEmpty().withMessage('Seller ID is required')
  ],
  pesapalV2Controller.initiatePayment
);

/**
 * @swagger
 * /api/v2/payments/pesapal/callback:
 *   get:
 *     tags: [Payments V2]
 *     summary: Handle Pesapal payment callback
 *     parameters:
 *       - in: query
 *         name: OrderTrackingId
 *         schema:
 *           type: string
 *         required: true
 *         description: Order tracking ID from Pesapal
 *       - in: query
 *         name: OrderMerchantReference
 *         schema:
 *           type: string
 *         required: true
 *         description: Merchant reference (order number)
 *       - in: query
 *         name: OrderNotificationType
 *         schema:
 *           type: string
 *         description: Notification type from Pesapal
 *     responses:
 *       302:
 *         description: Redirect to frontend with status
 */
router.get('/callback', pesapalV2Controller.handleCallback);

/**
 * @swagger
 * /api/v2/payments/pesapal/ipn:
 *   post:
 *     tags: [Payments V2]
 *     summary: Handle Pesapal IPN (Instant Payment Notification)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_tracking_id:
 *                 type: string
 *               order_notification_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: IPN processed successfully
 *       400:
 *         description: Invalid IPN data
 *       500:
 *         description: Server error
 */
router.post('/ipn', pesapalV2Controller.handleIPN);

/**
 * @swagger
 * /api/v2/payments/status/{reference}:
 *   get:
 *     tags: [Payments V2]
 *     summary: Check payment status
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Order reference or tracking ID
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     orderNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                     paymentStatus:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 paymentDetails:
 *                   type: object
 *       400:
 *         description: Invalid reference
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get(
  '/status/:reference',
  [param('reference').notEmpty().withMessage('Reference is required')],
  pesapalV2Controller.checkStatus
);

export default router;

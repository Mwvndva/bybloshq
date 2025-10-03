import express from 'express';
import * as sellerController from '../controllers/seller.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as orderController from '../controllers/order.controller.js';
import { upload } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Public routes
router.post('/register', sellerController.register);
router.post('/login', sellerController.login);
router.post('/forgot-password', sellerController.forgotPassword);
router.post('/reset-password', sellerController.resetPassword);
router.get('/check-shop-name', sellerController.checkShopNameAvailability);
router.get('/shop/:shopName', sellerController.getSellerByShopName);

// Search route - must come before other GET routes to avoid conflicts
router.get('/search', sellerController.searchSellers);

// Public product listing for a specific seller
router.get('/:sellerId/products', sellerController.getSellerProducts);

// Protected routes (require authentication)
router.use(protect);

// Seller profile routes
router.get('/profile', sellerController.getProfile);
router.patch('/profile', sellerController.updateProfile);
router.post('/upload-banner', sellerController.uploadBanner);
router.patch('/theme', sellerController.updateTheme);

// Seller analytics
router.get('/analytics', analyticsController.getSellerAnalytics);

// Seller orders
router.route('/orders')
  .get(orderController.getSellerOrders)  // Get all orders for the current seller
  .post(orderController.createOrder);    // Create a new order

router.route('/orders/:id')
  .get(orderController.getOrderById)     // Get a specific order
  .patch(orderController.updateOrderStatus); // Update order status

// Get seller by ID (protected)
// This must come after other specific routes to avoid conflicts
router.get('/:id(\\d+)', sellerController.getSellerById);

// Product management routes for the authenticated seller
router.route('/products')
  .get(productController.getSellerProducts)  // Get all products for the current seller
  .post(productController.createProduct);    // Create a new product

router.route('/products/:id')
  .get(productController.getProduct)         // Get a single product
  .patch(productController.updateProduct)     // Update a product
  .delete(productController.deleteProduct);   // Delete a product

// Simple withdrawal email route - direct nodemailer (like organizer system)
router.post('/withdrawals', async (req, res) => {
  try {
    const { mpesaNumber, registeredName, amount } = req.body;

    if (!mpesaNumber || !registeredName || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'M-Pesa number, registered name, and amount are required'
      });
    }

    // Get seller information from authenticated user
    const sellerId = req.user?.id;
    const sellerEmail = req.user?.email;

    // Create transporter (same as organizer system)
    const transporter = nodemailer.createTransporter({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: 'byblosexperience@zohomail.com',
      subject: 'New Withdrawal Request',
      html: `
<h2>New Withdrawal Request</h2>
<p><strong>Seller Information:</strong></p>
<ul>
  <li><strong>Seller ID:</strong> ${sellerId}</li>
  <li><strong>Seller Email:</strong> ${sellerEmail}</li>
  <li><strong>M-Pesa Number:</strong> ${mpesaNumber}</li>
  <li><strong>Registered Name:</strong> ${registeredName}</li>
  <li><strong>Amount:</strong> Ksh ${amount}</li>
</ul>
<p>Please process this withdrawal request.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      status: 'success',
      message: 'Withdrawal request sent successfully via email'
    });

  } catch (error) {
    console.error('Error sending withdrawal email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send withdrawal request. Please try again later or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

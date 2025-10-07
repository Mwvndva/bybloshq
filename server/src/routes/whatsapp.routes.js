import express from 'express';
import whatsappService from '../services/whatsapp.service.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/whatsapp/status
 * @desc    Get WhatsApp connection status
 * @access  Private (Admin/Seller)
 */
router.get('/status', protect, async (req, res) => {
  try {
    const isReady = whatsappService.isClientReady();
    const qrCode = whatsappService.getQRCode();
    
    res.json({
      success: true,
      data: {
        connected: isReady,
        qrCode: qrCode,
        message: isReady ? 'WhatsApp is connected' : 'WhatsApp is not connected'
      }
    });
  } catch (error) {
    console.error('Error checking WhatsApp status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check WhatsApp status'
    });
  }
});

/**
 * @route   GET /api/whatsapp/qr
 * @desc    Get QR code for WhatsApp authentication
 * @access  Private (Admin only)
 */
router.get('/qr', protect, async (req, res) => {
  try {
    const qrCode = whatsappService.getQRCode();
    
    if (!qrCode) {
      return res.json({
        success: true,
        data: {
          qrCode: null,
          message: whatsappService.isClientReady() 
            ? 'Already authenticated' 
            : 'QR code not available yet'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        qrCode,
        message: 'Scan this QR code with WhatsApp'
      }
    });
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR code'
    });
  }
});

/**
 * @route   POST /api/whatsapp/initialize
 * @desc    Initialize WhatsApp client
 * @access  Private (Admin only)
 */
router.post('/initialize', protect, async (req, res) => {
  try {
    if (whatsappService.isClientReady()) {
      return res.json({
        success: true,
        message: 'WhatsApp is already initialized and connected'
      });
    }
    
    // Initialize in background
    whatsappService.initialize().catch(err => {
      console.error('WhatsApp initialization error:', err);
    });
    
    res.json({
      success: true,
      message: 'WhatsApp initialization started. Check QR code endpoint for authentication.'
    });
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize WhatsApp'
    });
  }
});

/**
 * @route   POST /api/whatsapp/logout
 * @desc    Logout from WhatsApp
 * @access  Private (Admin only)
 */
router.post('/logout', protect, async (req, res) => {
  try {
    await whatsappService.logout();
    
    res.json({
      success: true,
      message: 'Logged out from WhatsApp successfully'
    });
  } catch (error) {
    console.error('Error logging out from WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout from WhatsApp'
    });
  }
});

/**
 * @route   POST /api/whatsapp/test
 * @desc    Send a test message
 * @access  Private (Admin only)
 */
router.post('/test', protect, async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }
    
    const sent = await whatsappService.sendMessage(phone, message);
    
    res.json({
      success: sent,
      message: sent ? 'Test message sent successfully' : 'Failed to send test message'
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test message'
    });
  }
});

export default router;


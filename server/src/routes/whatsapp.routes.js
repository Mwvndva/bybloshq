import express from 'express';
import whatsappService from '../services/whatsapp.service.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/whatsapp/status
 * @desc    Get WhatsApp connection status (Public for monitoring)
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const isReady = whatsappService.isClientReady();
    const qrCode = whatsappService.getQRCode();
    
    console.log('Status check - Ready:', isReady, 'Has QR:', !!qrCode);
    
    res.json({
      success: true,
      data: {
        connected: isReady,
        hasQRCode: !!qrCode,
        qrAvailable: !isReady && !!qrCode,
        status: isReady ? 'ready' : (qrCode ? 'awaiting_scan' : 'initializing'),
        message: isReady 
          ? 'WhatsApp is connected and ready' 
          : (qrCode ? 'QR code available - scan to authenticate' : 'WhatsApp client is initializing')
      }
    });
  } catch (error) {
    console.error('Error checking WhatsApp status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check WhatsApp status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/whatsapp/qr
 * @desc    Get QR code for WhatsApp authentication (Public for initial setup)
 * @access  Public (but should be secured in production after setup)
 */
router.get('/qr', async (req, res) => {
  try {
    const qrCode = whatsappService.getQRCode();
    const isReady = whatsappService.isClientReady();
    
    console.log('QR Code request - Ready:', isReady, 'Has QR:', !!qrCode);
    
    if (!qrCode && !isReady) {
      return res.json({
        success: true,
        data: {
          qrCode: null,
          message: 'QR code not generated yet. WhatsApp client may still be initializing. Try again in a few seconds.',
          status: 'initializing'
        }
      });
    }
    
    if (isReady) {
      return res.json({
        success: true,
        data: {
          qrCode: null,
          message: 'Already authenticated! WhatsApp is ready.',
          status: 'authenticated'
        }
      });
    }
    
    // Return QR code as both text and image URL
    res.json({
      success: true,
      data: {
        qrCode,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`,
        message: 'Scan this QR code with WhatsApp mobile app',
        status: 'awaiting_scan'
      }
    });
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR code',
      error: error.message
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


import express from 'express';
import sseService from '../services/sse.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * SSE endpoint for real-time payment status updates
 * GET /api/payments/status/:invoiceId/stream
 */
router.get('/status/:invoiceId/stream', (req, res) => {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required'
    });
  }

  logger.info(`SSE: New connection request for invoice ${invoiceId}`);

  // Subscribe the client to updates for this invoice
  sseService.subscribe(invoiceId, res);

  // Handle client disconnect
  req.on('close', () => {
    logger.info(`SSE: Client disconnected for invoice ${invoiceId}`);
    sseService.unsubscribe(invoiceId, res);
  });
});

export default router;


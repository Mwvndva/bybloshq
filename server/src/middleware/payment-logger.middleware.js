import logger from '../utils/logger.js';
/**

 * Payment Request Logger Middleware
 * Logs all payment-related requests to identify duplicates
 */
const paymentRequestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  if (req.path.includes('/payment') || req.path.includes('/paystack')) {
    logger.info(`[PAYMENT-REQ] ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'authorization': req.headers.authorization ? '[REDACTED]' : 'none'
      },
      query: req.query,
      timestamp: new Date().toISOString()
    });
  }
  next();
};


export default paymentRequestLogger;

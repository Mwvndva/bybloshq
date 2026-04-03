import logger from '../utils/logger.js';

/**
 * Payment Request Logger Middleware
 * Logs all payment-related requests while redacting sensitive PII
 */
const paymentRequestLogger = (req, res, next) => {
  if (req.path.includes('/payment') || req.path.includes('/paystack') || req.path.includes('/payd')) {
    const redact = (obj) => {
      const sanitized = { ...obj };
      ['phone', 'email', 'whatsapp_number', 'mobile_payment', 'token', 'authorization'].forEach(key => {
        if (sanitized[key]) sanitized[key] = '[REDACTED]';
      });
      return sanitized;
    };

    logger.info('PAYMENT-REQUEST', {
      method: req.method,
      path: req.path.replace(/[\n\r]/g, ''),
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'authorization': req.headers.authorization ? '[REDACTED]' : 'none'
      },
      body: redact(req.body),
      query: redact(req.query)
    });
  }
  next();
};

export default paymentRequestLogger;

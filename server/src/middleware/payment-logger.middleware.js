/**
 * Payment Request Logger Middleware
 * Logs all payment-related requests to identify duplicates
 */
const paymentRequestLogger = (req, res, next) => {
  if (req.path.includes('/payment') || req.path.includes('/paystack')) {
    console.log('\n=== PAYMENT REQUEST LOGGER ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Path:', req.path);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'authorization': req.headers.authorization ? '[REDACTED]' : 'none'
    });
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    console.log('=============================\n');
  }
  next();
};

export default paymentRequestLogger;

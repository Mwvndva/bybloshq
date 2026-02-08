/**
 * DEPRECATION NOTICE
 * 
 * This file contains legacy PayStack integration code.
 * PayStack is NO LONGER SUPPORTED in this application.
 * 
 * The application has migrated to Payd (M-Pesa) as the primary payment provider.
 * 
 * SECURITY CONCERNS:
 * - This file uses CommonJS (require) instead of ES modules
 * - Uses deprecated authentication middleware
 * - Contains potential SQL injection vulnerabilities
 * - Not maintained or tested
 * 
 * ACTION REQUIRED:
 * - DO NOT USE this route in production
 * - Remove from route mounting in index.js
 * - Archive or delete this file
 * 
 * For payment processing, use:
 * - /api/payments (Payd integration)
 * - /api/callbacks/payd (Payd webhooks)
 * 
 * Last updated: 2026-02-08
 * Status: DEPRECATED - DO NOT USE
 */

// This file is deprecated and should not be used
// See deprecation notice above

const express = require('express');
const router = express.Router();

// Return 410 Gone for all PayStack routes
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'PayStack integration has been deprecated. Please use Payd (M-Pesa) payment methods.',
    error: 'PAYMENT_METHOD_DEPRECATED',
    alternatives: {
      initiate: '/api/payments',
      webhook: '/api/callbacks/payd'
    }
  });
});

module.exports = router;

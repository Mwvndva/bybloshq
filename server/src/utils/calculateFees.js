import Fees from '../config/fees.js';

/**
 * Calculate platform fee for an order
 * @param {number} amount - Order amount
 * @param {number} commissionRate - Platform commission rate (default: from config)
 * @returns {number} Calculated platform fee
 */
const calculatePlatformFee = (amount, commissionRate = Fees.PLATFORM_COMMISSION_RATE) => {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    throw new Error('Invalid amount provided for fee calculation');
  }

  // Ensure commission rate is between 0 and 1
  const rate = Math.max(0, Math.min(1, commissionRate));

  // Calculate fee and round to 2 decimal places
  const fee = Math.round(amount * rate * 100) / 100;

  return fee;
};

/**
 * Calculate seller payout after platform fee
 * @param {number} amount - Order amount
 * @param {number} commissionRate - Platform commission rate (default: from config)
 * @returns {number} Seller payout amount
 */
const calculateSellerPayout = (amount, commissionRate = Fees.PLATFORM_COMMISSION_RATE) => {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    throw new Error('Invalid amount provided for payout calculation');
  }

  const fee = calculatePlatformFee(amount, commissionRate);
  const payout = Math.round((amount - fee) * 100) / 100;

  return payout;
};

/**
 * Format amount with currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'KES')
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount, currency = 'KES') => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `${currency} 0.00`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export {
  calculatePlatformFee,
  calculateSellerPayout,
  formatCurrency
};

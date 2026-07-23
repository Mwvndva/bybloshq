import { z } from 'zod';

// Schema for updating order status
const updateOrderStatusSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  notes: z.string().optional().default('')
});

// Schema for order query parameters (pagination, filtering)
const orderQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  page: z.preprocess((val) => Number.parseInt(val, 10), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => Number.parseInt(val, 10), z.number().int().min(1).max(100).default(10))
});

// Schema for order ID parameter
const orderIdSchema = z.object({
  id: z.string().uuid('Invalid Order ID format')
});

// Schema for order status history query parameters
const orderStatusHistorySchema = z.object({
  orderId: z.string().uuid('Invalid Order ID format')
});

// Schema for order cancellation
const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
  notes: z.string().optional().default('')
});

// Schema for order refund
const refundOrderSchema = z.object({
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.string().min(1, 'Refund reason is required'),
  notes: z.string().optional().default('')
});

// Schema for order tracking
const trackOrderSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  carrier: z.string().min(1, 'Shipping carrier is required'),
  url: z.string().url().optional()
});

// Schema for buyer receipt confirmation
const confirmReceiptSchema = z.object({
  id: z.string().min(1, 'Order ID is required')
});

// Schema for buyer order cancellation
const cancelOrderActionSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  reason: z.string().optional().default('Buyer requested cancellation')
});

// Schema for seller order cancellation
const sellerCancelOrderActionSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  reason: z.string().optional().default('Seller requested cancellation')
});

export {
  updateOrderStatusSchema,
  orderQuerySchema,
  orderIdSchema,
  orderStatusHistorySchema,
  cancelOrderSchema,
  refundOrderSchema,
  trackOrderSchema,
  confirmReceiptSchema,
  cancelOrderActionSchema,
  sellerCancelOrderActionSchema
};


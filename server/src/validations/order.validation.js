import { z } from 'zod';

/**
 * Route-level input validation schemas (Zod).
 * These validate raw HTTP request bodies before they reach the service layer.
 *
 * NOTE: These are ROUTE guards — they operate on raw request shapes.
 * Internal business validation is in /validators/order.validator.js
 */

// Schema for creating an order via the API (minimal — bulk of validation is in OrderService)
const createOrderSchema = z.object({
  productId: z.union([z.string(), z.number()]).optional(),
  serviceId: z.union([z.string(), z.number()]).optional(),
  quantity: z.number().int().min(1).default(1),
  paymentMethod: z.enum(['payd', 'mpesa', 'cash', 'debt']).default('payd'),
  sellerId: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Schema for updating order status (matches real OrderStatus enum values)
const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING', 'RESERVED', 'PAID', 'PROCESSING', 'CONFIRMED',
    'SERVICE_PENDING', 'DELIVERY_PENDING', 'DELIVERY_COMPLETE',
    'COLLECTION_PENDING', 'COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED',
    'CLIENT_PAYMENT_PENDING', 'DEBT_PENDING'
  ]),
  notes: z.string().optional().default('')
});

// Schema for order query parameters (pagination, filtering)
const orderQuerySchema = z.object({
  status: z.string().optional(),
  page: z.preprocess((val) => Number.parseInt(String(val), 10), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => Number.parseInt(String(val), 10), z.number().int().min(1).max(100).default(10))
});

// Schema for order cancellation
const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').optional(),
  notes: z.string().optional().default('')
});

export {
  createOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
  cancelOrderSchema,
};

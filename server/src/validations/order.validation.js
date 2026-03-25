import { z } from 'zod';

// Schema for creating a new order
const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      name: z.string().min(1, 'Product name is required'),
      price: z.number().positive('Price must be positive'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      image: z.string().url().optional()
    })
  ).min(1, 'Order items cannot be empty'),

  shippingAddress: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone number is required'),
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State/Region is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    additionalInfo: z.string().optional().default('')
  }),

  paymentMethod: z.enum(['paystack', 'debt']),

  sellerId: z.number().int()
});

// Schema for updating order status
const updateOrderStatusSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  notes: z.string().optional().default('')
});

// Schema for order query parameters (pagination, filtering)
const orderQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  page: z.preprocess((val) => parseInt(val, 10), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => parseInt(val, 10), z.number().int().min(1).max(100).default(10))
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

export {
  createOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
  orderIdSchema,
  orderStatusHistorySchema,
  cancelOrderSchema,
  refundOrderSchema,
  trackOrderSchema
};

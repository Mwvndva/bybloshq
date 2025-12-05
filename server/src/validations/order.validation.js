import Joi from 'joi';

// Schema for creating a new order
const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required().label('Product ID'),
        name: Joi.string().required().label('Product name'),
        price: Joi.number().positive().required().label('Price'),
        quantity: Joi.number().integer().min(1).required().label('Quantity'),
        image: Joi.string().uri().optional().label('Product image')
      })
    )
    .min(1)
    .required()
    .label('Order items'),
  
  shippingAddress: Joi.object({
    firstName: Joi.string().required().label('First name'),
    lastName: Joi.string().required().label('Last name'),
    email: Joi.string().email().required().label('Email'),
    phone: Joi.string().required().label('Phone number'),
    address: Joi.string().required().label('Address'),
    city: Joi.string().required().label('City'),
    state: Joi.string().required().label('State/Region'),
    postalCode: Joi.string().required().label('Postal code'),
    country: Joi.string().required().label('Country'),
    additionalInfo: Joi.string().allow('').optional().label('Additional information')
  }).required().label('Shipping address'),
  
  paymentMethod: Joi.string()
    .valid('paystack')
    .required()
    .label('Payment method'),
    
  sellerId: Joi.number().integer().required().label('Seller ID')
});

// Schema for updating order status
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('processing', 'shipped', 'delivered', 'cancelled', 'refunded')
    .required()
    .label('Order status'),
    
  notes: Joi.string().allow('').optional().label('Status notes')
});

// Schema for order query parameters (pagination, filtering)
const orderQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
    .optional()
    .label('Order status'),
    
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .label('Page number'),
    
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .label('Items per page')
});

// Schema for order ID parameter
const orderIdSchema = Joi.object({
  id: Joi.string().uuid().required().label('Order ID')
});

// Schema for order status history query parameters
const orderStatusHistorySchema = Joi.object({
  orderId: Joi.string().uuid().required().label('Order ID')
});

// Schema for order cancellation
const cancelOrderSchema = Joi.object({
  reason: Joi.string().required().label('Cancellation reason'),
  notes: Joi.string().allow('').optional().label('Additional notes')
});

// Schema for order refund
const refundOrderSchema = Joi.object({
  amount: Joi.number().positive().required().label('Refund amount'),
  reason: Joi.string().required().label('Refund reason'),
  notes: Joi.string().allow('').optional().label('Additional notes')
});

// Schema for order tracking
const trackOrderSchema = Joi.object({
  trackingNumber: Joi.string().required().label('Tracking number'),
  carrier: Joi.string().required().label('Shipping carrier'),
  url: Joi.string().uri().optional().label('Tracking URL')
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

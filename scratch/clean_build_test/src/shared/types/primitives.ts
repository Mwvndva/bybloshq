// Leaf primitive types shared across the type barrel and the api/* type
// modules. Kept in a dependency-free file so api/product.ts, api/seller.ts,
// and api/order.ts can import them without creating a cycle through the ./index barrel.
export type ProductType = 'physical' | 'digital' | 'service';
export type Theme =
  | 'default'
  | 'black'
  | 'pink'
  | 'orange'
  | 'green'
  | 'red'
  | 'yellow'
  | 'brown'
  | 'purple';

export type OrderStatus =
  | 'PENDING'
  | 'CREATED'
  | 'RESERVED'
  | 'HELD'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'AWAITING_SELLER_ACTION'
  | 'FULFILLING'
  | 'READY_FOR_BUYER'
  | 'PROCESSING'
  | 'DELIVERY_PENDING'
  | 'CONFIRMED'
  | 'SERVICE_PENDING'
  | 'COLLECTION_PENDING'
  | 'DELIVERY_COMPLETE'
  | 'FULFILLMENT_PENDING'
  | 'FULFILLED'
  | 'DELIVERED'
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'MANUAL_REVIEW'
  | 'COMPENSATION_REQUIRED';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed' | 'completed' | 'paid' | 'cancelled' | 'manual_review';

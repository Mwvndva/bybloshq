-- Migration: Add order deadline tracking columns
-- Created: 2026-01-09

ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS seller_dropoff_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS buyer_pickup_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_cancelled_reason TEXT,
ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient deadline queries
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_dropoff_deadline 
ON product_orders(seller_dropoff_deadline) 
WHERE seller_dropoff_deadline IS NOT NULL AND status = 'DELIVERY_PENDING';

CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_pickup_deadline 
ON product_orders(buyer_pickup_deadline) 
WHERE buyer_pickup_deadline IS NOT NULL AND status = 'DELIVERY_COMPLETE';

-- Index for service payment release queries
CREATE INDEX IF NOT EXISTS idx_product_orders_service_payment_release
ON product_orders(status, payment_status, metadata)
WHERE status = 'DELIVERY_COMPLETE' AND payment_status != 'completed';

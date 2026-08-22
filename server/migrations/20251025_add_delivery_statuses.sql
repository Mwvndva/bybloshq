-- Migration: Add delivery statuses to order_status enum
-- This migration safely adds DELIVERY_PENDING and DELIVERY_COMPLETE to the existing enum

-- Add new enum values to the existing order_status enum
-- Note: PostgreSQL requires adding values at the end of the enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_COMPLETE';

-- Add comment to document the new delivery flow
COMMENT ON TYPE order_status IS 'Order status enum supporting delivery flow: PENDING -> DELIVERY_PENDING -> DELIVERY_COMPLETE -> COMPLETED';

-- Log the successful addition
DO $$
BEGIN
    RAISE NOTICE 'Successfully added DELIVERY_PENDING and DELIVERY_COMPLETE to order_status enum';
    RAISE NOTICE 'New delivery flow: PENDING -> DELIVERY_PENDING -> DELIVERY_COMPLETE -> COMPLETED';
END $$;

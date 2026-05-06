-- Migration: Sync Order Status Enum
-- Reason: Add HELD and other missing statuses used in the code to the database enum type.
-- This script is idempotent.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'HELD';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CLIENT_PAYMENT_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DEBT_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_COMPLETE';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FAILED';

-- Migration: Add READY_FOR_PICKUP status to order_status enum
-- Idempotent enum addition using native PostgreSQL syntax

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';

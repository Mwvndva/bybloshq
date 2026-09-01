-- Migration: Add refunded value to payment_status PostgreSQL enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_status'
    ) THEN
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';
    END IF;
END $$;

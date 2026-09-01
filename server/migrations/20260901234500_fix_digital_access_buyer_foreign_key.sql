-- Migration: Fix digital_access table to support buyer_id and nullable user_id
-- Reason: Fix foreign key constraint error when granting digital access for orders

-- 1. Make user_id nullable on digital_access
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'digital_access'
          AND column_name = 'user_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE digital_access ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- 2. Add buyer_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'digital_access'
          AND column_name = 'buyer_id'
    ) THEN
        ALTER TABLE digital_access
            ADD COLUMN buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_digital_access_buyer_id ON digital_access(buyer_id);
    END IF;
END $$;

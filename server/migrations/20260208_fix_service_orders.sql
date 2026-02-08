-- 20260208_fix_service_orders.sql
-- Adds location coordinate fields to buyers table for enhanced service bookings

DO $$
BEGIN
    -- 1. Add latitude to buyers if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'latitude') THEN
        ALTER TABLE buyers ADD COLUMN latitude DECIMAL(10, 8);
    END IF;

    -- 2. Add longitude to buyers if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'longitude') THEN
        ALTER TABLE buyers ADD COLUMN longitude DECIMAL(11, 8);
    END IF;

    -- 3. Add full_address to buyers if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'full_address') THEN
        ALTER TABLE buyers ADD COLUMN full_address TEXT;
    END IF;
END $$;

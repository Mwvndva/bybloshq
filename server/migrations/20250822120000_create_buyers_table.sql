-- 20250822_create_buyers_table.sql
-- This migration is now idempotent and only adds missing columns/constraints

DO $$
BEGIN
    -- Only proceed if the buyers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        -- Add mobile_payment (for M-Pesa STK Pushes) and whatsapp_number (for Admin contact)
        ALTER TABLE buyers 
            ADD COLUMN IF NOT EXISTS mobile_payment VARCHAR(50),
            ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

        -- Create index on mobile_payment for fast checkout identity resolution
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'mobile_payment')
           AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_buyers_mobile_payment' AND tablename = 'buyers') THEN
            CREATE INDEX idx_buyers_mobile_payment ON buyers(mobile_payment) WHERE mobile_payment IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'email')
           AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_buyers_email') THEN
            CREATE INDEX idx_buyers_email ON buyers(LOWER(email));
        END IF;

        -- Add comments for documentation
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'buyers') THEN
            COMMENT ON TABLE buyers IS 'Stores buyer authentication and profile information';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'mobile_payment') THEN
            COMMENT ON COLUMN buyers.mobile_payment IS 'Mobile payment number used exclusively for M-Pesa STK Pushes';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'whatsapp_number') THEN
            COMMENT ON COLUMN buyers.whatsapp_number IS 'Admin contact number for manual customer support (no automated notifications)';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'email') THEN
            COMMENT ON COLUMN buyers.email IS 'Unique email address used for login';
        END IF;
    END IF;
END $$;

-- 20250822_create_buyers_table.sql
-- This migration is now idempotent and only adds missing columns/constraints

DO $$
BEGIN
    -- Only proceed if the buyers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        -- Add columns if they don't exist
        ALTER TABLE buyers 
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

        -- Create indexes if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_buyers_email') THEN
            CREATE INDEX idx_buyers_email ON buyers(LOWER(email));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_buyers_phone' AND tablename = 'buyers') THEN
            CREATE INDEX idx_buyers_phone ON buyers(phone) WHERE phone IS NOT NULL;
        END IF;

        -- Add comments if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = 0 AND objoid = 'buyers'::regclass) THEN
            COMMENT ON TABLE buyers IS 'Stores buyer authentication and profile information';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'email' AND attrelid = 'buyers'::regclass)) THEN
            COMMENT ON COLUMN buyers.email IS 'Unique email address used for login';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'password' AND attrelid = 'buyers'::regclass)) THEN
            COMMENT ON COLUMN buyers.password IS 'Hashed password using bcrypt';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'status' AND attrelid = 'buyers'::regclass)) THEN
            COMMENT ON COLUMN buyers.status IS 'Account status: active, suspended, or inactive';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'verification_token' AND attrelid = 'buyers'::regclass)) THEN
            COMMENT ON COLUMN buyers.verification_token IS 'Token for email verification';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_description WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'reset_password_token' AND attrelid = 'buyers'::regclass)) THEN
            COMMENT ON COLUMN buyers.reset_password_token IS 'Token for password reset';
        END IF;
    END IF;
END $$;

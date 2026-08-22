-- This migration adds password reset columns to the organizers table if they don't exist

-- First, check if the columns exist
DO $$
BEGIN
    -- Add password_reset_token column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'organizers' AND column_name = 'password_reset_token') THEN
        ALTER TABLE organizers ADD COLUMN password_reset_token VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_organizers_password_reset_token ON organizers(password_reset_token);
        RAISE NOTICE 'Added password_reset_token column to organizers table';
    ELSE
        RAISE NOTICE 'password_reset_token column already exists in organizers table';
    END IF;

    -- Add password_reset_expires column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'organizers' AND column_name = 'password_reset_expires') THEN
        ALTER TABLE organizers ADD COLUMN password_reset_expires TIMESTAMP WITH TIME ZONE;
        CREATE INDEX IF NOT EXISTS idx_organizers_password_reset_expires ON organizers(password_reset_expires);
        RAISE NOTICE 'Added password_reset_expires column to organizers table';
    ELSE
        RAISE NOTICE 'password_reset_expires column already exists in organizers table';
    END IF;
END
$$;

-- This migration ensures the password reset columns exist with the correct structure

-- First, check if the columns exist and have the correct type
DO $$
BEGIN
    -- Check if password_reset_token exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizers' 
        AND column_name = 'password_reset_token'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE organizers ADD COLUMN password_reset_token VARCHAR(255);
        RAISE NOTICE 'Added password_reset_token column to organizers table';
    ELSE
        -- Check if the column has the correct type
        PERFORM 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizers' 
        AND column_name = 'password_reset_token' 
        AND data_type = 'character varying' 
        AND character_maximum_length = 255;
        
        IF NOT FOUND THEN
            -- Alter the column to have the correct type
            ALTER TABLE organizers 
            ALTER COLUMN password_reset_token TYPE VARCHAR(255);
            RAISE NOTICE 'Updated password_reset_token column type to VARCHAR(255)';
        ELSE
            RAISE NOTICE 'password_reset_token column already exists with correct type';
        END IF;
    END IF;

    -- Check if password_reset_expires exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizers' 
        AND column_name = 'password_reset_expires'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE organizers ADD COLUMN password_reset_expires TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added password_reset_expires column to organizers table';
    ELSE
        -- Check if the column has the correct type
        PERFORM 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizers' 
        AND column_name = 'password_reset_expires' 
        AND data_type = 'timestamp with time zone';
        
        IF NOT FOUND THEN
            -- Alter the column to have the correct type
            ALTER TABLE organizers 
            ALTER COLUMN password_reset_expires TYPE TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE 'Updated password_reset_expires column type to TIMESTAMP WITH TIME ZONE';
        ELSE
            RAISE NOTICE 'password_reset_expires column already exists with correct type';
        END IF;
    END IF;

    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_organizers_password_reset_token ON organizers(password_reset_token);
    CREATE INDEX IF NOT EXISTS idx_organizers_password_reset_expires ON organizers(password_reset_expires);
    
    RAISE NOTICE 'Ensured indexes exist for password reset columns';
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in migration: %', SQLERRM;
    RAISE;
END
$$;

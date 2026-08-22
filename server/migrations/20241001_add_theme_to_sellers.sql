-- Add theme column to sellers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'sellers' AND column_name = 'theme') THEN
        ALTER TABLE sellers ADD COLUMN theme VARCHAR(20) DEFAULT 'default';
        
        -- Create an index on the theme column if needed
        -- CREATE INDEX IF NOT EXISTS idx_sellers_theme ON sellers(theme);
    END IF;
END $$;

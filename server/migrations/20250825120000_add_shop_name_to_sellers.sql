-- 20250825_add_shop_name_to_sellers.sql
-- Add shop_name column to sellers table with unique constraint

-- Add the column if it doesn't exist
DO $$
BEGIN
    -- Add shop_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'sellers' AND column_name = 'shop_name') THEN
        ALTER TABLE sellers 
        ADD COLUMN shop_name VARCHAR(50) UNIQUE,
        ADD COLUMN slug VARCHAR(60) GENERATED ALWAYS AS (LOWER(REPLACE(shop_name, ' ', '-'))) STORED UNIQUE;
        
        -- Create an index on the slug for faster lookups
        CREATE INDEX IF NOT EXISTS idx_sellers_slug ON sellers(slug);
        
        -- Update existing rows to have a default shop name based on their email
        UPDATE sellers 
        SET shop_name = 'shop-' || id
        WHERE shop_name IS NULL;
        
        -- Make the column NOT NULL after setting default values
        ALTER TABLE sellers 
        ALTER COLUMN shop_name SET NOT NULL;
    END IF;
END $$;

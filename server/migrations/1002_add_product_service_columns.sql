DO $$
BEGIN
    -- Product type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE product_type AS ENUM ('physical', 'digital', 'service');
    END IF;

    -- Add columns to products table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_type') THEN
        ALTER TABLE products ADD COLUMN product_type product_type DEFAULT 'physical';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='service_locations') THEN
        ALTER TABLE products ADD COLUMN service_locations TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='service_options') THEN
        ALTER TABLE products ADD COLUMN service_options JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_digital') THEN
        ALTER TABLE products ADD COLUMN is_digital BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='digital_file_path') THEN
        ALTER TABLE products ADD COLUMN digital_file_path TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='digital_file_name') THEN
        ALTER TABLE products ADD COLUMN digital_file_name TEXT;
    END IF;
END $$;

-- Add digital product fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS digital_file_path TEXT,
ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add physical_address column if it doesn't exist
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS physical_address TEXT;

-- Add latitude column if it doesn't exist
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS latitude FLOAT;

-- Add longitude column if it doesn't exist
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS longitude FLOAT;

-- Create an index for geolocation queries if needed (optional but good practice)
-- CREATE INDEX IF NOT EXISTS idx_sellers_location_coords ON sellers (latitude, longitude);

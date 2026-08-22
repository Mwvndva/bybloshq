-- 20250108_add_location_fields_to_sellers.sql
-- Adds city and location fields to the sellers table for location tracking

ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS location VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sellers_city ON sellers(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sellers_location ON sellers(location) WHERE location IS NOT NULL;

COMMENT ON COLUMN sellers.city IS 'City where the seller is located';
COMMENT ON COLUMN sellers.location IS 'Specific location/area within the city';



-- 20250107_add_location_fields_to_buyers.sql
-- Adds city and location fields to the buyers table for location tracking

-- First check if the buyers table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        -- Add city and location columns to buyers table if they don't exist
        ALTER TABLE buyers 
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS location VARCHAR(100);

        -- Add comments for documentation
        COMMENT ON COLUMN buyers.city IS 'City where the buyer is located';
        COMMENT ON COLUMN buyers.location IS 'Specific location/area within the city';
    END IF;
END $$;

-- 20240925_create_buyers_table.sql
-- Creates the buyers table if it doesn't exist

CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password VARCHAR(255) NOT NULL,
  status user_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  city VARCHAR(100),
  location VARCHAR(100)
);

-- Add comments for documentation
COMMENT ON TABLE buyers IS 'Table storing buyer information';
COMMENT ON COLUMN buyers.city IS 'City where the buyer is located';
COMMENT ON COLUMN buyers.location IS 'Specific location/area within the city';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);
CREATE INDEX IF NOT EXISTS idx_buyers_city ON buyers(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyers_location ON buyers(location) WHERE location IS NOT NULL;

-- Create trigger to update updated_at
CREATE TRIGGER update_buyers_updated_at
BEFORE UPDATE ON buyers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20250822_create_buyers_table.sql
-- Creates the buyers table for storing buyer authentication details

-- Create buyers table
CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password VARCHAR(255) NOT NULL,
  status user_status DEFAULT 'active' NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP WITH TIME ZONE,
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_buyers_phone ON buyers(phone) WHERE phone IS NOT NULL;

-- Add trigger to automatically update the updated_at column
CREATE TRIGGER update_buyers_updated_at
BEFORE UPDATE ON buyers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE buyers IS 'Stores buyer authentication and profile information';
COMMENT ON COLUMN buyers.email IS 'Unique email address used for login';
COMMENT ON COLUMN buyers.password IS 'Hashed password using bcrypt';
COMMENT ON COLUMN buyers.status IS 'Account status: active, suspended, or inactive';
COMMENT ON COLUMN buyers.verification_token IS 'Token for email verification';
COMMENT ON COLUMN buyers.reset_password_token IS 'Token for password reset';

-- Add sample data for development (optional, can be removed in production)
-- INSERT INTO buyers (full_name, email, phone, password, is_verified)
-- VALUES 
--   ('John Doe', 'john@example.com', '+1234567890', '$2b$10$examplehashedpassword', true),
--   ('Jane Smith', 'jane@example.com', '+1987654321', '$2b$10$examplehashedpassword2', true);

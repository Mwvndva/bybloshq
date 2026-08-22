-- Add user_id column to tickets table
-- This allows tickets to be linked to registered buyers when available
-- Note: The database uses 'buyers' table, not 'users' table

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL;

-- Add index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id) WHERE user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.user_id 
IS 'Optional reference to the buyers table. NULL for guest purchases.';


-- Add balance column to sellers table
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS balance DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Add balance_updated_at column for tracking balance changes
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMP WITH TIME ZONE;

-- Set initial balance_updated_at for existing sellers
UPDATE sellers 
SET balance_updated_at = NOW() 
WHERE balance_updated_at IS NULL;

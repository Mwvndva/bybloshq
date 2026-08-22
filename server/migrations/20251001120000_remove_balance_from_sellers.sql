-- Remove balance related columns from sellers table
ALTER TABLE sellers
DROP COLUMN IF EXISTS balance,
DROP COLUMN IF EXISTS balance_updated_at,
DROP COLUMN IF EXISTS available_balance,
DROP COLUMN IF EXISTS pending_balance;

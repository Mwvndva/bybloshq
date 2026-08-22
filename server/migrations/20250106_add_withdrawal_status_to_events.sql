-- 20250106_add_withdrawal_status_to_events.sql
-- Add withdrawal status to events table to track payment status

-- Add withdrawal_status column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS withdrawal_status VARCHAR(20) DEFAULT 'pending' CHECK (withdrawal_status IN ('pending', 'paid', 'withdrawn'));

-- Add withdrawal_date column to track when withdrawal was processed
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS withdrawal_date TIMESTAMP WITH TIME ZONE;

-- Add withdrawal_amount column to track the amount withdrawn
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS withdrawal_amount DECIMAL(12, 2);

-- Add withdrawal_method column to track withdrawal method (mpesa, bank, etc.)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS withdrawal_method VARCHAR(50);

-- Add withdrawal_details column to store withdrawal details (account info, etc.)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS withdrawal_details JSONB;

-- Create index for withdrawal_status for better query performance
CREATE INDEX IF NOT EXISTS idx_events_withdrawal_status ON events(withdrawal_status);

-- Add comment to document the new columns
COMMENT ON COLUMN events.withdrawal_status IS 'Status of withdrawal: pending (default), paid (withdrawal processed), withdrawn (marked as withdrawn)';
COMMENT ON COLUMN events.withdrawal_date IS 'Date when withdrawal was processed';
COMMENT ON COLUMN events.withdrawal_amount IS 'Amount that was withdrawn';
COMMENT ON COLUMN events.withdrawal_method IS 'Method used for withdrawal (mpesa, bank, etc.)';
COMMENT ON COLUMN events.withdrawal_details IS 'Additional withdrawal details stored as JSON';

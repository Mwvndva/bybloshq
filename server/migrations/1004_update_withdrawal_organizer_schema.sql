-- Add balance column to organizers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='balance') THEN
        ALTER TABLE organizers ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

-- Update withdrawal_requests table to support organizers
ALTER TABLE withdrawal_requests ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE;

-- Add check constraint to ensure mostly one of seller_id or organizer_id is set
-- Removing old check if it exists (though we didn't add one for this specific exclusivity before)
-- Adding a constraint to ensure at least one is present and valid
ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_owner_check 
CHECK (
    (seller_id IS NOT NULL AND organizer_id IS NULL) OR 
    (seller_id IS NULL AND organizer_id IS NOT NULL)
);

-- Index for organizer withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_organizer_id ON withdrawal_requests(organizer_id);

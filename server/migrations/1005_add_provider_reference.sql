-- Add provider_reference and raw_response columns to withdrawal_requests table
ALTER TABLE withdrawal_requests 
ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- Add a unique constraint to provider_reference to ensure we can identify transactions uniquely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_provider_reference_key'
    ) THEN
        ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_provider_reference_key UNIQUE (provider_reference);
    END IF;
END $$;

-- Drop the existing check constraint
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;

-- Add the updated check constraint including 'processing' and 'failed'
ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check 
CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'completed', 'failed'));

-- Verification Script: Check Withdrawal Status Flow
-- Run this after making a test withdrawal to verify the fix

-- 1. Check the most recent withdrawal request
SELECT 
    id,
    seller_id,
    amount,
    status,
    provider_reference,
    created_at,
    processed_at,
    raw_response::json->>'status' as payd_response_status
FROM withdrawal_requests
ORDER BY created_at DESC
LIMIT 5;

-- Expected Results:
-- - Immediately after withdrawal: status should be 'processing'
-- - After Payd callback: status should be 'completed' or 'failed'
-- - If failed: seller balance should be refunded

-- 2. Check seller balance changes
SELECT 
    id,
    full_name,
    balance,
    phone
FROM sellers
WHERE id = (SELECT seller_id FROM withdrawal_requests ORDER BY created_at DESC LIMIT 1);

-- 3. Verify callback processing (check for metadata)
SELECT 
    id,
    status,
    metadata::json->>'failure_reason' as failure_reason,
    processed_at
FROM withdrawal_requests
WHERE status IN ('completed', 'failed')
ORDER BY processed_at DESC
LIMIT 5;

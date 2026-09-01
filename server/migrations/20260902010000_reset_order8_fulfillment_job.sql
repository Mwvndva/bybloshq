-- Migration: Reset Order 8 exhausted fulfillment job and order status
-- Reason: Order 8's digital fulfillment failed 5 times (hit max_attempts) due to a
--         now-fixed FK bug on digital_access.user_id. The job was permanently excluded
--         from the retry queue. This migration resets it so the worker can complete
--         fulfillment and credit the seller's pending_settlement_balance via EscrowManager.

-- 1. Reset the fulfillment job: clear attempt counter so the queue picks it up again.
UPDATE fulfillment_jobs
SET
    status          = 'PENDING',
    attempts        = 0,
    error_message   = NULL,
    last_attempt_at = NULL,
    updated_at      = NOW()
WHERE order_id = 8
  AND status IN ('FAILED', 'PROCESSING');

-- 2. Roll the order status back to PAID so executeFulfillment() enters cleanly.
--    (If it is already PAID this is a no-op; if stuck in FULFILLING/FAILED it unblocks it.)
UPDATE product_orders
SET
    status     = 'PAID',
    updated_at = NOW()
WHERE id = 8
  AND status IN ('FULFILLING', 'FAILED');

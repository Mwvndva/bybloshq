-- Migration: Reset Order 8 exhausted fulfillment job and order status
-- Reason: Order 8 digital fulfillment failed 5 times (hit max_attempts) due to
--         a now-fixed FK bug on digital_access.user_id. Reset lets the worker
--         retry, complete the order, and credit the seller via EscrowManager.

-- 1. Reset the fulfillment job so the queue picks it up again.
UPDATE fulfillment_jobs
SET
    status          = 'PENDING',
    attempts        = 0,
    error_message   = NULL,
    last_attempt_at = NULL,
    updated_at      = NOW()
WHERE order_id = 8
  AND status IN ('FAILED', 'PROCESSING');

-- 2. Roll the order back to PAID so executeFulfillment() enters cleanly.
UPDATE product_orders
SET
    status     = 'PAID',
    updated_at = NOW()
WHERE id = 8
  AND status IN ('FULFILLING', 'FAILED');

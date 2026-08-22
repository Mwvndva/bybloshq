-- Migration: Paystack provider lookup indexes
-- Reason: Paystack rollout keeps the existing M-PESA wallet withdrawal columns
-- and only adds provider-friendly lookup indexes for payment and withdrawal
-- status screens, reconciliation, and callback follow-up.

CREATE INDEX IF NOT EXISTS idx_payments_payment_method_status
    ON payments(payment_method, status);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_method_status
    ON withdrawal_requests((metadata->>'provider'), status);

COMMENT ON INDEX idx_payments_payment_method_status IS
    'Optional provider/status lookup index for multi-provider payment rollout.';

COMMENT ON INDEX idx_withdrawal_requests_method_status IS
    'Optional provider/status lookup index using withdrawal_requests.metadata->>provider; M-PESA wallet columns remain unchanged.';

-- payments.provider_reference has only ever had a plain, non-unique index
-- (20250831120000_add_provider_reference_to_payments.sql) -- unlike
-- withdrawal_requests and payout_provider_attempts, which both got a real
-- DB-level unique constraint for the same purpose in
-- 20260508020000_provider_callback_hardening.sql. The gap already worried
-- whoever wrote CorePaymentService.findPaymentByProviderReference
-- (server/src/domains/payments/payments/CorePaymentService.js): it queries
-- `WHERE provider_reference = $1 OR api_ref = $1 OR invoice_id = $1`, then
-- explicitly checks `rows.length > 1` and throws "Ambiguous provider payment
-- reference" if so -- a reactive, application-level guard for exactly the
-- state this constraint prevents from ever existing in the first place. A
-- Paystack webhook processes payments (and, per CorePaymentService, is the
-- caller of that lookup) by provider_reference; two payment rows sharing one
-- would make webhook resolution genuinely ambiguous, not just theoretically.
--
-- Same safe-migration pattern as 20260508020000: verify no duplicates exist
-- first (this would otherwise silently coexist with dirty data if the
-- constraint were added unconditionally), THEN add the constraint.
DO $$
BEGIN
    IF EXISTS (
        SELECT provider_reference
        FROM payments
        WHERE provider_reference IS NOT NULL
        GROUP BY provider_reference
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate payments.provider_reference values exist; resolve before applying uniqueness constraint';
    END IF;
END $$;

-- Partial (WHERE provider_reference IS NOT NULL) for the same reason as the
-- withdrawal_requests/payout_provider_attempts constraints: provider_reference
-- is NULL until the provider assigns one (set later via
-- `provider_reference = COALESCE($1, provider_reference)`, never at INSERT
-- time), so multiple NULLs must stay legal -- only real, non-null references
-- must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_unique
    ON payments(provider_reference)
    WHERE provider_reference IS NOT NULL;

-- The old plain index is now redundant -- the unique index above serves every
-- lookup it did, plus the constraint. Drop it rather than maintain two
-- indexes over the same column.
DROP INDEX IF EXISTS idx_payments_provider_reference;

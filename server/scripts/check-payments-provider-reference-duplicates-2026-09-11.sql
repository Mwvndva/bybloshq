-- Read-only pre-flight check for 20260911130000_add_payments_provider_reference_unique_constraint.
-- Run against production before that migration deploys.
--
-- If this returns 0 rows, the migration will apply cleanly.
-- If it returns any rows, STOP -- do not let the migration run yet. Each row
-- is a provider_reference shared by more than one payment, which is exactly
-- the ambiguous state CorePaymentService.findPaymentByProviderReference
-- already has a runtime guard for (it throws "Ambiguous provider payment
-- reference" if this ever happens during a webhook lookup). Those payments
-- need to be reviewed and resolved (which one is authoritative?) before the
-- DB-level constraint can be added.
SELECT provider_reference, COUNT(*) AS payment_count, array_agg(id ORDER BY id) AS payment_ids
FROM payments
WHERE provider_reference IS NOT NULL
GROUP BY provider_reference
HAVING COUNT(*) > 1;

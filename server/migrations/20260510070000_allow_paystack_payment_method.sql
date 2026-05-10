-- Migration: allow Paystack as a payment method enum value
-- Reason: Some production databases still use the legacy payment_method enum,
-- while fresh schemas use VARCHAR. Add the enum value only when that type exists.

DO $$
BEGIN
    IF to_regtype('public.payment_method') IS NOT NULL THEN
        ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'paystack';
    END IF;
END $$;


-- Migration: add terms_accepted / terms_accepted_at to creators
-- Reason: buyers and sellers already require terms acceptance at registration
-- (users.terms_accepted was added for both in 20260814195000_unified_runtime_schema.sql,
-- and AuthService.register()/AuthService.login() enforce it), but creators
-- were never given the column at all -- CreatorService.registerDirect() and
-- registerFromInvite() could create an account with no terms acceptance
-- concept whatsoever. Adding the column here so creator registration can
-- record and enforce it the same way, matching buyers/sellers.

ALTER TABLE public.creators
    ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

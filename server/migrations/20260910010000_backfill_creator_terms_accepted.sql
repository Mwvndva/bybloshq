-- Migration: backfill terms_accepted for creators that existed before terms
-- acceptance was introduced for the creator role.
--
-- Reason: 20260910000000_add_terms_accepted_to_creators.sql added the column
-- with DEFAULT FALSE, which -- combined with AuthService.login()'s existing
-- terms-acceptance gate (already enforced for buyers/sellers) -- would
-- otherwise lock every pre-existing creator out of their own account on their
-- next login. There was previously no registration UI for creators to accept
-- terms at all, so these accounts never had a chance to opt in; grandfather
-- them in rather than lock them out for a requirement that didn't exist when
-- they signed up.

UPDATE public.creators
SET terms_accepted = TRUE,
    terms_accepted_at = COALESCE(terms_accepted_at, created_at, NOW())
WHERE terms_accepted = FALSE;

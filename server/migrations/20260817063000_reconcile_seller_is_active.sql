-- Migration: Reconcile sellers.is_active with suspended/deleted user and shop statuses
-- Ensures sellers whose linked user account is inactive, or whose shop status is deleted/suspended, are marked is_active = FALSE.

UPDATE public.sellers s
SET is_active = FALSE
FROM public.users u
WHERE s.user_id = u.id
  AND (u.is_active = FALSE OR s.status IN ('deleted', 'suspended'))
  AND s.is_active = TRUE;

-- 20260124_make_profile_passwords_nullable.sql
-- Relax password constraints on profile tables now that auth is unified

ALTER TABLE buyers ALTER COLUMN password DROP NOT NULL;
ALTER TABLE sellers ALTER COLUMN password DROP NOT NULL;
ALTER TABLE organizers ALTER COLUMN password DROP NOT NULL;

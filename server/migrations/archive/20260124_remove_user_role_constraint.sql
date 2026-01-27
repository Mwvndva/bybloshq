-- 20260124_remove_user_role_constraint.sql
-- Remove the strict role constraint to allow users to act in multiple roles

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- We still want a role column as a 'primary' or 'default' role, 
-- but the specific access is governed by the profile tables.

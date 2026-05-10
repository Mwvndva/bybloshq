-- Migration: allow logistics users
-- Reason: users.role has a legacy hardcoded check constraint that rejects the
-- logistics role even after the role exists in roles.slug.

INSERT INTO roles (name, slug)
VALUES ('Logistics', 'logistics')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        WHERE n.nspname = 'public'
          AND rel.relname = 'users'
          AND c.conname = 'users_role_fkey'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_fkey
            FOREIGN KEY (role)
            REFERENCES roles(slug)
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END
$$;

COMMENT ON COLUMN users.role IS
    'User role slug. Valid roles are governed by roles.slug; legacy hardcoded role checks must not block logistics accounts.';

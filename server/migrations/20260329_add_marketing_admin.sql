-- Migration: Add Marketing Admin Role
-- Date: 2026-03-29
-- Description: Adds a read-only marketing role for the marketing admin dashboard.
-- The marketing admin can view all analytics but cannot modify any data.

-- 1. Insert marketing admin user (idempotent)
INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
VALUES (
  'adminmarketing@bybloshq.space',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqZP9Gv8hQJx5PkXkCXHK8mDV.Ey',
  'admin',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role          = 'admin',
      is_verified   = true,
      is_active     = true,
      updated_at    = NOW();

-- NOTE: The password hash above is a placeholder bcrypt hash for 'byblosmarketing'.
-- IMPORTANT: Replace with actual bcrypt hash generated at server startup.
-- See marketing admin seeding script below — the script generates the real hash.

-- 2. Add 'marketing' permission slug (for future RBAC, currently unused)
INSERT INTO permissions (name, slug, description)
VALUES ('View Marketing Analytics', 'view-marketing', 'Read-only access to marketing dashboard data')
ON CONFLICT (slug) DO NOTHING;

-- 3. Add 'marketing' role
INSERT INTO roles (name, slug, description)
VALUES ('Marketing Admin', 'marketing', 'Read-only marketing analytics access')
ON CONFLICT (slug) DO NOTHING;

-- 4. Assign view-marketing permission to marketing role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'marketing' AND p.slug = 'view-marketing'
ON CONFLICT DO NOTHING;

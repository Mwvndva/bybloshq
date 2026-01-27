-- 20260127_fix_seller_roles.sql
-- Ensure all existing sellers are correctly linked to the 'seller' role in RBAC system

DO $$
DECLARE
    role_seller_id INTEGER := (SELECT id FROM roles WHERE slug = 'seller');
BEGIN
    IF role_seller_id IS NOT NULL THEN
        -- Migrate users that have 'seller' in their role column but no entry in user_roles
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, role_seller_id 
        FROM users u
        WHERE u.role = 'seller'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

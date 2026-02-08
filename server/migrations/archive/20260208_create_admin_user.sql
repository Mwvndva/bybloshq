-- ==============================================
-- Create Admin User Migration
-- ==============================================
-- This migration creates a proper admin user in the database
-- to replace the hardcoded admin bypass logic
--
-- IMPORTANT: You must generate a secure password hash before running this migration
-- Generate hash with: node -e "console.log(require('bcrypt').hashSync('YOUR_SECURE_PASSWORD', 12))"
--
-- Example:
-- node -e "console.log(require('bcrypt').hashSync('Admin@2026!SecurePassword', 12))"
-- Output: $2b$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQR

DO $$
DECLARE
    admin_user_id INTEGER;
    admin_role_id INTEGER;
    -- Password hash for: 14253553805
    -- Generated with: node -e "console.log(require('bcrypt').hashSync('14253553805', 12))"
    hashed_password TEXT := '$2b$12$ohCGGI4Os2vVagYuaU4fRucG7S9G1Z3vrXZXBV0BGGkT9qxh6IDhu';
BEGIN
    -- ==============================================
    -- 1. Create Admin User
    -- ==============================================
    INSERT INTO users (
        email, 
        password_hash, 
        role, 
        is_verified, 
        created_at,
        updated_at
    )
    VALUES (
        'admin@bybloshq.space', 
        hashed_password, 
        'admin', 
        true, 
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE 
    SET 
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        is_verified = true,
        updated_at = NOW()
    RETURNING id INTO admin_user_id;
    
    -- Get admin user ID if already exists
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id 
        FROM users 
        WHERE email = 'admin@bybloshq.space';
    END IF;
    
    RAISE NOTICE 'Admin user created/updated with ID: %', admin_user_id;
    
    -- ==============================================
    -- 2. Create Admin Role (if using RBAC)
    -- ==============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
        INSERT INTO roles (
            name, 
            slug, 
            description,
            created_at
        )
        VALUES (
            'Administrator', 
            'admin', 
            'Full system access with all permissions',
            NOW()
        )
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO admin_role_id;
        
        -- Get role ID if already exists
        IF admin_role_id IS NULL THEN
            SELECT id INTO admin_role_id 
            FROM roles 
            WHERE slug = 'admin';
        END IF;
        
        RAISE NOTICE 'Admin role created/found with ID: %', admin_role_id;
        
        -- ==============================================
        -- 3. Assign Admin Role to User
        -- ==============================================
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (admin_user_id, admin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
            
            RAISE NOTICE 'Admin role assigned to user';
        END IF;
        
        -- ==============================================
        -- 4. Grant All Permissions to Admin Role
        -- ==============================================
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') 
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT admin_role_id, id
            FROM permissions
            ON CONFLICT (role_id, permission_id) DO NOTHING;
            
            RAISE NOTICE 'All permissions granted to admin role';
        END IF;
    ELSE
        RAISE NOTICE 'RBAC tables not found - skipping role assignment';
    END IF;
    
    -- ==============================================
    -- 5. Log the Migration
    -- ==============================================
    RAISE NOTICE '✅ Admin user migration completed successfully';
    RAISE NOTICE 'Email: admin@bybloshq.space';
    RAISE NOTICE 'Password: 14253553805';
    RAISE NOTICE 'User ID: %', admin_user_id;
    
END $$;

-- ==============================================
-- Verification Queries
-- ==============================================
-- Run these to verify the migration succeeded

-- Check admin user exists
SELECT id, email, role, is_verified, created_at 
FROM users 
WHERE email = 'admin@bybloshq.space';

-- Check admin role exists
SELECT id, name, slug, description 
FROM roles 
WHERE slug = 'admin';

-- Check role assignment
SELECT ur.*, u.email, r.name as role_name
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@bybloshq.space';

-- Check permissions count
SELECT r.name, COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.slug = 'admin'
GROUP BY r.name;

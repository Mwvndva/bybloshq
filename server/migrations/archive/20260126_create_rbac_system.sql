-- 20260126_create_rbac_system.sql
-- Create RBAC system: roles, permissions, and many-to-many relationships

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 5. Insert default permissions
INSERT INTO permissions (name, slug) VALUES 
('Manage Products', 'manage-products'),
('Request Payouts', 'request-payouts'),
('Manage Shop', 'manage-shop'),
('Create Events', 'create-events'),
('Verify Tickets', 'verify-tickets'),
('View Analytics', 'view-analytics'),
('View Orders', 'view-orders'),
('Manage Profile', 'manage-profile'),
('Super Admin Access', 'manage-all')
ON CONFLICT (slug) DO NOTHING;

-- 6. Insert default roles
INSERT INTO roles (name, slug) VALUES 
('Buyer', 'buyer'),
('Seller', 'seller'),
('Organizer', 'organizer'),
('Admin', 'admin')
ON CONFLICT (slug) DO NOTHING;

-- 7. Link permissions to roles
DO $$
DECLARE
    role_buyer_id INTEGER := (SELECT id FROM roles WHERE slug = 'buyer');
    role_seller_id INTEGER := (SELECT id FROM roles WHERE slug = 'seller');
    role_organizer_id INTEGER := (SELECT id FROM roles WHERE slug = 'organizer');
    role_admin_id INTEGER := (SELECT id FROM roles WHERE slug = 'admin');
BEGIN
    -- Buyer permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_buyer_id, id FROM permissions WHERE slug IN ('view-orders', 'manage-profile')
    ON CONFLICT DO NOTHING;

    -- Seller permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_seller_id, id FROM permissions WHERE slug IN ('manage-products', 'request-payouts', 'manage-shop', 'view-orders', 'manage-profile')
    ON CONFLICT DO NOTHING;

    -- Organizer permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_organizer_id, id FROM permissions WHERE slug IN ('create-events', 'verify-tickets', 'view-analytics', 'manage-profile')
    ON CONFLICT DO NOTHING;

    -- Admin permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_admin_id, id FROM permissions WHERE slug = 'manage-all'
    ON CONFLICT DO NOTHING;
END $$;

-- 8. Migrate existing users to user_roles based on their current role column
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM users u
JOIN roles r ON u.role = r.slug
ON CONFLICT DO NOTHING;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

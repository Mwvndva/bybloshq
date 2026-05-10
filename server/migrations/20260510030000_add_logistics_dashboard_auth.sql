-- Migration: logistics dashboard authentication role
-- Reason: Mzigo Ego needs a protected dashboard without payment, escrow, or payout privileges.

INSERT INTO roles (name, slug)
VALUES ('Logistics', 'logistics')
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name;

CREATE INDEX IF NOT EXISTS idx_users_logistics_email
    ON users (LOWER(email))
    WHERE role = 'logistics';

COMMENT ON TABLE logistics_partners IS
    'Logistics partner profiles. Credentials attach through users.user_id with users.role = logistics.';

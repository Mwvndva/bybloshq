export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
    UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;

    CREATE TABLE IF NOT EXISTS pending_registrations (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50),
        registration_data JSONB,
        physical_address TEXT,
        latitude NUMERIC(10, 8),
        longitude NUMERIC(11, 8),
        verification_token VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        terms_accepted BOOLEAN DEFAULT FALSE,
        terms_accepted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS is_active;
    ALTER TABLE users DROP COLUMN IF EXISTS is_verified;
  `);
};

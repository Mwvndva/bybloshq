/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
    UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS is_active;
    ALTER TABLE users DROP COLUMN IF EXISTS is_verified;
  `);
};

/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    // Fix case-sensitive enum values for order_status
    // Add missing uppercase variants if not present
    // Note: ALTER TYPE ADD VALUE cannot run inside a transaction.
    // node-pg-migrate handles this if we set transaction: false in the migration options,
    // but we can also just run it as raw SQL.

    pgm.sql(`
    DO $$ 
    BEGIN
      -- These must match EXACTLY what the OrderStatus constants in enums.js define
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RESERVED';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PROCESSING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SERVICE_PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COLLECTION_PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CLIENT_PAYMENT_PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DEBT_PENDING';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_COMPLETE';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPLETED';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELLED';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FAILED';
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED';
    EXCEPTION WHEN duplicate_object THEN 
      NULL;
    END $$;
  `);
};

exports.down = pgm => {
    // Enums cannot be easily rolled back without dropping them
};

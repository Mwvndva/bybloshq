export const up = (pgm) => {
  // Fix case-sensitive enum values for order_status
  // Add missing uppercase variants if not present

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

export const down = (pgm) => {
  // Enums cannot be easily rolled back without dropping them
};

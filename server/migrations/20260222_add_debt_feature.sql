-- ============================================================
-- Migration: Debt Feature
-- Date: 2026-02-22
-- Description: Adds DEBT_PENDING order status, is_debt column,
--              debt payment method, pending_debt payment status,
--              and client_debts table.
-- ============================================================

DO $$
BEGIN
  -- Add DEBT_PENDING to order_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
      AND enumlabel = 'DEBT_PENDING'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'DEBT_PENDING';
  END IF;
END $$;

-- Add is_debt column to product_orders if not exists
ALTER TABLE product_orders
  ADD COLUMN IF NOT EXISTS is_debt BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  -- Add 'debt' to payment_method enum if exists and value not present
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
        AND enumlabel = 'debt'
    ) THEN
      ALTER TYPE payment_method ADD VALUE 'debt';
    END IF;
  END IF;

  -- Add 'pending_debt' to payment_status enum if exists and value not present
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
        AND enumlabel = 'pending_debt'
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'pending_debt';
    END IF;
  END IF;
END $$;

-- Create client_debts table if not exists
CREATE TABLE IF NOT EXISTS client_debts (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES sellers(id),
  client_id INTEGER REFERENCES clients(id),
  product_id INTEGER REFERENCES products(id),
  amount DECIMAL(10, 2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

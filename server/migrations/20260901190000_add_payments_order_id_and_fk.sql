-- Migration: add payments order_id column, backfill from metadata/invoice_id, and establish foreign key
-- Reason: Direct relational link from payments to product_orders with ON DELETE RESTRICT

DO $$
BEGIN
    -- 1. Add order_id column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'order_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN order_id INTEGER;
    END IF;
END $$;

-- 2. Backfill existing payments from metadata->>'order_id'
UPDATE payments p
SET order_id = (p.metadata->>'order_id')::integer
WHERE p.order_id IS NULL
  AND p.metadata->>'order_id' IS NOT NULL
  AND p.metadata->>'order_id' ~ '^[0-9]+$'
  AND EXISTS (
      SELECT 1 FROM product_orders po WHERE po.id = (p.metadata->>'order_id')::integer
  );

-- 3. Backfill existing payments from invoice_id matching product_orders.order_number or id
UPDATE payments p
SET order_id = po.id
FROM product_orders po
WHERE p.order_id IS NULL
  AND (
      p.invoice_id = po.order_number
      OR p.invoice_id = po.id::text
      OR p.invoice_id = 'INV-' || po.order_number
  );

-- 4. Create foreign key constraint with ON DELETE RESTRICT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'payments_order_id_fkey' AND table_name = 'payments'
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT payments_order_id_fkey
        FOREIGN KEY (order_id)
        REFERENCES product_orders(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 5. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

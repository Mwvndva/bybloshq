-- Migration: Add manual_review status and order_id to refund_requests table
-- Reason: Surface compensation_required and manual_review orders in Admin Dashboard

-- 1. Add order_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'refund_requests'
          AND column_name = 'order_id'
    ) THEN
        ALTER TABLE refund_requests
            ADD COLUMN order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON refund_requests(order_id);
    END IF;
END $$;

-- 2. Expand status constraint to include manual_review
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE refund_requests ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'manual_review'));

-- 3. Backfill any existing COMPENSATION_REQUIRED / MANUAL_REVIEW orders into refund_requests
INSERT INTO refund_requests (buyer_id, order_id, amount, status, notes, payment_method, payment_details, created_at, requested_at)
SELECT
    po.buyer_id,
    po.id AS order_id,
    po.total_amount AS amount,
    'manual_review' AS status,
    'Late payment / compensation required on order #' || COALESCE(po.order_number, po.id::text) AS notes,
    po.payment_method,
    json_build_object('order_id', po.id, 'order_number', po.order_number, 'source', 'backfill_compensation_required')::jsonb AS payment_details,
    po.created_at,
    po.updated_at
FROM product_orders po
WHERE po.status IN ('COMPENSATION_REQUIRED', 'MANUAL_REVIEW')
  AND po.buyer_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM refund_requests rr WHERE rr.order_id = po.id
  );

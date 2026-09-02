-- Migration: Reconcile seller wallet balances with settled payouts and completed orders
-- Reason: Ensure seller balances (balance, pending_settlement_balance, net_revenue, total_sales)
-- are accurately backfilled and synced from payouts and order items.

UPDATE sellers s
SET balance = GREATEST(
      s.balance,
      COALESCE((
        SELECT SUM(p.amount)
        FROM payouts p
        WHERE p.seller_id = s.id AND p.settlement_status = 'settled'
      ), 0) - COALESCE((
        SELECT SUM(w.amount + COALESCE((w.metadata->>'withdrawal_fee')::numeric, 0))
        FROM withdrawal_requests w
        WHERE w.seller_id = s.id AND w.status = 'completed'
      ), 0)
    ),
    pending_settlement_balance = GREATEST(
      s.pending_settlement_balance,
      COALESCE((
        SELECT SUM(p.amount)
        FROM payouts p
        WHERE p.seller_id = s.id AND p.settlement_status = 'pending_settlement'
      ), 0)
    ),
    net_revenue = GREATEST(
      s.net_revenue,
      COALESCE((
        SELECT SUM(o.seller_payout_amount)
        FROM product_orders o
        WHERE o.seller_id = s.id AND o.payment_status = 'completed' AND o.status NOT IN ('CANCELLED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED')
      ), 0)
    ),
    total_sales = GREATEST(
      s.total_sales,
      COALESCE((
        SELECT SUM(
          COALESCE(
            (SELECT SUM(COALESCE(oi.subtotal, oi.product_price * oi.quantity, oi.price * oi.quantity)) FROM order_items oi WHERE oi.order_id = o.id),
            (o.metadata->'pricing'->>'product_subtotal')::numeric,
            o.total_amount
          )
        )
        FROM product_orders o
        WHERE o.seller_id = s.id AND o.payment_status = 'completed' AND o.status NOT IN ('CANCELLED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED')
      ), 0)
    ),
    updated_at = NOW();

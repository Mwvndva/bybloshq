-- Migration: reconcile financial metrics
-- Reason: Keep platform revenue, seller revenue, and withdrawable balances aligned with paid orders and escrow releases.

WITH computed AS (
    SELECT
        id,
        GREATEST(
            COALESCE(total_amount, 0)
            - COALESCE(seller_payout_amount, 0)
            - COALESCE(NULLIF(metadata #>> '{pricing,buyer_delivery_fee}', '')::numeric, 0),
            0
        )::numeric(15, 2) AS platform_retained_amount
    FROM product_orders
    WHERE metadata #>> '{pricing,payable_total}' IS NOT NULL
      AND total_amount IS NOT NULL
      AND seller_payout_amount IS NOT NULL
)
UPDATE product_orders po
SET platform_fee_amount = computed.platform_retained_amount,
    metadata = jsonb_set(
        jsonb_set(
            COALESCE(po.metadata, '{}'::jsonb),
            '{pricing,platform_retained_amount}',
            to_jsonb(computed.platform_retained_amount),
            true
        ),
        '{pricing,platform_retained_excludes_delivery_fee}',
        'true'::jsonb,
        true
    ),
    updated_at = NOW()
FROM computed
WHERE po.id = computed.id
  AND ABS(COALESCE(po.platform_fee_amount, 0) - computed.platform_retained_amount) > 0.009;

WITH eligible_orders AS (
    SELECT
        o.id,
        o.seller_id,
        o.order_number,
        o.total_amount,
        o.seller_payout_amount,
        CASE
            WHEN o.metadata #>> '{pricing,payable_total}' IS NOT NULL THEN GREATEST(
                COALESCE(o.total_amount, 0)
                - COALESCE(o.seller_payout_amount, 0)
                - COALESCE(NULLIF(o.metadata #>> '{pricing,buyer_delivery_fee}', '')::numeric, 0),
                0
            )::numeric(15, 2)
            ELSE COALESCE(
                o.platform_fee_amount,
                GREATEST(COALESCE(o.total_amount, 0) - COALESCE(o.seller_payout_amount, 0), 0)
            )::numeric(15, 2)
        END AS platform_retained_amount,
        (
            SELECT p.id
            FROM payments p
            WHERE p.invoice_id = o.order_number
               OR p.metadata->>'order_id' = o.id::text
            ORDER BY p.created_at DESC
            LIMIT 1
        ) AS payment_id
    FROM product_orders o
    WHERE o.payment_status = 'completed'
      AND o.status = 'COMPLETED'
      AND COALESCE(o.seller_payout_amount, 0) > 0
      AND COALESCE(o.total_amount, 0) > 0
      AND NOT EXISTS (
          SELECT 1
          FROM payouts p
          WHERE p.order_id = o.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM logistics_requests lr
          LEFT JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
          WHERE lr.order_id = o.id
            AND lr.status <> 'cancelled'
            AND (
                lr.status IN ('manual_review', 'failed')
                OR ll.status = 'failed'
            )
      )
),
inserted_payouts AS (
    INSERT INTO payouts
        (seller_id, order_id, payment_id, amount, platform_fee, status,
         payment_method, processed_at, completed_at, metadata)
    SELECT
        seller_id,
        id,
        payment_id,
        seller_payout_amount,
        platform_retained_amount,
        'completed',
        'wallet_credit',
        NOW(),
        NOW(),
        '{"processed_by":"20260513090000_reconcile_financial_metrics"}'::jsonb
    FROM eligible_orders
    ON CONFLICT (order_id) DO NOTHING
    RETURNING seller_id, order_id, amount
),
seller_totals AS (
    SELECT
        inserted_payouts.seller_id,
        SUM(inserted_payouts.amount) AS payout_total,
        SUM(eligible_orders.total_amount) AS sales_total
    FROM inserted_payouts
    JOIN eligible_orders ON eligible_orders.id = inserted_payouts.order_id
    GROUP BY inserted_payouts.seller_id
)
UPDATE sellers s
SET balance = COALESCE(s.balance, 0) + seller_totals.payout_total,
    net_revenue = COALESCE(s.net_revenue, 0) + seller_totals.payout_total,
    total_sales = COALESCE(s.total_sales, 0) + seller_totals.sales_total,
    updated_at = NOW()
FROM seller_totals
WHERE s.id = seller_totals.seller_id;

UPDATE product_orders po
SET metadata = jsonb_set(COALESCE(po.metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb, true),
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1
    FROM payouts p
    WHERE p.order_id = po.id
      AND p.metadata->>'processed_by' = '20260513090000_reconcile_financial_metrics'
);

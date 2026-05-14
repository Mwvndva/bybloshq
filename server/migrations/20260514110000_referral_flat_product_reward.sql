-- Migration: referral flat product reward
-- Reason: Track referred product units and cap referral rewards to 3 months from first paid sale.

ALTER TABLE referral_earnings_log
    ADD COLUMN IF NOT EXISTS referred_units_sold INTEGER NOT NULL DEFAULT 0;

WITH first_referred_sales AS (
    SELECT
        seller_id,
        MIN(COALESCE(paid_at, created_at)) AS first_paid_at
    FROM product_orders
    WHERE payment_status = 'completed'
      AND seller_id IS NOT NULL
    GROUP BY seller_id
)
UPDATE sellers s
SET referral_active_until = first_referred_sales.first_paid_at + INTERVAL '3 months'
FROM first_referred_sales
WHERE s.id = first_referred_sales.seller_id
  AND s.referred_by_seller_id IS NOT NULL
  AND s.referral_active_until IS NOT NULL
  AND s.referral_active_until > first_referred_sales.first_paid_at + INTERVAL '3 months';

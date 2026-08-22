-- Migration: harden seller financial metrics
-- Reason: Keep seller wallet, revenue, and creator-generated sales totals reliable after escrow release.

ALTER TABLE sellers
    ALTER COLUMN total_sales TYPE NUMERIC(15, 2) USING COALESCE(total_sales, 0)::numeric(15, 2);

UPDATE sellers
SET balance = COALESCE(balance, 0),
    net_revenue = COALESCE(net_revenue, 0),
    total_sales = COALESCE(total_sales, 0);

ALTER TABLE sellers
    ALTER COLUMN balance SET DEFAULT 0,
    ALTER COLUMN net_revenue SET DEFAULT 0,
    ALTER COLUMN total_sales SET DEFAULT 0,
    ALTER COLUMN balance SET NOT NULL,
    ALTER COLUMN net_revenue SET NOT NULL,
    ALTER COLUMN total_sales SET NOT NULL;

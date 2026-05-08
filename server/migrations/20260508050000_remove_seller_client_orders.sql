-- Remove the deprecated seller-created client order/debt storage.
-- Buyer follow relationships are tracked by seller_clients and sellers.client_count.

DROP TABLE IF EXISTS client_debts;

ALTER TABLE product_orders
    DROP COLUMN IF EXISTS is_debt,
    DROP COLUMN IF EXISTS client_id,
    DROP COLUMN IF EXISTS is_seller_initiated;

DROP TABLE IF EXISTS clients;

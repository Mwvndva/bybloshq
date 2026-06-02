-- Custom physical product production SLA
-- Adds seller-owned production timing before the existing logistics handoff flow.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_custom_product BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS production_days INTEGER,
    ADD COLUMN IF NOT EXISTS customization_prompt TEXT;

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_custom_production_days_check;

ALTER TABLE products
    ADD CONSTRAINT products_custom_production_days_check CHECK (
        (
            is_custom_product = FALSE
            AND production_days IS NULL
            AND customization_prompt IS NULL
        )
        OR (
            product_type = 'physical'
            AND is_custom_product = TRUE
            AND production_days BETWEEN 1 AND 5
        )
    );

ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS custom_production_deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS custom_production_grace_deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS custom_production_reminder_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_product_orders_custom_production_reminder
    ON product_orders(custom_production_deadline_at)
    WHERE custom_production_deadline_at IS NOT NULL
      AND custom_production_reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_orders_custom_production_grace
    ON product_orders(custom_production_grace_deadline_at)
    WHERE custom_production_grace_deadline_at IS NOT NULL
      AND auto_cancelled_reason IS NULL;

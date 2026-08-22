-- Imported / pre-order physical products use the same pre-handoff deadline
-- columns as custom products, but do not require buyer customization text.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_imported_product BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS import_days INTEGER,
  ADD COLUMN IF NOT EXISTS import_note TEXT;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_import_days_check,
  ADD CONSTRAINT products_import_days_check
    CHECK (
      is_imported_product = FALSE
      OR (
        product_type = 'physical'
        AND import_days IN (7, 14, 21, 30)
      )
    );

CREATE INDEX IF NOT EXISTS idx_products_imported_physical
  ON products (seller_id, is_imported_product, import_days)
  WHERE is_imported_product = TRUE;

-- Migration: Add updated_at column to order_items and ensure trigger consistency
-- Reason: When a product is deleted, the foreign key action 'ON DELETE SET NULL' updates order_items.
--         The trigger update_order_items_updated_at attempts to set NEW.updated_at = NOW(),
--         which failed with error 42703 (record 'new' has no field 'updated_at').

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_items'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE order_items
            ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Ensure trigger exists and uses update_updated_at_column function
DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

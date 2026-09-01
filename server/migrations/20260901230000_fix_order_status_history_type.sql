-- Migration: Fix order_status_history.status column type and trigger function
-- Reason: Eliminate type mismatch error between product_orders.status (VARCHAR) and order_status_history.status (order_status ENUM)

-- 1. Alter order_status_history.status column type to VARCHAR(50)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE order_status_history
            ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
    END IF;
END $$;

-- 2. Update trigger function to accept VARCHAR cleanly
CREATE OR REPLACE FUNCTION update_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a new record into order_status_history when status changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_by_type
        )
        VALUES (
            NEW.id,
            NEW.status::text,
            'Status changed from ' || COALESCE(OLD.status::TEXT, 'NULL') || ' to ' || NEW.status::TEXT,
            CASE
                WHEN TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'product_orders' AND TG_WHEN = 'AFTER'
                THEN current_setting('app.current_user_id', true)::INTEGER
                ELSE NULL
            END,
            CASE
                WHEN TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'product_orders' AND TG_WHEN = 'AFTER'
                THEN current_setting('app.current_user_type', true)
                ELSE 'system'
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

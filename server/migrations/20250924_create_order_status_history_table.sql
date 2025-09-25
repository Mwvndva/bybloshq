-- Create order_status_history table to track order status changes
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    status_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    source VARCHAR(50) DEFAULT 'SYSTEM',
    metadata JSONB
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_status ON order_status_history(status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);

-- Add comments for documentation
COMMENT ON TABLE order_status_history IS 'Tracks the history of status changes for orders';
COMMENT ON COLUMN order_status_history.order_id IS 'Reference to the orders table';
COMMENT ON COLUMN order_status_history.status IS 'The status that was set';
COMMENT ON COLUMN order_status_history.status_message IS 'Additional message or details about the status change';
COMMENT ON COLUMN order_status_history.created_at IS 'When the status change occurred';
COMMENT ON COLUMN order_status_history.updated_by IS 'Who or what initiated the status change';
COMMENT ON COLUMN order_status_history.source IS 'Source of the status update (e.g., SYSTEM, ADMIN, PESAPAL, USER)';
COMMENT ON COLUMN order_status_history.metadata IS 'Additional context or data related to the status change';

-- Create a function to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status has changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
        INSERT INTO order_status_history (
            order_id,
            status,
            status_message,
            updated_by,
            source,
            metadata
        ) VALUES (
            COALESCE(NEW.id, OLD.id),
            NEW.status,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Order created with initial status: ' || NEW.status
                ELSE 'Status changed from ' || COALESCE(OLD.status, 'NULL') || ' to ' || NEW.status
            END,
            current_user,
            'SYSTEM',
            jsonb_build_object(
                'operation', TG_OP,
                'previous_status', OLD.status,
                'new_status', NEW.status,
                'order_id', COALESCE(NEW.id, OLD.id)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically log status changes
CREATE TRIGGER trigger_log_order_status_change
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();

-- Add a comment about the trigger
COMMENT ON TRIGGER trigger_log_order_status_change ON orders 
IS 'Automatically logs status changes to order_status_history when an order status is updated';

-- Insert initial status history for existing orders (if any)
DO $$
BEGIN
    -- Only run if the orders table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Only insert if there are orders without history
        IF EXISTS (SELECT 1 FROM orders o 
                  WHERE NOT EXISTS (
                      SELECT 1 FROM order_status_history oh 
                      WHERE oh.order_id = o.id
                  )
                  LIMIT 1) THEN
            
            INSERT INTO order_status_history (
                order_id,
                status,
                status_message,
                updated_by,
                source,
                created_at,
                metadata
            )
            SELECT 
                id,
                status,
                'Initial status: ' || status,
                'system',
                'MIGRATION',
                COALESCE(created_at, NOW()),
                jsonb_build_object(
                    'migration', '20250924_create_order_status_history_table',
                    'initial_status', true
                )
            FROM orders
            WHERE NOT EXISTS (
                SELECT 1 FROM order_status_history oh 
                WHERE oh.order_id = orders.id
            );
            
            RAISE NOTICE 'Inserted initial status history for % orders', (SELECT COUNT(*) FROM orders);
        END IF;
    END IF;
END $$;

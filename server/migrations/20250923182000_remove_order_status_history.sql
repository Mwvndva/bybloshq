-- This migration is now idempotent and handles cases where tables might not exist

-- Drop the order_status_history table if it exists
DROP TABLE IF EXISTS order_status_history;

-- Only proceed with orders table modifications if the table exists
DO $$
BEGIN
    -- Check if orders table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Add status_updated_at column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name = 'status_updated_at'
        ) THEN
            ALTER TABLE orders 
            ADD COLUMN status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            
            COMMENT ON COLUMN orders.status_updated_at IS 'Timestamp when the status was last updated';
        END IF;

        -- Add status_updated_by column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name = 'status_updated_by'
        ) THEN
            ALTER TABLE orders 
            ADD COLUMN status_updated_by VARCHAR(255);
            
            COMMENT ON COLUMN orders.status_updated_by IS 'ID or name of the user who last updated the status';
        END IF;

        -- Create index if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'idx_orders_status_updated_at' AND tablename = 'orders'
        ) THEN
            CREATE INDEX idx_orders_status_updated_at ON orders(status_updated_at);
        END IF;
    END IF;
END $$;

-- Create the order_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_audit_log (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_order_id' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_order_id ON order_audit_log(order_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_action' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_action ON order_audit_log(action);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_created_at' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_created_at ON order_audit_log(created_at);
    END IF;
END $$;

-- Add comments if they don't exist
DO $$
BEGIN
    -- Only add comments if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_audit_log') THEN
        -- Table comment
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_description 
            WHERE objsubid = 0 AND objoid = 'order_audit_log'::regclass
        ) THEN
            COMMENT ON TABLE order_audit_log IS 'Tracks important events and changes for orders';
        END IF;
        
        -- Column comments (only if the column exists)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'id') THEN
            COMMENT ON COLUMN order_audit_log.id IS 'Primary key';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'order_id') THEN
            COMMENT ON COLUMN order_audit_log.order_id IS 'Reference to the orders table';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'action') THEN
            COMMENT ON COLUMN order_audit_log.action IS 'The action that was performed (e.g., status_update, payment_received, etc.)';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'details') THEN
            COMMENT ON COLUMN order_audit_log.details IS 'JSON containing additional details about the action';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'performed_by') THEN
            COMMENT ON COLUMN order_audit_log.performed_by IS 'ID or name of the user who performed the action';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'created_at') THEN
            COMMENT ON COLUMN order_audit_log.created_at IS 'Timestamp when the audit log entry was created';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_audit_log' AND column_name = 'updated_at') THEN
            COMMENT ON COLUMN order_audit_log.updated_at IS 'Timestamp when the audit log entry was last updated';
        END IF;
    END IF;
END $$;

-- Create or replace the update_status_timestamp function
CREATE OR REPLACE FUNCTION update_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the orders table has the required columns
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'orders' AND 
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status_updated_at') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status_updated_by') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'id')
    THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.status_updated_at = CURRENT_TIMESTAMP;
            
            -- Only try to log if the order_audit_log table exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_audit_log') THEN
                INSERT INTO order_audit_log 
                (order_id, action, details, performed_by)
                VALUES (
                    NEW.id,
                    'status_update',
                    jsonb_build_object(
                        'from', COALESCE(OLD.status::text, 'NULL'),
                        'to', COALESCE(NEW.status::text, 'NULL'),
                        'notes', 'Status updated'
                    ),
                    NEW.status_updated_by
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if the orders table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Drop the trigger if it exists
        DROP TRIGGER IF EXISTS update_orders_status_timestamp ON orders;
        
        -- Create the trigger
        EXECUTE '
        CREATE TRIGGER update_orders_status_timestamp
        BEFORE UPDATE OF status ON orders
        FOR EACH ROW
        EXECUTE FUNCTION update_status_timestamp();';
    END IF;
END $$;

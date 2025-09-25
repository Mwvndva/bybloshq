-- Create order_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_audit_log (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments if they don't exist
DO $$
BEGIN
    -- Table comment
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_description 
        WHERE objsubid = 0 AND objoid = 'order_audit_log'::regclass
    ) THEN
        COMMENT ON TABLE order_audit_log IS 'Tracks important events and changes for orders';
    END IF;

    -- Column comments
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_description 
        WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'action' AND attrelid = 'order_audit_log'::regclass)
    ) THEN
        COMMENT ON COLUMN order_audit_log.action IS 'The action that was performed (e.g., status_update, payment_received)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_description 
        WHERE objsubid = (SELECT attnum FROM pg_attribute WHERE attname = 'details' AND attrelid = 'order_audit_log'::regclass)
    ) THEN
        COMMENT ON COLUMN order_audit_log.details IS 'JSON containing additional details about the action';
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
    -- Index for order_id
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_order_id' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_order_id ON order_audit_log(order_id);
    END IF;

    -- Index for action
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_action' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_action ON order_audit_log(action);
    END IF;

    -- Index for created_at
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_order_audit_log_created_at' AND tablename = 'order_audit_log'
    ) THEN
        CREATE INDEX idx_order_audit_log_created_at ON order_audit_log(created_at);
    END IF;
END $$;
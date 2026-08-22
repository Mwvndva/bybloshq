-- Add missing columns to order_status_history table if they don't exist
DO $$
BEGIN
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE order_status_history 
        ADD COLUMN created_by INTEGER;
        
        COMMENT ON COLUMN order_status_history.created_by IS 'References buyer_id or seller_id depending on who made the change';
        RAISE NOTICE 'Added created_by column to order_status_history table';
    ELSE
        RAISE NOTICE 'created_by column already exists in order_status_history table';
    END IF;
    
    -- Add notes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE order_status_history 
        ADD COLUMN notes TEXT;
        
        COMMENT ON COLUMN order_status_history.notes IS 'Additional notes about the status change';
        RAISE NOTICE 'Added notes column to order_status_history table';
    ELSE
        RAISE NOTICE 'notes column already exists in order_status_history table';
    END IF;
    
    -- Add created_by_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history' 
        AND column_name = 'created_by_type'
    ) THEN
        ALTER TABLE order_status_history 
        ADD COLUMN created_by_type VARCHAR(20);
        
        COMMENT ON COLUMN order_status_history.created_by_type IS 'Type of user who made the change (buyer, seller, admin, system)';
        RAISE NOTICE 'Added created_by_type column to order_status_history table';
    ELSE
        RAISE NOTICE 'created_by_type column already exists in order_status_history table';
    END IF;
END $$;

-- Update the update_order_status_history function to handle the created_by column
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
            NEW.status, 
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

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle status changes
-- Update the handle_order_status_change function in 20250923190003_create_order_triggers.sql
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update status timestamp if status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.status_updated_at = CURRENT_TIMESTAMP;
        
        -- Log the status change
        INSERT INTO order_audit_log (
            order_id, 
            action, 
            details,
            performed_by
        ) VALUES (
            NEW.id,
            'status_update',
            jsonb_build_object(
                'from', COALESCE(OLD.status::text, 'null'),
                'to', NEW.status::text,
                'notes', 'Order status updated'
            ),
            CASE 
                WHEN NEW.status_updated_by IS NOT NULL THEN NEW.status_updated_by 
                ELSE 'system' 
            END
        );
    END IF;
    
    -- Log payment status changes
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        INSERT INTO order_audit_log (
            order_id, 
            action, 
            details
        ) VALUES (
            NEW.id,
            'payment_status_update',
            jsonb_build_object(
                'from', COALESCE(OLD.payment_status::text, 'null'),
                'to', NEW.payment_status::text,
                'payment_method', COALESCE(NEW.payment_method, 'unknown'),
                'payment_reference', COALESCE(NEW.order_tracking_id, 'none')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER handle_order_updates
BEFORE UPDATE ON orders
FOR EACH ROW
WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.payment_status IS DISTINCT FROM NEW.payment_status
)
EXECUTE FUNCTION handle_order_status_change();
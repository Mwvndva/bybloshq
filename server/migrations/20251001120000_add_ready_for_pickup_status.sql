-- First, create a new enum type with READY_FOR_PICKUP added
DO $$
BEGIN
    -- Create a new enum type with all the values including READY_FOR_PICKUP
    CREATE TYPE order_status_new AS ENUM (
        'PENDING',
        'READY_FOR_PICKUP',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED',
        'FAILED'
    );
    
    -- Update the column to use the new type
    ALTER TABLE product_orders 
        ALTER COLUMN status TYPE order_status_new 
        USING (CASE status::text
            WHEN 'pending' THEN 'PENDING'::order_status_new
            WHEN 'ready_for_pickup' THEN 'READY_FOR_PICKUP'::order_status_new
            WHEN 'processing' THEN 'PROCESSING'::order_status_new
            WHEN 'completed' THEN 'COMPLETED'::order_status_new
            WHEN 'cancelled' THEN 'CANCELLED'::order_status_new
            WHEN 'failed' THEN 'FAILED'::order_status_new
            ELSE 'PENDING'::order_status_new
        END);
    
    -- Drop the old type
    DROP TYPE order_status;
    
    -- Rename the new type to the original name
    ALTER TYPE order_status_new RENAME TO order_status;
    
    -- Update any existing rows that might be in lowercase
    UPDATE product_orders 
    SET status = UPPER(status::text)::order_status
    WHERE status::text != UPPER(status::text);
    
    -- Update the application's validTransitions in order.controller.js
    -- to use the uppercase status values
    RAISE NOTICE 'Successfully updated order_status enum to include READY_FOR_PICKUP';
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating order_status enum: %', SQLERRM;
END $$;

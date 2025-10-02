-- First, create a new enum type with READY_FOR_PICKUP added
DO $$
DECLARE
    trigger_record RECORD;
    trigger_sql TEXT;
BEGIN
    -- First, drop any triggers that reference the status column
    FOR trigger_record IN 
        SELECT tgname, tgisinternal 
        FROM pg_trigger 
        WHERE tgrelid = 'product_orders'::regclass
    LOOP
        -- Only drop non-internal triggers
        IF NOT trigger_record.tgisinternal THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON product_orders', 
                          trigger_record.tgname);
        END IF;
    END LOOP;

    -- Drop the default constraint if it exists
    ALTER TABLE product_orders 
        ALTER COLUMN status DROP DEFAULT;

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
    
    -- Set the default value explicitly
    ALTER TABLE product_orders 
        ALTER COLUMN status SET DEFAULT 'PENDING'::order_status_new;
    
    -- Drop the old type
    DROP TYPE order_status;
    
    -- Rename the new type to the original name
    ALTER TYPE order_status_new RENAME TO order_status;
    
    -- Update any existing rows that might be in lowercase
    UPDATE product_orders 
    SET status = UPPER(status::text)::order_status
    WHERE status::text != UPPER(status::text);
    
    -- Note: The triggers will need to be recreated manually if they're essential
    -- as we don't have the original trigger definitions in this migration
    
    RAISE NOTICE 'Successfully updated order_status enum to include READY_FOR_PICKUP';
    RAISE NOTICE 'IMPORTANT: Any triggers on product_orders were dropped and need to be recreated';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating order_status enum: %', SQLERRM;
END $$;
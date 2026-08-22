-- Add READY_FOR_PICKUP status to order_status enum
-- This migration handles ALL tables that use the order_status enum
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Check if READY_FOR_PICKUP already exists in the enum
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'order_status'::regtype 
        AND enumlabel = 'READY_FOR_PICKUP'
    ) THEN
        RAISE NOTICE 'READY_FOR_PICKUP already exists in order_status enum, skipping migration';
        RETURN;
    END IF;

    -- First, drop any triggers that reference the status column on product_orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_orders') THEN
        FOR trigger_record IN 
            SELECT tgname, tgisinternal 
            FROM pg_trigger 
            WHERE tgrelid = 'product_orders'::regclass
        LOOP
            IF NOT trigger_record.tgisinternal THEN
                EXECUTE format('DROP TRIGGER IF EXISTS %I ON product_orders', trigger_record.tgname);
            END IF;
        END LOOP;
    END IF;

    -- Drop default constraints
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_orders') THEN
        ALTER TABLE product_orders ALTER COLUMN status DROP DEFAULT;
    END IF;

    -- Create a new enum type with all the values including READY_FOR_PICKUP
    CREATE TYPE order_status_new AS ENUM (
        'PENDING',
        'READY_FOR_PICKUP',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED',
        'FAILED'
    );
    
    -- Update product_orders table to use the new type
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_orders') THEN
        ALTER TABLE product_orders 
            ALTER COLUMN status TYPE order_status_new 
            USING (CASE UPPER(status::text)
                WHEN 'PENDING' THEN 'PENDING'::order_status_new
                WHEN 'READY_FOR_PICKUP' THEN 'READY_FOR_PICKUP'::order_status_new
                WHEN 'PROCESSING' THEN 'PROCESSING'::order_status_new
                WHEN 'COMPLETED' THEN 'COMPLETED'::order_status_new
                WHEN 'CANCELLED' THEN 'CANCELLED'::order_status_new
                WHEN 'FAILED' THEN 'FAILED'::order_status_new
                ELSE 'PENDING'::order_status_new
            END);
        
        ALTER TABLE product_orders 
            ALTER COLUMN status SET DEFAULT 'PENDING'::order_status_new;
    END IF;
    
    -- Update order_status_history table to use the new type
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_status_history') THEN
        ALTER TABLE order_status_history 
            ALTER COLUMN status TYPE order_status_new 
            USING (CASE UPPER(status::text)
                WHEN 'PENDING' THEN 'PENDING'::order_status_new
                WHEN 'READY_FOR_PICKUP' THEN 'READY_FOR_PICKUP'::order_status_new
                WHEN 'PROCESSING' THEN 'PROCESSING'::order_status_new
                WHEN 'COMPLETED' THEN 'COMPLETED'::order_status_new
                WHEN 'CANCELLED' THEN 'CANCELLED'::order_status_new
                WHEN 'FAILED' THEN 'FAILED'::order_status_new
                ELSE 'PENDING'::order_status_new
            END);
    END IF;
    
    -- Now drop the old type (all dependent columns have been converted)
    DROP TYPE IF EXISTS order_status;
    
    -- Rename the new type to the original name
    ALTER TYPE order_status_new RENAME TO order_status;
    
    RAISE NOTICE 'Successfully updated order_status enum to include READY_FOR_PICKUP';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating order_status enum: %', SQLERRM;
END $$;

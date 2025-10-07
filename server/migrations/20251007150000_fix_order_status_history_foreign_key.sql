-- Fix foreign key constraint for order_status_history table
-- The constraint might be referencing the wrong table (orders instead of product_orders)

-- First, check if there's an existing constraint that references the wrong table
DO $$
DECLARE
    constraint_exists boolean;
    constraint_name text;
BEGIN
    -- Check if there's a foreign key constraint that references 'orders' table
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'order_status_history'
            AND ccu.table_name = 'orders'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Get the constraint name
        SELECT tc.constraint_name INTO constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'order_status_history'
            AND ccu.table_name = 'orders';
        
        -- Drop the incorrect constraint
        EXECUTE 'ALTER TABLE order_status_history DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped incorrect foreign key constraint: %', constraint_name;
    END IF;
END $$;

-- Ensure the correct foreign key constraint exists
DO $$
BEGIN
    -- Check if the correct constraint already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'order_status_history'
            AND ccu.table_name = 'product_orders'
            AND kcu.column_name = 'order_id'
    ) THEN
        -- Add the correct foreign key constraint
        ALTER TABLE order_status_history
        ADD CONSTRAINT order_status_history_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added correct foreign key constraint: order_status_history_order_id_fkey';
    ELSE
        RAISE NOTICE 'Correct foreign key constraint already exists';
    END IF;
END $$;

-- Verify the constraint is correct
DO $$
DECLARE
    constraint_info record;
BEGIN
    SELECT 
        tc.constraint_name,
        ccu.table_name AS foreign_table_name,
        kcu.column_name
    INTO constraint_info
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'order_status_history'
        AND kcu.column_name = 'order_id';
    
    IF constraint_info.constraint_name IS NOT NULL THEN
        RAISE NOTICE 'Foreign key constraint verified: % references %', 
            constraint_info.constraint_name, 
            constraint_info.foreign_table_name;
    ELSE
        RAISE NOTICE 'No foreign key constraint found for order_status_history.order_id';
    END IF;
END $$;

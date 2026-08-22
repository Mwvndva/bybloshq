-- Create the enum types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PENDING',
            'PROCESSING',
            'COMPLETED',
            'CANCELLED',
            'FAILED'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM (
            'PENDING',
            'AWAITING_PAYMENT',
            'PAID',
            'FAILED',
            'REFUNDED',
            'PARTIALLY_REFUNDED',
            'CANCELLED'
        );
    END IF;
END $$;

-- Create a function to safely alter the column type
CREATE OR REPLACE FUNCTION alter_column_type_if_exists(
    p_table_name text,
    p_column_name text,
    p_type text
) RETURNS void AS $$
DECLARE
    v_sql text;
    v_column_exists boolean;
BEGIN
    -- Check if the column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = p_table_name 
        AND column_name = p_column_name
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        -- First, drop any constraints that might be using this column
        FOR v_sql IN 
            SELECT 'ALTER TABLE ' || table_name || ' DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints 
            WHERE table_name = p_table_name
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE p_table_name || '_' || p_column_name || '%'
        LOOP
            BEGIN
                EXECUTE v_sql;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop constraint: %', SQLERRM;
            END;
        END LOOP;
        
        -- Now alter the column type
        v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE %s USING %I::%s', 
                       p_table_name, p_column_name, p_type, p_column_name, p_type);
        
        BEGIN
            EXECUTE v_sql;
            RAISE NOTICE 'Successfully altered % column in % table', p_column_name, p_table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter % column in % table: %', p_column_name, p_table_name, SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Column %.% does not exist', p_table_name, p_column_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing data to match the expected format
DO $$
BEGIN
    -- Only proceed if the orders table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Ensure status and payment_status are not null and properly formatted
        UPDATE orders 
        SET 
            status = COALESCE(UPPER(TRIM(NULLIF(status, ''))), 'PENDING'),
            payment_status = COALESCE(UPPER(TRIM(NULLIF(payment_status, ''))), 'PENDING')
        WHERE 
            status IS NULL OR 
            status = '' OR 
            payment_status IS NULL OR 
            payment_status = '';
            
        -- Map status to valid values
        UPDATE orders 
        SET status = 
            CASE 
                WHEN status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED') 
                THEN status
                ELSE 'FAILED'
            END;
            
        -- Map payment_status to valid values
        UPDATE orders 
        SET payment_status = 
            CASE 
                WHEN payment_status IN (
                    'PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 
                    'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'
                ) THEN payment_status
                ELSE 'PENDING'
            END;
    END IF;
END $$;

-- Alter the columns to use the new enum types
SELECT alter_column_type_if_exists('orders', 'status', 'order_status');
SELECT alter_column_type_if_exists('orders', 'payment_status', 'payment_status');

-- Add constraints to orders table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Add amount constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE table_name = 'orders' AND constraint_name = 'chk_amount_positive'
        ) THEN
            ALTER TABLE orders
            ADD CONSTRAINT chk_amount_positive CHECK (amount >= 0);
        END IF;
    END IF;
END $$;

-- Add constraints to order_items if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        -- Add quantity constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE table_name = 'order_items' AND constraint_name = 'chk_quantity_positive'
        ) THEN
            ALTER TABLE order_items
            ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
        END IF;
        
        -- Add subtotal constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE table_name = 'order_items' AND constraint_name = 'chk_subtotal_positive'
        ) THEN
            ALTER TABLE order_items
            ADD CONSTRAINT chk_subtotal_positive CHECK (subtotal >= 0);
        END IF;
    END IF;
END $$;
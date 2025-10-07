-- Fix order_items foreign key to reference product_orders instead of orders

-- First, check if the constraint exists and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'order_items_order_id_fkey' 
        AND table_name = 'order_items'
    ) THEN
        ALTER TABLE order_items DROP CONSTRAINT order_items_order_id_fkey;
    END IF;
END $$;

-- Now add the correct foreign key constraint pointing to product_orders
ALTER TABLE order_items
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE;


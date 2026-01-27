-- Final Idempotent Migration for Phone Fields Renaming

-- SELLERS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sellers' AND column_name = 'phone') THEN
        ALTER TABLE sellers RENAME COLUMN phone TO whatsapp_number;
    END IF;
END $$;

-- BUYERS
DO $$
BEGIN
    -- Handle previous double-run or typo: rename mobile_payment_number if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'mobile_payment_number') THEN
        ALTER TABLE buyers RENAME COLUMN mobile_payment_number TO mobile_payment;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'phone') THEN
        ALTER TABLE buyers RENAME COLUMN phone TO mobile_payment;
    END IF;

    -- Add whatsapp_number if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE buyers ADD COLUMN whatsapp_number VARCHAR(50);
    END IF;
END $$;

-- ORGANIZERS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizers' AND column_name = 'phone') THEN
        ALTER TABLE organizers RENAME COLUMN phone TO whatsapp_number;
    END IF;
END $$;

-- PRODUCT_ORDERS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_orders' AND column_name = 'buyer_phone') THEN
        ALTER TABLE product_orders RENAME COLUMN buyer_phone TO buyer_mobile_payment;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_orders' AND column_name = 'buyer_whatsapp_number') THEN
        ALTER TABLE product_orders ADD COLUMN buyer_whatsapp_number VARCHAR(50);
    END IF;
END $$;

-- PAYMENTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'phone_number') THEN
        ALTER TABLE payments RENAME COLUMN phone_number TO mobile_payment;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE payments ADD COLUMN whatsapp_number VARCHAR(50);
    END IF;
END $$;

-- TICKET_PURCHASES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket_purchases' AND column_name = 'phone_number') THEN
        ALTER TABLE ticket_purchases RENAME COLUMN phone_number TO whatsapp_number;
    END IF;
END $$;

-- TICKETS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE tickets ADD COLUMN whatsapp_number VARCHAR(50);
    END IF;
END $$;

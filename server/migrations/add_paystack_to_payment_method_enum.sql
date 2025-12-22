-- Add paystack to the payment_method enum
DO $$
BEGIN
    ALTER TYPE payment_method ADD VALUE 'paystack';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


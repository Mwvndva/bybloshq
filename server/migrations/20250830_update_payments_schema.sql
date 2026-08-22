-- 20250829_update_payments_schema.sql
-- Updates the payments table to match project conventions and improve schema design

-- Create payment status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'refunded');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank_transfer', 'other');
    END IF;
END $$;

-- Drop existing constraints and indexes to allow modifications
ALTER TABLE IF EXISTS payments 
    DROP CONSTRAINT IF EXISTS payments_ticket_id_fkey,
    DROP CONSTRAINT IF EXISTS payments_ticket_type_id_fkey,
    DROP CONSTRAINT IF EXISTS payments_event_id_fkey,
    DROP CONSTRAINT IF EXISTS payments_organizer_id_fkey;

-- Drop foreign key constraint from tickets table that references payments
ALTER TABLE IF EXISTS tickets 
    DROP CONSTRAINT IF EXISTS tickets_payment_id_fkey;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_event_id;
DROP INDEX IF EXISTS idx_payments_organizer_id;
DROP INDEX IF EXISTS idx_payments_ticket_type_id;

-- Recreate the payments table with updated schema
CREATE TABLE IF NOT EXISTS payments_new (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method payment_method NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    ticket_id INTEGER,
    ticket_type_id INTEGER,
    event_id INTEGER,
    organizer_id INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraints
    CONSTRAINT fk_payments_ticket FOREIGN KEY (ticket_id) 
        REFERENCES tickets(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_ticket_type FOREIGN KEY (ticket_type_id) 
        REFERENCES ticket_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_event FOREIGN KEY (event_id) 
        REFERENCES events(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_organizer FOREIGN KEY (organizer_id) 
        REFERENCES organizers(id) ON DELETE CASCADE,
    CONSTRAINT uq_payments_invoice_id UNIQUE (invoice_id)
);

-- Copy data from old table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        INSERT INTO payments_new (
            id, invoice_id, amount, currency, status, payment_method, 
            phone_number, email, ticket_id, ticket_type_id, event_id, 
            organizer_id, metadata, created_at, updated_at
        )
        SELECT 
            id, invoice_id, amount, currency, status, payment_method, 
            phone_number, email, ticket_id, ticket_type_id, event_id, 
            organizer_id, COALESCE(metadata, '{}'::jsonb), created_at, updated_at
        FROM payments;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error migrating data: %', SQLERRM;
END $$;

-- Drop the old table if it exists and rename the new one
DROP TABLE IF EXISTS payments;
ALTER TABLE payments_new RENAME TO payments;

-- Create indexes for better query performance
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_event_id ON payments(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_payments_organizer_id ON payments(organizer_id);
CREATE INDEX idx_payments_ticket_id ON payments(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_payments_ticket_type_id ON payments(ticket_type_id) WHERE ticket_type_id IS NOT NULL;
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_email ON payments(LOWER(email));
CREATE INDEX idx_payments_phone_number ON payments(phone_number) WHERE phone_number IS NOT NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Re-add foreign key constraint from tickets table to payments
ALTER TABLE tickets 
    ADD CONSTRAINT tickets_payment_id_fkey 
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON TABLE payments IS 'Stores payment transactions and their statuses';
COMMENT ON COLUMN payments.invoice_id IS 'Unique identifier for the payment transaction';
COMMENT ON COLUMN payments.amount IS 'Payment amount in the smallest currency unit';
COMMENT ON COLUMN payments.currency IS 'Currency code (e.g., KES, USD)';
COMMENT ON COLUMN payments.status IS 'Current status of the payment';
COMMENT ON COLUMN payments.payment_method IS 'Method used for the payment';
COMMENT ON COLUMN payments.phone_number IS 'Phone number associated with the payment (for M-Pesa)';
COMMENT ON COLUMN payments.email IS 'Email associated with the payment';
COMMENT ON COLUMN payments.ticket_id IS 'Reference to the ticket this payment is for (if applicable)';
COMMENT ON COLUMN payments.ticket_type_id IS 'Reference to the ticket type (if applicable)';
COMMENT ON COLUMN payments.event_id IS 'Reference to the event this payment is for';
COMMENT ON COLUMN payments.organizer_id IS 'Reference to the organizer receiving the payment';
COMMENT ON COLUMN payments.metadata IS 'Additional payment details and metadata';
COMMENT ON COLUMN payments.created_at IS 'Timestamp when the payment record was created';
COMMENT ON COLUMN payments.updated_at IS 'Timestamp when the payment record was last updated';

-- Add a function to generate invoice IDs if it doesn't exist
CREATE OR REPLACE FUNCTION generate_invoice_id(prefix TEXT DEFAULT 'INV')
RETURNS TEXT AS $$
DECLARE
    timestamp_part TEXT;
    random_part TEXT;
BEGIN
    timestamp_part := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS');
    random_part := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN UPPER(prefix) || '-' || timestamp_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- Create payment status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- Create payment_method enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank');
    END IF;
END $$;

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_event_id ON payments(event_id);
CREATE INDEX idx_payments_organizer_id ON payments(organizer_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

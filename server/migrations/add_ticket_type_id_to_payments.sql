-- Add ticket_type_id column to payments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='ticket_type_id') THEN
        ALTER TABLE payments ADD COLUMN ticket_type_id INTEGER REFERENCES event_ticket_types(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='ticket_id') THEN
        ALTER TABLE payments ADD COLUMN ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL;
    END IF;
END $$;


-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_ticket_type_id ON payments(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_payments_ticket_id ON payments(ticket_id);

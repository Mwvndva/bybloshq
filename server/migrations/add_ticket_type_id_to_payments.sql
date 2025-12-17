-- Add ticket_type_id column to payments table
ALTER TABLE payments ADD COLUMN ticket_type_id INTEGER REFERENCES event_ticket_types(id) ON DELETE SET NULL;

-- Add ticket_id column to payments table (for individual ticket purchases)
ALTER TABLE payments ADD COLUMN ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_ticket_type_id ON payments(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_payments_ticket_id ON payments(ticket_id);

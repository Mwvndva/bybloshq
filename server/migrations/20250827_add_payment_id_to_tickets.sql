-- Add payment_id column to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id);

-- Add index on payment_id for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_payment_id ON tickets(payment_id);

-- Update existing tickets if needed (this is just an example, adjust according to your needs)
-- UPDATE tickets t
-- SET payment_id = p.id
-- FROM payments p
-- WHERE t.id = p.ticket_id; -- Adjust this join condition based on your schema

COMMENT ON COLUMN tickets.payment_id IS 'References the payments table to link tickets to their payment records';

-- Add ticket_type_id column to payments table
ALTER TABLE payments 
ADD COLUMN ticket_type_id INTEGER REFERENCES ticket_types(id) ON DELETE SET NULL;

-- Update the foreign key constraint for ticket_id to be nullable
ALTER TABLE payments 
ALTER COLUMN ticket_id DROP NOT NULL;

-- Add index for ticket_type_id
CREATE INDEX IF NOT EXISTS idx_payments_ticket_type_id ON payments(ticket_type_id);

-- Update existing payments to set ticket_type_id from tickets table if possible
UPDATE payments p
SET ticket_type_id = t.ticket_type_id
FROM tickets t
WHERE p.ticket_id = t.id;

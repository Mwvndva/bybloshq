-- Make ticket_id nullable in payments table
ALTER TABLE payments 
ALTER COLUMN ticket_id DROP NOT NULL,
ALTER COLUMN ticket_id DROP DEFAULT;

-- Update the foreign key constraint to allow NULL values
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_ticket_id_fkey,
ADD CONSTRAINT payments_ticket_id_fkey 
FOREIGN KEY (ticket_id) 
REFERENCES tickets(id) 
ON DELETE SET NULL;

-- Check if the constraint already exists before adding it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'tickets_ticket_number_key' 
        AND conrelid = 'tickets'::regclass
    ) THEN
        -- Add unique constraint to ticket_number column
        ALTER TABLE tickets 
        ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
        
        RAISE NOTICE 'Added unique constraint on tickets.ticket_number';
    ELSE
        RAISE NOTICE 'Unique constraint on tickets.ticket_number already exists, skipping...';
    END IF;
END
$$;

-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);

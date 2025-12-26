-- Add balance column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS balance DECIMAL(12, 2) DEFAULT 0;

-- Add event_id to withdrawal_requests
ALTER TABLE withdrawal_requests 
ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;

-- Update constraints on withdrawal_requests
-- It must belong to EITHER (seller) OR (organizer AND (event OR NOT event))
-- Using a simpler check: seller_id is one set, organizer_id is another.
-- If organizer_id is set, event_id CAN be set.
-- We drop the old constraint first.
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_owner_check;

ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_owner_check 
CHECK (
    (seller_id IS NOT NULL AND organizer_id IS NULL AND event_id IS NULL) OR 
    (seller_id IS NULL AND organizer_id IS NOT NULL)
);

-- Backfill event balance based on PAID tickets
-- We calculate the sum of price for all 'paid' tickets for each event
WITH event_revenue AS (
    SELECT event_id, SUM(price) as revenue
    FROM tickets
    WHERE status = 'paid'
    GROUP BY event_id
)
UPDATE events e
SET balance = er.revenue
FROM event_revenue er
WHERE e.id = er.event_id;

-- Create Trigger Function to auto-update balance when tickets are paid
CREATE OR REPLACE FUNCTION update_event_balance_on_ticket_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If ticket marked as paid (inserted or updated)
    IF (TG_OP = 'INSERT' AND NEW.status = 'paid') THEN
        UPDATE events SET balance = balance + NEW.price WHERE id = NEW.event_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If status changed TO paid
        IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
            UPDATE events SET balance = balance + NEW.price WHERE id = NEW.event_id;
        -- If status changed FROM paid (e.g. refunded/cancelled)
        ELSIF (OLD.status = 'paid' AND NEW.status != 'paid') THEN
            UPDATE events SET balance = balance - OLD.price WHERE id = OLD.event_id;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'paid') THEN
        UPDATE events SET balance = balance - OLD.price WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_update_event_balance ON tickets;
CREATE TRIGGER trigger_update_event_balance
AFTER INSERT OR UPDATE OR DELETE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_event_balance_on_ticket_change();

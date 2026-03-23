-- ISSUE 7: Drop orphaned FK columns after ticketing system removal
ALTER TABLE payments DROP COLUMN IF EXISTS ticket_type_id;
ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS ticket_type_id;

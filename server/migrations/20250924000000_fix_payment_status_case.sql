-- Fix case sensitivity issues with status values
UPDATE orders 
SET status = UPPER(status),
    payment_status = UPPER(payment_status)
WHERE status != UPPER(status) OR payment_status != UPPER(payment_status);

-- Add a comment to document the change
COMMENT ON COLUMN orders.status IS 'Order status (PENDING, COMPLETED, FAILED, etc.) - UPPERCASE';
COMMENT ON COLUMN orders.payment_status IS 'Payment status (PENDING, PAID, FAILED, etc.) - UPPERCASE';

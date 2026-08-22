-- Migration: allow paid buyer delivery legs to become visible to logistics.
-- Logistics states remain operational only and must not mutate payment, escrow, or seller payout.

ALTER TABLE logistics_legs
    DROP CONSTRAINT IF EXISTS logistics_legs_status_check;

ALTER TABLE logistics_legs
    ADD CONSTRAINT logistics_legs_status_check CHECK (
        status IN (
            'payment_pending',
            'delivery_pending',
            'pending',
            'assigned',
            'started',
            'picked_up',
            'dropped_at_hub',
            'out_for_delivery',
            'delivered',
            'failed',
            'delayed',
            'cancelled'
        )
    );

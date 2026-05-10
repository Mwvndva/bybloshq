-- Migration: unified order, logistics, and handoff statuses
-- Reason: Add canonical status values while preserving legacy values for historical orders.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'AWAITING_SELLER_ACTION';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FULFILLING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY_FOR_BUYER';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';

DO $$
BEGIN
    IF to_regtype('public.payment_status') IS NOT NULL THEN
        ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'manual_review';
    END IF;
END $$;

ALTER TABLE logistics_requests
    DROP CONSTRAINT IF EXISTS logistics_requests_status_check;

ALTER TABLE logistics_requests
    ADD CONSTRAINT logistics_requests_status_check CHECK (
        status IN (
            'not_required',
            'pending',
            'awaiting_seller_choice',
            'payment_pending',
            'active',
            'in_progress',
            'completed',
            'cancelled',
            'failed',
            'manual_review'
        )
    );

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
            'in_progress',
            'picked_up',
            'dropped_at_hub',
            'out_for_delivery',
            'completed',
            'delivered',
            'failed',
            'delayed',
            'cancelled'
        )
    );

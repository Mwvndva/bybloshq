-- Migration: sync delivered logistics orders to buyer-confirmable state
-- Reason: Some door-delivery orders had completed logistics while product_orders.status remained AWAITING_SELLER_ACTION.
-- This updates only the order lifecycle status so buyers can confirm receipt. It does not mutate money state or totals.

UPDATE product_orders po
SET status = 'READY_FOR_BUYER',
    metadata = COALESCE(po.metadata, '{}'::jsonb) || jsonb_build_object(
        'logistics_delivery_ready_for_buyer',
        jsonb_build_object(
            'source', 'migration_delivered_logistics_sync',
            'updated_at', NOW()
        )
    ),
    updated_at = NOW()
WHERE po.status IN (
    'PAID',
    'AWAITING_SELLER_ACTION',
    'FULFILLING',
    'PROCESSING',
    'DELIVERY_PENDING',
    'DELIVERY_COMPLETE',
    'COLLECTION_PENDING',
    'CONFIRMED'
)
AND EXISTS (
    SELECT 1
    FROM logistics_requests lr
    JOIN logistics_legs ll
      ON ll.logistics_request_id = lr.id
     AND ll.leg_type = 'delivery'
    WHERE lr.order_id = po.id
      AND ll.status IN ('delivered', 'completed')
);

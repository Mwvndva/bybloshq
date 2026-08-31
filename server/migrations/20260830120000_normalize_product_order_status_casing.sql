-- Migration: Normalize product_orders.status casing to the canonical UPPERCASE
-- order_status vocabulary.
--
-- Background: product_orders.status is a varchar. The canonical lifecycle (OrderService,
-- OrderStatusGuard, order_status enum) uses UPPERCASE values ('CANCELLED', 'DELIVERED',
-- ...). A few legacy paths wrote lowercase — most notably the inventory-TTL cleanup cron
-- ('cancelled') and the now-removed Order.markAsShipped/markAsDelivered helpers
-- ('shipped'/'delivered'). Those rows are invisible to UPPERCASE readers (buyer views,
-- guards, analytics). This backfill aligns any such historical rows with the canonical
-- casing. It is idempotent — it only touches exact lowercase matches.

UPDATE public.product_orders SET status = 'CANCELLED' WHERE status = 'cancelled';
UPDATE public.product_orders SET status = 'DELIVERED' WHERE status = 'delivered';

-- 'shipped' has no canonical order_status equivalent (shipping is tracked in metadata,
-- not as a lifecycle state). Map any legacy 'shipped' rows to the nearest in-flight
-- fulfilment state so they are not stranded outside the vocabulary.
UPDATE public.product_orders SET status = 'FULFILLING' WHERE status = 'shipped';

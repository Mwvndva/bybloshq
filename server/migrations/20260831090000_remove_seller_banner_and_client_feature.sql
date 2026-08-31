-- Migration: Remove the seller banner image and the (retired) seller-client feature.
--
-- Banner: the banner image was removed from the frontend; the sellers.banner_image
-- column and all its upload/read logic are gone from the app.
--
-- Client feature: the "become a client / seller client list" feature (originally for
-- seller-initiated payments) is no longer used. Its code paths — the seller_clients
-- relationship, sellers.client_count, the become-client/leave-client endpoints, the
-- "shops I'm a client of" listing, and the isClient flag on order views — have all
-- been removed. product_orders.client_id was already dead (no code referenced it).
--
-- Idempotent: uses IF EXISTS. CASCADE drops any dependent indexes/constraints.

ALTER TABLE public.sellers        DROP COLUMN IF EXISTS banner_image;
ALTER TABLE public.sellers        DROP COLUMN IF EXISTS client_count;
ALTER TABLE public.product_orders DROP COLUMN IF EXISTS client_id CASCADE;
DROP TABLE IF EXISTS public.seller_clients CASCADE;

-- Migration: Add service_requirements column to product_orders table

ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS service_requirements TEXT;

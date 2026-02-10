-- Migration: Add TikTok and Facebook links to sellers table
-- Created at: 2026-02-10

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS tiktok_link TEXT,
ADD COLUMN IF NOT EXISTS facebook_link TEXT;

-- DRM Hardening Migration
-- 1. Remove master_key from digital_activations (now stored in ENV)
-- 2. Add download_count and last_downloaded_at
-- 3. Add bond_window_expires_at for hardware binding

ALTER TABLE digital_activations 
DROP COLUMN IF EXISTS master_key,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bond_window_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for cleanup crons
CREATE INDEX IF NOT EXISTS idx_activations_expires ON digital_activations(bond_window_expires_at);

-- Add session token columns to digital_activations
ALTER TABLE digital_activations 
    ADD COLUMN IF NOT EXISTS session_token VARCHAR(32),
    ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_digital_activations_session_token 
    ON digital_activations(session_token) 
    WHERE session_token IS NOT NULL;

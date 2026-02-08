-- ==============================================
-- Webhook Monitoring & Security Tables
-- ==============================================
-- This migration creates tables for tracking security alerts
-- and webhook patterns to detect fraud and abuse
--
-- Run this migration after creating the admin user

-- ==============================================
-- 1. Security Alerts Table
-- ==============================================
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(255) NOT NULL,
    details JSONB NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraint to ensure reviewed_at is set when reviewed is true
    CONSTRAINT reviewed_at_check CHECK (
        (reviewed = FALSE AND reviewed_at IS NULL) OR
        (reviewed = TRUE AND reviewed_at IS NOT NULL)
    )
);

-- Indexes for security_alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_created 
ON security_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_reviewed 
ON security_alerts(reviewed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type 
ON security_alerts(alert_type, created_at DESC);

-- ==============================================
-- 2. Webhook Logs Table
-- ==============================================
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(255),
    client_ip VARCHAR(45) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference 
ON webhook_logs(reference);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_ip_time 
ON webhook_logs(client_ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created 
ON webhook_logs(created_at DESC);

-- Partial index for recent webhooks (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_recent 
ON webhook_logs(client_ip, reference) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ==============================================
-- 3. Add Comments for Documentation
-- ==============================================
COMMENT ON TABLE security_alerts IS 'Stores security alerts for manual review and incident response';
COMMENT ON COLUMN security_alerts.alert_type IS 'Type of security alert (e.g., "Unauthorized webhook IP", "High webhook volume")';
COMMENT ON COLUMN security_alerts.details IS 'JSON details about the security incident';
COMMENT ON COLUMN security_alerts.reviewed IS 'Whether the alert has been reviewed by security team';

COMMENT ON TABLE webhook_logs IS 'Logs all webhook requests for pattern analysis and fraud detection';
COMMENT ON COLUMN webhook_logs.reference IS 'Transaction reference from the webhook payload';
COMMENT ON COLUMN webhook_logs.client_ip IS 'IP address of the webhook source';
COMMENT ON COLUMN webhook_logs.payload IS 'Full webhook payload for forensic analysis';

-- ==============================================
-- 4. Create Function for Automatic Log Cleanup
-- ==============================================
-- This function can be called by a cron job to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    deleted BIGINT;
BEGIN
    DELETE FROM webhook_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted = ROW_COUNT;
    
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_webhook_logs IS 'Deletes webhook logs older than specified days (default 30)';

-- ==============================================
-- 5. Verification Queries
-- ==============================================
-- Run these to verify the migration succeeded

-- Check tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('security_alerts', 'webhook_logs')
ORDER BY table_name;

-- Check indexes were created
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('security_alerts', 'webhook_logs')
ORDER BY tablename, indexname;

-- Test the cleanup function
SELECT * FROM cleanup_old_webhook_logs(30);

-- ==============================================
-- 6. Grant Permissions (if using role-based access)
-- ==============================================
-- Uncomment if you have specific database roles

-- GRANT SELECT, INSERT ON security_alerts TO app_user;
-- GRANT SELECT, INSERT, DELETE ON webhook_logs TO app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_webhook_logs TO app_user;

-- ==============================================
-- Migration Complete
-- ==============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Webhook monitoring tables created successfully';
    RAISE NOTICE 'Tables: security_alerts, webhook_logs';
    RAISE NOTICE 'Function: cleanup_old_webhook_logs(days_to_keep)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 To view security alerts:';
    RAISE NOTICE 'SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 10;';
    RAISE NOTICE '';
    RAISE NOTICE '📊 To view webhook patterns:';
    RAISE NOTICE 'SELECT client_ip, COUNT(*) FROM webhook_logs GROUP BY client_ip ORDER BY COUNT(*) DESC;';
END $$;

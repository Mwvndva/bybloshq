CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(255) NOT NULL,
  details JSONB NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reviewed_at_check CHECK (
    (reviewed = FALSE AND reviewed_at IS NULL) OR
    (reviewed = TRUE AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255),
  client_ip VARCHAR(45) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_reviewed 
  ON security_alerts(reviewed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created 
  ON webhook_logs(created_at DESC);

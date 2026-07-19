-- Add columns for feed health tracking and quarantine circuit breaker
ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS quarantined_until TIMESTAMP WITH TIME ZONE NULL;

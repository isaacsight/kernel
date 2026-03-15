-- Migration 084: Disable overage for all existing subscriptions
-- Closes the gap where legacy subscriptions from migration 073 still had overage_enabled = true
UPDATE subscriptions
SET overage_enabled = false,
    overage_rate_millicents = 0,
    overage_count = 0,
    last_reported_overage_count = 0
WHERE overage_enabled = true;

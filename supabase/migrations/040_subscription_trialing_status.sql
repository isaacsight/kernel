-- 040: Add 'trialing' to subscriptions status CHECK constraint
-- Required for 7-day free trial support via Stripe

-- Drop the existing check constraint and replace with expanded one
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'inactive'));

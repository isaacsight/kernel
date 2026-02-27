-- 038: Add plan column to subscriptions + monthly usage counters on user_memory
-- Supports 3-tier system: free / pro_monthly ($29/mo) / pro_annual ($290/yr)

-- Plan column on subscriptions (existing rows default to 'pro_monthly')
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro_monthly'
  CHECK (plan IN ('pro_monthly', 'pro_annual'));

-- Monthly usage counters on user_memory
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS monthly_message_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_window_start TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_et_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_file_count INT DEFAULT 0;

-- Protect monthly counter columns from direct client writes
-- (matches protect_message_count pattern from migration 025)
CREATE OR REPLACE FUNCTION protect_monthly_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role') IN ('authenticated', 'anon') THEN
    NEW.monthly_message_count := OLD.monthly_message_count;
    NEW.monthly_window_start := OLD.monthly_window_start;
    NEW.monthly_et_count := OLD.monthly_et_count;
    NEW.monthly_file_count := OLD.monthly_file_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_monthly_counters ON user_memory;
CREATE TRIGGER trg_protect_monthly_counters
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION protect_monthly_counters();

-- Revoke direct execute from public roles
REVOKE EXECUTE ON FUNCTION protect_monthly_counters() FROM public, authenticated, anon;

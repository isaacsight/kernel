-- 066: Update API key tiers — rename 'starter' → 'pro', add 'free' tier, update limits
--
-- New pricing matrix:
--   Free:       $0/mo,   50 msgs, 10/min, core 5 agents
--   Pro:        $29/mo,  2,000 msgs, 30/min, core 5 agents, bash/search
--   Growth:     $149/mo, 20,000 msgs, 120/min, all 17 agents, swarm, browser
--   Enterprise: Custom,  unlimited, 180/min, all agents, computer use, custom prompts

-- Step 1: Add 'free' and 'pro' to the allowed values by dropping and recreating the constraint
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('free', 'pro', 'growth', 'enterprise'));

-- Step 2: Rename existing 'starter' keys to 'pro'
UPDATE api_keys SET tier = 'pro' WHERE tier = 'starter';

-- Step 3: Update defaults for new keys
ALTER TABLE api_keys ALTER COLUMN tier SET DEFAULT 'free';
ALTER TABLE api_keys ALTER COLUMN monthly_message_limit SET DEFAULT 50;
ALTER TABLE api_keys ALTER COLUMN rate_limit_per_min SET DEFAULT 10;
ALTER TABLE api_keys ALTER COLUMN streaming_enabled SET DEFAULT false;

-- Step 4: Update existing keys to match new tier limits
-- Pro tier (formerly starter): 2,000 msgs, 30/min
UPDATE api_keys
   SET monthly_message_limit = 2000,
       rate_limit_per_min = 30,
       streaming_enabled = true
 WHERE tier = 'pro';

-- Growth tier: 20,000 msgs, 120/min (already correct for most)
UPDATE api_keys
   SET monthly_message_limit = 20000,
       rate_limit_per_min = 120,
       swarm_enabled = true,
       all_agents_enabled = true,
       streaming_enabled = true
 WHERE tier = 'growth';

-- Enterprise: 999,999 soft cap, 180/min
UPDATE api_keys
   SET monthly_message_limit = 999999,
       rate_limit_per_min = 180,
       swarm_enabled = true,
       all_agents_enabled = true,
       streaming_enabled = true
 WHERE tier = 'enterprise';

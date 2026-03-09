-- 071: Grant Pro tier access to all agents and swarm
--
-- Pro users now get swarm (multi-agent) and all 17 agents,
-- matching the Growth tier feature set but with lower volume limits.

UPDATE api_keys
   SET swarm_enabled = true,
       all_agents_enabled = true
 WHERE tier = 'pro';

---
tags: [kernel, backlog, planning]
updated: "2026-03-11"
---

# Backlog

Prioritized work items. Top = highest priority.

## High Priority

- [ ] Wire kbot CLI to connect to kbot-engine for cloud sync
- [ ] Test file uploads end-to-end with various file types
- [ ] Verify all 5 Ollama models downloaded successfully (qwen2.5-coder:14b, deepseek-r1:14b, gemma3:12b, phi4:14b, llava:13b)

## Medium Priority

- [ ] Capacitor native shells (iOS/Android) — requires Xcode/Android Studio
- [ ] Biometric auth for Capacitor (Face ID / fingerprint)
- [ ] Deep linking for Capacitor (kernel.chat URLs → native app)
- [ ] App Store / Play Store submission
- [ ] Monitor Supabase storage usage (free tier: 1GB, Pro: 100GB)

## Low Priority / Nice to Have

- [ ] Obsidian plugin (native, not just MCP) for automatic background sync
- [ ] `kbot sync` command for Obsidian vault ↔ Kernel memory
- [ ] Usage alerts at 80% and 100% of quota (email via Resend)
- [ ] Update landing copy to clarify free local vs cloud options for new users

## Completed (Recent)

- [x] Agent picker UI — dropdown in input bar, 10 featured agents
- [x] Forced agent routing — `forcedAgentId` override bypasses classifier
- [x] Hacker sub-agent with anti-hallucination protocol
- [x] `kbot agents` command — lists built-in agents + presets
- [x] Rate limit fix — client-side guard was using lifetime count instead of daily
- [x] 3 new agents: hacker, operator, dreamer (17 → 20 agents)
- [x] K:BOT v2.3.1 → v2.5.0 published to npm
- [x] kbot-engine edge function deployed (proxy, sync, route, usage, health, models)
- [x] kbot_memory table + RLS for cloud sync
- [x] Atomic rate limiting (check_and_increment_message RPC)
- [x] Admin agent + client scoring + Stripe invoicing
- [x] OpenClaw MCP server (19 tools, sandboxed local AI)
- [x] Free-only conversion — removed all paid tiers, 10 msgs/day
- [x] Unified Files panel with folders + AI file access
- [x] Obsidian MCP server (bidirectional sync, 10 tools)
- [x] Obsidian vault structure + documentation

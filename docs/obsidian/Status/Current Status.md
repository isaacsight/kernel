---
tags: [kernel, status]
updated: "2026-03-06"
---

# Current Status — March 6, 2026

## What's Live

### kernel.chat (Web App)
- Full PWA with 17 specialist agents
- Memory system with warmth tracking + knowledge graph
- Convergence (6 facet lenses)
- Voice I/O (Web Speech API + OpenAI TTS for Pro)
- Live Share (real-time collaboration via Supabase Realtime)
- Workspaces (team tier with 3-role system)
- Conversation sharing + ChatGPT/Claude/Gemini import
- Dark mode (warm brown undertones)
- i18n (24 languages)
- E2E test suite (28 Playwright tests)

### K:BOT CLI
- Terminal agent with 17 specialists
- Local tools: bash, files, git, search
- Multi-model: Anthropic, OpenAI, Google, NVIDIA, Ollama (local)
- BYOK (Bring Your Own Key) — no message limits
- Persistent local memory at `~/.kbot/memory/`
- Unified billing with web (shared message pool)

### REST API
- Endpoints: /chat, /swarm, /usage, /agents
- API key auth (kn_live_* prefix, SHA-256 hashed)
- Tier resolution from user's web subscription
- Streaming support for Pro+

### Billing
- Stripe integration (subscriptions + metered overage)
- Unified across web + CLI + API
- Free (30/mo), Pro ($39, 1000/mo), Max ($249, 6000/mo)
- Billing meters: kernel_pro_overage, kernel_max_overage

## Just Completed (This Session)

1. **Unified billing** — Single subscription covers all 3 surfaces
2. **Option C pricing** — Free 30/mo, Pro $39 1000/mo $0.05 overage, Max $249 6000/mo $0.04 overage
3. **Stripe setup** — New products, prices, billing meters created
4. **Full audit** — 16 files checked, 13 updated, 2 critical bugs fixed
5. **Obsidian MCP** — Bidirectional vault ↔ Kernel sync (10 tools)
6. **Growth → Max rename** — All user-facing and internal references updated

## Pending

- [ ] Apply migration 074 to production Supabase
- [ ] Deploy updated edge functions (claude-proxy, kernel-api, stripe-webhook, task-scheduler, api-keys, create-checkout)
- [ ] Build + deploy frontend to kernel.chat
- [ ] Test end-to-end: sign up → subscribe Pro → use web → use kbot → hit quota → overage billing
- [ ] Archive old Stripe meters (web_pro_overage_message, api_pro_overage_message)
- [ ] Add spending ceiling UI to AccountSettingsPanel (toggle overage, set max monthly spend)
- [ ] Add `kbot upgrade` command that opens browser to kernel.chat/#/pricing
- [ ] Add `kbot billing` command for quota/overage/plan info
- [ ] Capacitor native shells (iOS/Android) — requires Xcode/Android Studio

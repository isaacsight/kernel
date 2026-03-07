---
tags: [kernel, backlog, planning]
updated: "2026-03-06"
---

# Backlog

Prioritized work items. Top = highest priority.

## Critical (Deploy Blockers)

- [ ] Apply migration 074_unified_billing.sql to production Supabase
- [ ] Deploy all updated edge functions
- [ ] Build + deploy frontend to kernel.chat
- [ ] E2E test: signup → subscribe → web usage → kbot usage → overage → Stripe invoice

## High Priority

- [ ] Spending ceiling UI in AccountSettingsPanel (toggle overage on/off, set max monthly spend)
- [ ] `kbot upgrade` command — opens browser to kernel.chat/#/pricing
- [ ] `kbot billing` command — shows plan, usage, overage from CLI
- [ ] Archive old Stripe meters (web_pro_overage_message, api_pro_overage_message)

## Medium Priority

- [ ] Capacitor native shells (iOS/Android) — need Xcode/Android Studio
- [ ] Biometric auth for Capacitor (Face ID / fingerprint)
- [ ] Deep linking for Capacitor (kernel.chat URLs → native app)
- [ ] App Store / Play Store submission

## Low Priority / Nice to Have

- [ ] Obsidian plugin (native, not just MCP) for automatic background sync
- [ ] `kbot sync` command for Obsidian vault ↔ Kernel memory
- [ ] Real-time usage dashboard in AccountSettingsPanel (live message count, overage spend)
- [ ] Usage alerts at 80% and 100% of quota (email via Resend)
- [ ] API analytics dashboard for developers

## Completed (Recent)

- [x] Unified billing (web + CLI + API shared pool)
- [x] Option C pricing (Free 30, Pro 1000 $0.05, Max 6000 $0.04)
- [x] Stripe billing meters + products + prices
- [x] Growth → Max rename across all files
- [x] Billing audit — 2 critical bugs fixed (swarm metering, rate limit mapping)
- [x] Obsidian MCP server (bidirectional sync, 10 tools)
- [x] Obsidian vault structure + documentation

---
tags: [kernel, status]
updated: "2026-03-08"
---

# Current Status — March 8, 2026

## What's Live

### kernel.chat (Web App)
- Full PWA with 17 specialist agents
- **Free only — 10 messages per day**, no paid tiers
- Memory system with warmth tracking + knowledge graph
- Convergence (6 facet lenses)
- Voice I/O (Web Speech API + browser TTS)
- Conversation sharing + ChatGPT/Claude/Gemini import
- **Unified Files panel** (images, videos, any file type, folders)
- **AI file access** — stored files injected into system prompt
- Dark mode (warm brown undertones)
- i18n (24 languages)
- Admin dashboard with conversation viewer, storage monitoring, client scoring, Stripe invoicing
- **Admin agent** — command-driven admin operations via MCP server
- **Atomic rate limiting** — prevents free-tier users from exceeding daily limit
- E2E test suite (28 Playwright tests)

## Just Completed (March 8 Session)

1. **Client scoring with pricing** — Admin dashboard parses score notes into full pricing breakdowns (market, relevance, R&D, web multipliers, tier, tax, Stripe fees)
2. **Stripe invoicing** — "Invoice via Stripe" button creates real Stripe invoices with proper line items, tax, 30-day terms
3. **Admin file sends** — Upload files from admin's computer directly into any user's Inbox folder
4. **Atomic rate limit fix** — `check_and_increment_message` RPC with `FOR UPDATE` row lock prevents race condition (was allowing 13/10 messages)
5. **Pricing includes Stripe costs** — CA sales tax (8.75%) + Stripe processing fee (2.9% + $0.30) built into scoring formula
6. **Admin agent** — Command-driven agent with MCP server (7 tools: stats, users, scores, file send, invoice, subscriptions, moderation)
7. **Edge functions deployed** — `admin-send-file`, `admin-invoice`, updated `claude-proxy`
8. **Migration 078** applied — `check_and_increment_message` atomic RPC

## Previous Session (March 7)

1. Free-only conversion — removed all paid tiers
2. 10 messages/day flat limit
3. Unified Files panel with folders
4. AI file access via system prompt
5. Admin conversation viewer + storage monitoring
6. No file size limits
7. Migration 076 — user files tables

## Architecture Summary

| Surface | Status |
|---------|--------|
| Web (kernel.chat) | Live, free-only |
| K:BOT CLI | Code exists, not exposed to users |
| REST API | Code exists, not exposed to users |
| Billing (Stripe) | Client invoicing active, subscription UI removed |
| Admin Agent | MCP server with 7 tools, command-driven |

## Pending

- [ ] Test file uploads end-to-end with various file types
- [ ] Capacitor native shells (iOS/Android) — requires Xcode/Android Studio
- [ ] Monitor Supabase storage usage (free tier: 1GB, Pro: 100GB)

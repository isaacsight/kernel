---
tags: [kernel, admin, agents, billing]
updated: "2026-03-08"
---

# Admin System

The admin system provides platform operations, client scoring, Stripe invoicing, and user management — all command-driven (never autonomous).

## Admin Agent

Defined in `.claude/agents/admin.md`. The admin agent only acts on explicit commands from the platform owner. It reads its own persistent memory before each task and writes findings after.

### Capabilities
- View/search users, subscription status, message counts, storage usage
- Grant or revoke Pro subscriptions
- View client scores with full pricing breakdowns
- Create draft Stripe invoices (admin approves before sending)
- Send files into any user's account (lands in their Inbox folder)
- View moderation queue

## MCP Server

`tools/kernel-admin-mcp.ts` — registered as `kernel-admin` in `.mcp.json`

| Tool | Purpose |
|------|---------|
| `admin_stats` | Platform-wide stats (users, subs, messages, MRR) |
| `admin_list_users` | List/search users with subscription status |
| `admin_client_scores` | All client scores with pricing breakdowns |
| `admin_send_file` | Send local file to user's Inbox |
| `admin_create_invoice` | Create draft Stripe invoice |
| `admin_manage_subscription` | Grant/revoke Pro access |
| `admin_user_detail` | Detailed user info (messages, files, scores, memory) |
| `admin_moderation_queue` | View pending content moderation |

## Client Scoring

Triggered by `kernel.hat` command in chat. Scores 6 categories:

| Category | Abbreviation |
|----------|-------------|
| Engagement | E |
| R&D | RD |
| Q&A | QA |
| Productivity | P |
| Depth | D |
| Loyalty | L |

### Score Notes Format
Pipe-delimited string stored in `client_scores.notes`:
```
E15 RD12 QA14 P10 D8 L7 | Finance ×1.8 | Focused ×1.28 | Significant R&D ×1.25 | Web ×1.1 | Premium $34267 | tax$2997 fee$1024 sub$34267
```

7 segments: categories | market | relevance | R&D | web | tier+total | tax+fee+subtotal

### Pricing Formula
```
base ($2,500) + score × $75
  × market multiplier (1.0–1.8)
  × relevance multiplier (1.0–1.5)
  × R&D multiplier (1.0–1.3)
  × web research multiplier (0.9–1.3)
  + tier surcharge (0–40%)
  = subtotal
  + CA sales tax (8.75%)
  + Stripe processing fee (2.9% + $0.30)
  = invoice total
```

Billing threshold: score >= 70/100 to invoice.

## Stripe Invoice Flow

1. Find or create Stripe customer by email
2. Create **draft** invoice with 30-day payment terms (`auto_advance: false`)
3. Add project work line item (subtotal)
4. Add tax line item (CA 8.75%)
5. Return draft — admin reviews in Stripe dashboard
6. Admin manually finalizes and sends

## Edge Functions

| Function | Purpose |
|----------|---------|
| `admin-send-file` | Upload file into any user's Inbox folder (service role bypass) |
| `admin-invoice` | Create draft Stripe invoice with line items |

## Admin Dashboard

`src/pages/AdminPage.tsx` at `/#/admin` (requires `is_admin` in app_metadata)

Features:
- User list with search, subscription status, message counts
- Conversation viewer (click user → view conversations → read messages)
- Per-user storage monitoring with 80GB+ warning
- Client scores with parsed pricing breakdowns (multipliers, tier, tax, fees)
- "Invoice via Stripe" button → creates draft → opens Stripe dashboard
- "Send File" button → file picker → base64 upload to user's Inbox
- CSV export with full pricing columns

## Key Files

| File | Purpose |
|------|---------|
| `.claude/agents/admin.md` | Agent definition |
| `.claude/agents/memory/admin.md` | Persistent agent memory |
| `tools/kernel-admin-mcp.ts` | MCP server (7 tools) |
| `src/pages/AdminPage.tsx` | Admin dashboard UI |
| `src/engine/clientScoring.ts` | Score calculation + pricing |
| `supabase/functions/admin-invoice/` | Stripe invoice edge function |
| `supabase/functions/admin-send-file/` | File delivery edge function |
| `supabase/migrations/078_atomic_message_limit.sql` | Atomic rate limit RPC |

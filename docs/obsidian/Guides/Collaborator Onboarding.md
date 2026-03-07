---
tags: [kernel, guide, onboarding]
updated: "2026-03-06"
---

# Collaborator Onboarding

Welcome to the Kernel project. This guide gets you productive fast.

## Prerequisites

- Node.js 20+
- Git access to `isaacsight/kernel`
- Supabase CLI (`npx supabase`)

## Setup

```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel
npm install

# Copy env template and fill in secrets
cp .env.example .env
# Required: VITE_SUPABASE_URL, VITE_SUPABASE_KEY, SUPABASE_SERVICE_KEY
```

## Development

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # TypeScript check + Vite build
npx tsc --noEmit   # Type-check only (fast)
npm run deploy     # Build + deploy to GitHub Pages
```

## Project Structure

- **Frontend:** `src/` — React 19 + TypeScript
- **Backend:** `supabase/functions/` — Deno edge functions
- **CLI:** `packages/kbot/` — K:BOT terminal agent
- **Tools:** `tools/` — MCP servers, utilities, scripts
- **Migrations:** `supabase/migrations/` — Postgres schema

## Key Rules

1. **No Tailwind.** All CSS is vanilla with `ka-` prefix in `src/index.css`
2. **Hash router.** All routes are `/#/path` (GitHub Pages requirement)
3. **All AI calls through claude-proxy.** Never call Claude API directly from client
4. **Never commit `.env`, `.pem`, `.key` files**
5. **Run `npx tsc --noEmit` before every deploy**
6. **Edge functions deploy separately:**
   ```bash
   npx supabase functions deploy <name> --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
   ```

## Testing

```bash
npx vitest run     # Unit tests (420+ tests)
npx playwright test # E2E tests (28 tests, needs preview server)
```

## Useful Pages

- Live site: https://kernel.chat
- Pricing: https://kernel.chat/#/pricing
- API docs: https://kernel.chat/#/api-docs
- Terms: https://kernel.chat/#/terms

## Communication

- Supabase project ref: `eoxxpyixdieprsxlpwcs`
- Stripe account: Antigravity Group
- Email: api@kernel.chat

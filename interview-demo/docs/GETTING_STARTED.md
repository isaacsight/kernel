# Getting Started

Zero to running locally in ~10 minutes.

---

## Prerequisites

- **Node**: 22.x (use [nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- **pnpm**: 9.x (`npm i -g pnpm`)
- **Docker Desktop** (for local Supabase): running
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **Wrangler**: installed as a workspace dep; no global install needed

Optional but recommended:
- [Bun](https://bun.sh) 1.x for faster scripts
- [Biome](https://biomejs.dev) — via workspace dep
- [mkcert](https://github.com/FiloSottile/mkcert) — for local HTTPS if testing passkeys

---

## Clone + install

```bash
git clone git@github.com:yourname/setlist.git
cd setlist
nvm use                 # uses .nvmrc → Node 22
pnpm install
```

If `pnpm install` fails, likely a native dep. Try:

```bash
pnpm rebuild
```

---

## Env setup

```bash
cp .env.example .env.local
```

Fill in:

```
# Supabase (local — these are fine as-is for dev)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOi...  # from `supabase start` output
SUPABASE_SERVICE_KEY=eyJhbGciOi... # same

# Suno (for real testing; optional if using fake-suno)
SUNO_API_KEY=<your key>
SUNO_WEBHOOK_SECRET=<choose a random 32-char string>

# Storage (R2 or local Supabase Storage)
STORAGE_PROVIDER=supabase     # or 'r2' for prod-like
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=

# Observability (optional in dev)
AXIOM_TOKEN=
SENTRY_DSN=
```

---

## Start local services

Three terminals (or tmux panes — or just `pnpm dev` which runs all
three concurrently via `concurrently`).

### Terminal 1: Supabase (Postgres, Auth, Storage)

```bash
supabase start
# → Prints out SUPABASE_URL, anon key, service key. Copy to .env.local.
# → Migrations auto-apply from supabase/migrations/
# → Seed runs from supabase/seed.sql (one demo user, 3 tracks)
```

### Terminal 2: Edge API (Workers)

```bash
cd apps/edge
pnpm dev
# → wrangler dev at http://localhost:8787
# → Hot-reloads on file changes
```

### Terminal 3: Web (Vite)

```bash
cd apps/web
pnpm dev
# → Vite at http://localhost:5173
# → Hot-reloads on file changes
```

Or, all three:

```bash
pnpm dev         # runs supabase + edge + web concurrently
```

Open http://localhost:5173.

---

## Demo user

Seed creates:
- Email: `demo@test.setlist.app`
- Login: magic-link flow → click link in Supabase Studio's Inbucket
  (http://localhost:54324) to finish sign-in.

Or, faster, test-mode JWT:

```bash
pnpm --filter @setlist/edge test-token demo@test.setlist.app
# → prints a JWT you can paste in localStorage under "sb-access-token"
```

---

## Running without Suno

Local dev uses `fake-suno` by default — a mock Worker that generates
plausible fake audio (sine waves with envelopes, prompt-hashed so
same prompt → same output). Enable real Suno via:

```bash
# .env.local
USE_REAL_SUNO=true
SUNO_API_KEY=<key>
```

**Don't commit this flag change.** Real Suno calls cost real money.

---

## Commands

All from repo root:

```bash
pnpm dev              # run all services (supabase + edge + web)
pnpm build            # build everything
pnpm test             # unit + integration tests (Vitest)
pnpm test:watch       # vitest watch mode
pnpm test:e2e         # Playwright E2E (against localhost)
pnpm lint             # Biome
pnpm typecheck        # tsc --noEmit across workspaces
pnpm db:migrate       # apply migrations to local
pnpm db:reset         # reset local DB + re-seed
pnpm db:studio        # open Drizzle Studio at localhost:4983
pnpm db:generate      # generate migration from schema diff
```

---

## Monorepo layout

```
setlist/
├── apps/
│   ├── web/              # React 19 + Vite SPA
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   └── edge/             # Hono on Cloudflare Workers
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── ws/
│       │   └── index.ts
│       └── wrangler.toml
│
├── packages/
│   ├── shared/           # Types + zod schemas shared across apps
│   │   └── src/
│   ├── ui/               # React components, motion, tokens
│   │   ├── src/
│   │   │   ├── primitives/
│   │   │   ├── components/
│   │   │   ├── motion/
│   │   │   └── tokens/
│   │   └── .storybook/
│   ├── icons/            # Lucide + custom SVGs
│   └── tokens/           # Design tokens (TS → CSS)
│
├── supabase/
│   ├── migrations/
│   ├── functions/        # Edge functions (webhook handler, etc.)
│   └── seed.sql
│
├── tests/
│   ├── e2e/              # Playwright specs
│   ├── fixtures/         # Seed data, test audio clips
│   └── accessibility/
│
├── ops/
│   ├── runbooks/         # Incident, key rotation, etc.
│   └── dashboards/       # Grafana / Honeycomb JSON exports
│
├── docs/                 # ← you are here (documents everything)
├── specs/
├── interview/
│
├── .github/
│   ├── workflows/
│   └── PULL_REQUEST_TEMPLATE.md
├── .nvmrc                # node 22.11
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Common tasks

### Add a new API route

1. Define schema in `packages/shared/src/schemas/`.
2. Add Hono route in `apps/edge/src/routes/<resource>.ts`.
3. Wire into main router at `apps/edge/src/index.ts`.
4. Add integration test in `apps/edge/src/routes/<resource>.integration.test.ts`.
5. Regenerate OpenAPI: `pnpm --filter @setlist/edge openapi:gen`.
6. Add React Query wrapper in `apps/web/src/api/`.

### Add a new component

1. Create in `packages/ui/src/components/`.
2. Add Storybook story with all states (default, loading, empty,
   error, disabled).
3. Add test if logic beyond rendering.
4. Export from `packages/ui/src/index.ts`.
5. Use in `apps/web`.

### Add a new DB migration

1. Edit `supabase/schema.ts` (Drizzle schema).
2. `pnpm db:generate -n add_whatever`
3. Review generated SQL in `supabase/migrations/`.
4. Verify local applies: `pnpm db:reset && pnpm db:migrate`.
5. Add RLS tests for any new table.
6. PR.

---

## Troubleshooting

### "Supabase local failed to start"

- Docker Desktop running? `docker ps`.
- Ports 54321-54324 free? `lsof -i :54321`.
- Reset: `supabase stop && supabase start --reset`.

### "Cannot find module '@setlist/shared'"

- Run `pnpm install` from repo root.
- Check `pnpm-workspace.yaml` includes `packages/*`.

### "Wrangler: authentication failed"

Only affects *deploying*, not local dev. For local dev wrangler runs
without auth. For deploy, `wrangler login` or set `CF_API_TOKEN`.

### "E2E tests time out"

Likely Playwright browser not installed.
```bash
pnpm exec playwright install
```

### "My passkey doesn't work on localhost"

WebAuthn requires HTTPS except for `localhost`. For the localhost
exception to work in Safari, you may need to set the host to
`localhost` (not `127.0.0.1`). Also: different browsers store
passkeys differently — dev passkeys don't transfer.

### "Audio doesn't play on first click"

Safari autoplay policy. We handle this by requiring a user gesture
(click the play button) before any `audio.play()`. If this fires on
initial page load, something's wrong — don't try to autoplay.

### "My changes aren't showing"

- Vite HMR stuck? Hard refresh.
- Wrangler HMR stuck? Restart `pnpm dev` in `apps/edge`.
- Service worker caching? DevTools → Application → Service Workers →
  Unregister.

---

## Tips

- **Keyboard**: Cmd-K in the app opens the command palette. Faster
  than clicking for most actions.
- **DB**: `pnpm db:studio` is faster than using psql. Bookmark it.
- **Supabase Studio**: http://localhost:54323 — inspect tables,
  run SQL, view auth.
- **Inbucket** (local email): http://localhost:54324 — magic-link
  emails land here.
- **Bun** is optional but dramatically faster for scripts. If you have
  it, `bun run` anywhere works.

---

## Next steps

Once you're running:

- Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the big picture.
- Read [`specs/ROADMAP.md`](../specs/ROADMAP.md) for what to build
  next.
- Pick a ticket or open a PR for something on the roadmap.

If anything here is wrong or incomplete, fix it in a PR. Docs rot
fast — fixing them is as valuable as fixing code.

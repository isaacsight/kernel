# Deployment

Two apps, one pipeline. Web (Cloudflare Pages) + Edge API (Cloudflare
Workers). Data (Postgres) via Supabase / Neon. Observability via Axiom
+ Sentry.

---

## Environments

| Env | Purpose | URL | Data |
|---|---|---|---|
| `local` | Dev loop | `localhost:5173` + `localhost:8787` | Supabase CLI (local PG) |
| `preview` | Every PR | `pr-123.setlist.pages.dev` | Shared preview DB (Neon branch per PR) |
| `staging` | Mainline integration | `staging.setlist.app` | Isolated staging DB, mirrors prod schema |
| `prod` | Customers | `setlist.app` + `api.setlist.app` | Production DB |

---

## Infrastructure (prod)

```
                   Users
                     │
           ┌─────────▼──────────┐
           │  Cloudflare CDN    │ (global edge, DDoS, WAF)
           └────┬────────────┬──┘
                │            │
        static  │            │  API / WS
                ▼            ▼
        ┌─────────────┐  ┌──────────────────┐
        │ Pages       │  │ Workers          │
        │ (Vite build)│  │ (Hono)           │
        └─────────────┘  └────┬─────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
          ┌──────────┐  ┌──────────┐  ┌──────────┐
          │ R2       │  │ Postgres │  │ Suno API │
          │ (audio)  │  │ (Neon)   │  │          │
          └──────────┘  └──────────┘  └──────────┘
                              │
                              ▼
                        ┌──────────┐
                        │ Axiom +  │
                        │ Sentry   │
                        └──────────┘
```

---

## CI/CD

### Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (simplified)
on:
  pull_request: [opened, synchronize]
  push: { branches: [main] }

jobs:
  build:
    steps:
      - checkout
      - setup pnpm + node 22
      - pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm typecheck
      - pnpm test
      - pnpm build

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: build
    steps:
      - deploy web → cloudflare pages (preview)
      - deploy workers → wrangler (staging-{pr}-api)
      - provision neon branch (db clone for this PR)
      - run migrations
      - comment PR with preview URLs

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    steps:
      - deploy to staging env
      - run smoke tests
      - notify on fail

  deploy-prod:
    if: github.event_name == 'release'
    needs: [deploy-staging, e2e]
    steps:
      - run migrations (idempotent)
      - deploy workers
      - deploy pages
      - cache purge (selective)
      - announce in #deploys
```

### Release flow

1. PRs merge to `main` → auto-deploy to staging.
2. When staging passes E2E overnight run, engineer cuts a release
   via `gh release create`.
3. Release tag triggers prod deploy.
4. Prod deploy is **fully automated**; no human step besides cutting
   the tag.
5. Rollback is `gh release rollback`, which re-triggers deploy of
   the previous tag.

### Zero-downtime

- Workers: atomic deploys (new version globally within 30s, no
  downtime).
- Pages: atomic, previous assets served until new build ready.
- DB migrations: always forward-compatible (see Migrations below).

---

## Migrations

Rule: **migrations are forward-only and backward-compatible**. A
migration that deletes a column waits until all code that referenced
it has shipped.

### Workflow

```
1. Schema change drafted via Drizzle: pnpm db:generate
2. Reviewed as part of PR
3. Applied to preview env on preview deploy
4. Applied to staging on main merge
5. Applied to prod on release
```

### Expand/contract pattern

For destructive changes:
- **Expand** migration adds new column/structure.
- Code deploys reading/writing both old and new.
- **Backfill** migration (batch job if large).
- Code deploys reading/writing only new.
- **Contract** migration drops old (one release later).

Never collapse expand + contract. That's where downtime lives.

---

## Secrets

Managed via:
- Cloudflare Workers secrets: `wrangler secret put KEY`
- Supabase secrets: Supabase dashboard
- Local dev: Doppler (`doppler run -- pnpm dev`)

Secrets never in:
- Environment files committed to git
- Log output
- Error messages shown to users
- Client bundle

Scanning: Gitleaks pre-commit + CI. Trufflehog monthly scan of the
full repo history.

---

## DNS

Cloudflare for all DNS. Records:

| Record | Type | Value | Purpose |
|---|---|---|---|
| `setlist.app` | CNAME | cloudflare-pages | Web |
| `api.setlist.app` | CNAME | workers.dev | Edge API |
| `cdn.setlist.app` | CNAME | r2.cloudflarestorage | Audio CDN |
| `status.setlist.app` | CNAME | statuspage.io | Status |
| `docs.setlist.app` | CNAME | vercel | Docs site |

TTL: 300s production, 3600s for stable records.

---

## Cache strategy

### Static assets (Pages)

- Hashed filenames → `Cache-Control: public, max-age=31536000, immutable`
- `index.html` → `Cache-Control: public, max-age=60, s-maxage=60,
  must-revalidate`

### API responses

- Authed reads: `Cache-Control: private, no-cache`
- Public share: `Cache-Control: public, max-age=60, s-maxage=300` +
  `Stale-While-Revalidate: 3600`
- Audio files (R2): `Cache-Control: public, max-age=86400` (tracks
  are immutable once generated; different URL per version)

### Cache purge

- Deploys purge critical paths: `/`, `/api/v1/openapi`
- User-initiated changes that affect public URLs (making a playlist
  private) trigger targeted purge of `/p/<token>` via CF API.

---

## Scaling

### Current stance: grow vertically, shard late

- Workers scale horizontally by nature.
- Postgres: Neon autoscaling (vertical) + read replicas when needed.
- R2: infinite scaling, no-op.
- Suno: bottleneck is vendor quota — negotiate, don't self-scale.

### When to split

- Edge API: one Worker until it's > 10MB bundle or > 50 route groups.
- Postgres: add read replica when read QPS > 1000. Shard only if
  single table > 100M rows AND write QPS > 500.
- WebSocket: Durable Objects distribute naturally. No split needed
  until > 1M concurrent sessions.

---

## Observability

### Logging

- Structured JSON logs via `logfmt` → Axiom.
- Every log line: `trace_id`, `user_id` (hashed), `route`, `status`,
  `duration_ms`.
- Log levels: `debug` (not shipped), `info`, `warn`, `error`.

### Tracing

- OpenTelemetry SDK in every Worker.
- Traces exported to Axiom via their OTel endpoint.
- Browser RUM: Web Vitals + custom spans → Sentry.

### Metrics

Key metrics:
- API p50 / p95 / p99 per route
- Generation latency histogram
- WebSocket reconnect rate
- Rate of 4xx / 5xx per route
- Queue depth (generations in `queued`)
- Suno upstream latency

### Alerts

PagerDuty. Tuned, not noisy.

| Alert | Threshold | Action |
|---|---|---|
| 5xx rate | > 1% for 5 min | Page on-call |
| Generation failure rate | > 5% for 10 min | Page on-call |
| Suno upstream down | any failure for 2 min | Page on-call |
| DB CPU | > 80% for 10 min | Page on-call |
| WS disconnect spike | > 3× baseline | Slack |

No email-only alerts. Email is for reports, not incidents.

---

## Disaster recovery

| Disaster | RTO | RPO | Recovery |
|---|---|---|---|
| Worker region down | 0 | 0 | CF failover, automatic |
| Supabase/Neon down | 30 min | 5 min | Switch to read-only + DB failover |
| R2 down | 5 min | 0 | Failback to Supabase Storage |
| Suno down | persistent until Suno | 0 | Queue requests, show banner |
| Full account compromise | 4 hours | 1 hour | Rotate all secrets, restore from backup |

**Backups**:
- Neon: PITR to 7 days, daily snapshot to S3 (cross-region).
- R2: versioning enabled, 30-day soft-delete.
- Supabase Storage (fallback): weekly cold export.

**Tested**: quarterly DR drill restores a backup to a shadow env,
verifies integrity.

---

## Cost model (rough, prod at ~10k MAU)

| Item | Monthly |
|---|---|
| Workers requests (100M) | $30 |
| Pages bandwidth (500 GB) | $0 (free tier generous) |
| R2 storage (1 TB) + egress | $15 |
| Neon Postgres (scale plan) | $50 |
| Axiom logs (200 GB/mo) | $50 |
| Sentry | $26 |
| Suno API | **variable, $$$$$** |
| Misc (Doppler, GitHub, ...) | $30 |
| **Non-AI total** | **~$200** |

AI is the dominant cost. All optimization energy on the generation
pipeline (prompt compression, cache, quotas) pays down this line.

---

## Day-in-the-life deploy

1. Engineer opens PR → CI runs → preview env live in 5 min
2. Reviewer approves → merge to `main` → staging deploys auto in 3
   min
3. E2E runs on staging overnight
4. Engineer cuts release tag `v2026.04.23-01` → prod deploys in 4
   min
5. Slack `#deploys` channel gets a post:
   ```
   🚀 v2026.04.23-01 deployed to prod
   — PRs #1234, #1237
   — Migrations: 202604-add-shares
   — Rollback: gh release rollback v2026.04.22-02
   ```
6. Sentry + Axiom watched for 30 min post-deploy.

---

## Rollback

```bash
gh release rollback v2026.04.22-02
```

Re-deploys the previous release across Workers + Pages atomically.
DB migrations don't roll back (they're forward-compatible by design
— see Migrations).

If a migration *is* the bug, we push a forward-fix migration, not a
rollback.

---

## The philosophy

Deploys should be boring. Boring = frequent, atomic, observable,
reversible. Excitement in deploys is a sign of something wrong.

Ship on Fridays. If you can't ship on Fridays, the pipeline isn't
trustworthy enough.

# Observability

You cannot improve what you cannot see. Logs, metrics, traces.
One pipeline, three views.

---

## Stack

- **OpenTelemetry** SDK in browser + Workers + webhook handler
- **Axiom** for logs + OTel traces (cheap, edge-friendly)
- **Sentry** for errors + performance + session replay
- **Custom RUM beacon** for Web Vitals + domain metrics

---

## Logs

### Format

Structured JSON. Every log line includes:

```json
{
  "ts": "2026-04-23T15:22:00.123Z",
  "level": "info",
  "msg": "generation.complete",
  "trace_id": "01JQ...",
  "span_id": "abc1...",
  "user_id": "hashed-or-null",
  "route": "/api/v1/generate",
  "duration_ms": 245,
  "status": 202,
  "region": "iad",
  "request_id": "cf-xxx"
}
```

### Levels

- `debug`: only shipped in dev
- `info`: request lifecycle, state transitions
- `warn`: degraded behavior (retry, slow upstream)
- `error`: unrecoverable at the request level
- `fatal`: service-level failure (rare, paged)

### What NOT to log

- Passwords, tokens, API keys (redacted automatically)
- Full user emails (`u***@d***.com` only)
- Full prompts (sensitive creative content)
- Audio URLs (contain signing tokens)
- PII in any form

### Retention

- 30 days hot (Axiom)
- 90 days cold (S3 archive)
- Longer only with explicit legal/compliance need

---

## Traces

### Spans

Every request is a trace. Each trace has spans for:

- HTTP handler
- DB queries (one span per query)
- Suno API calls
- WebSocket message handling
- Webhook processing
- External service calls

### Span attributes

```
http.method, http.status_code, http.route
db.statement (parameterized, truncated)
suno.job_id
ws.message.type
user.id (hashed)
generation.id
error (if set)
```

### Propagation

W3C Trace Context (`traceparent` header) propagated from browser →
edge API → Supabase client → Suno client (where supported). Enables
"where did 3 seconds go?" questions with one query.

### Example trace

```
POST /api/v1/generate                       [245ms]
├─ auth.verify_jwt                          [  3ms]
├─ rate_limit.check                         [  5ms]
├─ db.insert_generation                     [ 18ms]
├─ suno.create_job                          [195ms]
│  └─ fetch https://api.suno.com/generate   [193ms]
└─ db.update_generation_status              [ 15ms]
```

If that 245ms blows the budget, the culprit is obvious.

---

## Metrics

### RED method (per route)

- **Rate**: requests/sec
- **Errors**: 4xx/5xx rate
- **Duration**: p50, p95, p99 latency

### USE method (per resource)

- **Utilization**: CPU, memory, concurrency
- **Saturation**: queue depth, connection pool
- **Errors**: DB errors, network errors

### Domain metrics

- Generations started/hour
- Generations completed/hour
- Generations failed (with reason)
- Average tokens/generation
- Average generation duration
- Suno API cost/hour
- Active users/day
- Tracks created/day
- Shares created/day
- Share views/day (anon + authed)

---

## Web Vitals (RUM)

Beacon on every session, sampled 10% (100% for known-slow routes).

```ts
// apps/web/src/lib/rum.ts
import { onLCP, onCLS, onINP, onFCP, onTTFB } from 'web-vitals';

const report = (metric: Metric) => {
  navigator.sendBeacon('/api/v1/rum', JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    route: window.location.pathname,
    deviceClass: detectDeviceClass(),
    network: navigator.connection?.effectiveType,
  }));
};

onLCP(report);
onCLS(report);
onINP(report);
onFCP(report);
onTTFB(report);
```

### Custom timers

```ts
performance.mark('generation.prompt-submit');
// ...
performance.mark('generation.first-sound');
performance.measure('generation.prompt-to-sound', 'generation.prompt-submit', 'generation.first-sound');
```

Reported to the same RUM beacon. Graphed as a histogram per day.

---

## Dashboards

### Ops dashboard (live)

One screen, real-time:
- Request rate + error rate (last hour)
- p95 latency by route
- Generation queue depth
- Suno upstream latency
- Active WebSocket sessions
- Top 5 slowest spans in last 10 min

### Business dashboard (daily)

- DAU / MAU
- Generations/day, tracks created, shares
- Retention cohorts
- Revenue (from Stripe, if applicable)
- Content moderation review queue depth

### Perf dashboard (daily)

- Web Vitals histogram (LCP, CLS, INP) by device class
- Time-to-first-sound histogram
- API p95 trend (7-day rolling)
- Bundle size trend

Each dashboard has a named URL. Link in Slack on every deploy.

---

## Alerting

### Principles

- Alert on symptoms (user-visible) not causes (internal).
- Every alert has a runbook linked.
- Every alert has a "why now?" — what changed that made this
  threshold meaningful?
- Noisy alerts get killed within 48h. Either fix the cause or raise
  the threshold.

### Channels

- **PagerDuty** for urgency >= sev2 (5xx rate, upstream down)
- **Slack #alerts** for sev3 (degradations, anomalies)
- **Email daily digest** for trend shifts (retention drop, cost
  spike)

### Alert list

| Symptom | Sev | Action |
|---|---|---|
| 5xx rate > 1% for 5min | 1 | Page |
| Gen failure > 5% for 10min | 2 | Page |
| Suno API down 2+ min | 2 | Page + banner |
| DB CPU > 80% for 10min | 2 | Page |
| Auth failure spike (IP) | 3 | Slack |
| RUM LCP p95 regression 300ms+ | 3 | Slack |
| Bundle size grew 20%+ | 4 | Email daily digest |
| Suno cost 3σ above baseline | 2 | Page (runaway) |

---

## Runbooks

Each alert links to a runbook in `ops/runbooks/`. Template:

```md
# Runbook: Suno API down

## Symptoms
- /generate returning 502 UPSTREAM_FAILURE
- Suno upstream latency metric spiking

## Immediate actions (in order)
1. Check Suno status page: https://...
2. Confirm via direct curl: `curl -H "..." https://api.suno.com/health`
3. If confirmed down:
   a. Flip feature flag `generation.enabled = false`
   b. Post banner: "Generation paused — we'll let you know when it's back"
   c. Post in #incidents
4. If NOT confirmed down:
   a. Check our Suno API key isn't expired
   b. Check rate limit
   c. Proceed to deeper debug

## Communication
- Status page: statuspage.io (update within 5 min)
- Users: banner + queued emails on resolution
- Internal: #incidents channel

## Post-incident
- Write postmortem within 5 business days
- File "improve detection" ticket if alert fired >10 min after user impact
```

---

## Cost

Observability isn't free. Budget:

- Logs: $50/mo at 10k MAU (Axiom)
- Traces: included with logs tier
- Sentry: $26/mo base + quota
- RUM beacon: self-hosted, ~0 cost

Total ~$100/mo pre-scale. Scales linearly.

The worst cost mistake: logging `debug` in production. Enforce in
CI.

---

## Development

Local observability:
- `pnpm dev` streams all service logs via `concurrently` with
  color-coded prefixes.
- Jaeger UI locally (Docker) shows OTel traces.
- Sentry mirrored to a separate dev project.

Debug flags:
- `?debug=1` in URL enables verbose client logging + unminified
  errors.
- `X-Debug: 1` header on API requests enables verbose span logging
  server-side (authed + staff-only).

---

## The signal-to-noise discipline

A dashboard with 50 widgets is a dashboard nobody reads. Every
dashboard has:
- ≤ 10 widgets.
- A headline metric at the top.
- Sparklines (trend) + absolutes (current value).
- A "what to do" note under each widget: "if this is red, check X."

Alerts that fire without being acted on get deleted. No exceptions.
An alert is a promise to act.

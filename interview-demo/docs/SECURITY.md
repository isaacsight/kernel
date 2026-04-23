# Security

Defense in depth. Every boundary validates. User trust is a product
feature, not a compliance checkbox.

---

## Threat model

Who attacks, how, what's at stake.

| Actor | Motive | Attack vector | What they want |
|---|---|---|---|
| Opportunistic crawler | Spam, enumeration | Public endpoints, share tokens | Valid user list, usable tokens |
| Abuse account | Free generation | Burner signups, automation | Generation capacity (= Suno $) |
| Copyright scammer | False DMCA, scraping | Public share links, account takeover | Content for resale / takedown extortion |
| Targeted attacker | Individual user | Credential stuffing, session hijack | Specific user's data |
| Insider | — | Service-role key exposure | Full data access |

Non-threats (out of scope for this demo):
- Nation-state APT
- Physical access to infrastructure
- Quantum-era crypto breaks

---

## Auth

### Primary: passkey (WebAuthn)

Supabase Auth handles registration + assertion. Credentials are
domain-bound → phishing-resistant by construction.

### Fallback: magic link

Email-gated, 10-min TTL, single-use. Rate-limited per email and per IP.

### Secondary: Google OAuth

For users who refuse passkeys and don't want to wait for email.

### Session

- JWTs, 1-hour TTL.
- Refresh token, 30-day TTL, httpOnly + Secure + SameSite=Lax cookie.
- Revocation list in Redis for mid-session logout (rare but supported).

### No passwords

Period. No password creation, no password reset flow. Reduces the
attack surface by the size of an ocean.

---

## Authorization

Two layers, always:

1. **Row-Level Security (RLS)** — last line in Postgres. Every
   user-owned table has policies; the service role is the only key
   that bypasses them.
2. **Edge API checks** — belt-and-braces. Every mutating route
   re-verifies ownership server-side with the user's JWT before
   issuing the DB query.

### Why both?

- RLS alone fails if an engineer forgets to enable it on a new table,
  or if a bug exposes the service role key to a user.
- API checks alone fail if someone queries the DB directly (e.g., via
  a compromised Supabase anon key in client code).

Defense in depth is cheap. Single points of security are cheap until
they aren't.

---

## Secrets management

### Production

- Cloudflare Workers secrets (encrypted at rest by CF, decrypted in
  Worker runtime).
- Supabase service-role key: only in Workers, never in browser, never
  in logs.
- Suno API key: only in Workers.
- JWT signing key: shared with Supabase; rotated via Supabase dashboard.

### Development

- Doppler for local secret distribution (team of 1-20).
- `.env.local` NOT committed — in `.gitignore` + gitleaks in CI.
- Pre-commit hook scans for secrets (trufflehog).

### Incident: key leak

Runbook lives in `/ops/runbooks/key-rotation.md`. Steps:
1. Revoke compromised key at provider.
2. Rotate via Doppler or CF dashboard.
3. Verify rotation by hitting `/health/secrets` endpoint (returns
   masked fingerprint of currently-loaded keys).
4. Audit access logs for 48h around leak window.
5. If customer data potentially accessed: disclosure workflow.

---

## Input validation

Every route validates with a Zod/Valibot schema. Invalid input → 400
with validation error. No "let it through and see what happens."

Examples of what we validate, beyond obvious types:

- `prompt`: length 1-2000 chars, UTF-8 only, no control chars except
  newline/tab.
- `duration_sec`: 5-300 integer.
- `style_tags`: array max 10, each 1-32 chars, alphanumeric + hyphen.
- `title`: 1-200 chars, stripped of HTML.
- `token` (share): 22 char URL-safe alphabet.

Validation happens **at the route edge**, before anything else —
before DB, before Suno, before logging the request.

---

## Content moderation

Prompts can contain anything. Some prompts → copyrighted output, some
→ harmful content.

### Layers

1. **Input classifier** (pre-Suno): prompt runs through a small
   classifier (OpenAI Moderation or equivalent). High-confidence
   abusive prompts → refused with a generic "that didn't work"
   message. Never reveal classifier reasoning to avoid prompt-injection
   evasion.
2. **Output scan** (post-Suno): generated audio optionally run through
   a similarity check against a rights database (ContentID-style).
   Matches → track marked not-shareable, creator notified.
3. **User reporting**: every public share link has a "report" link.
   Reports queue in Supabase for moderation review.
4. **Shadow-ban list**: users flagged via reports get reduced
   generation throughput + no-public-sharing. Not a hard ban — reduces
   retry-until-success spam.

### Non-goals

- Perfect detection. Impossible, don't promise.
- Real-time human moderation. Queue + async.

---

## Rate limiting + quotas

Two different things. Rate limiting = short-window burst protection.
Quota = long-window fairness.

### Rate limits

Enforced at Cloudflare edge, keyed on `user_id` (authed) or IP (anon).
See [`API.md`](./API.md) for the full table.

### Quotas

Enforced in Postgres on a running counter per user per calendar
month. Generation counter increments on *accepted* generations (not
on failures). Reset trigger runs monthly.

### Abuse signals → feedback loop

- 10+ failed auth in 5 min → temp IP block.
- 50+ generations in 1h (should not be possible given rate limit,
  but if it is) → account freeze, manual review.
- Share token enumeration pattern (many 404s to `/share/:token` in
  short window) → IP block + alert.

---

## Supply chain

- `pnpm audit` in CI, fails on high-severity.
- Renovate bot proposes dep updates weekly.
- No dep with fewer than 10 stars + 3 months of history added without
  engineer + security review.
- Lockfile committed and enforced (`--frozen-lockfile` in CI).
- `pnpm-workspace.yaml` pins workspace versions.
- Native deps audited at install — why do we need this Node addon?

---

## SSRF, XXE, SQLi, XSS (the classics)

### SSRF

`fetch` in Workers can only hit external URLs. Before any server-side
fetch to a user-provided URL:
1. Resolve via DNS.
2. Check resolved IP against RFC 1918 + loopback + link-local.
3. Deny if private.

The one user-provided URL path in this demo is the webhook callback
URL (if we ever expose one for plugins) — treat with same caution.

### XXE

We don't parse XML. If we ever need to, use a parser with
`resolveExternals: false`.

### SQL injection

Drizzle + postgres.js use parameterized queries by construction. No
string concatenation for SQL. Code review rule: any `.sql\`...\``
template must use placeholder interpolation, never string interp.

### XSS

- React escapes by default.
- `dangerouslySetInnerHTML` is forbidden without security review.
- User-generated content (titles, descriptions, prompts) rendered as
  text, never HTML.
- CSP header (see below) kills most exploit chains.

---

## Headers

All responses:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://cdn.setlist.app;
  connect-src 'self' https://api.setlist.app wss://api.setlist.app;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

CSP in report-only first (1 week), then enforcement. Monitors via
CSP reporting endpoint.

---

## Storage (R2)

- Tracks: signed URLs for private, public URLs for public.
- Signed URLs expire in 24h. Client re-fetches on demand.
- Bucket policy: no public list, only object-level access.
- No user-upload directly to R2 (v1). If we add it, pre-signed POST
  with content-type whitelist.

---

## Share tokens

- 22 chars, URL-safe alphabet = 128 bits entropy. Unguessable.
- Stored hashed in DB (SHA-256) — raw token never re-derivable from
  the DB, so a DB leak doesn't expose active share URLs.
- Tokens have explicit `revoked_at` column; lookup checks it.
- Rate limiting on `/share/:token` prevents enumeration.

---

## Logging and PII

- No PII in logs. Redact emails (`user@domain.com` → `u***@d***.com`
  in log format).
- No prompts in info-level logs. Prompts are sometimes sensitive.
- No audio URLs in logs (they contain signing tokens).
- Trace IDs are logged and exposed to users; everything else is
  internal.
- Retention: 30 days hot, 90 days cold. Purge beyond.

---

## Third-party auditing

- `npm audit` + Snyk weekly.
- DependencyTrack or equivalent SBOM tracking.
- Annual pentest when revenue justifies.
- Bug bounty via HackerOne or similar once product is public.

---

## Privacy

- Data collected: email, generation count, tracks the user creates.
  That's it. No tracking beyond the app's own events (which are
  opt-in for analytics).
- No third-party trackers on authed pages. Marketing page (if any)
  is a separate app with its own consent flow.
- GDPR data export via self-serve settings page. Export is a zip
  of the user's tracks + metadata.
- Deletion: self-serve, 30-day soft-delete window, then hard purge.

---

## Observability as security

Security events feed the same OTel/Axiom pipeline as perf. Alerts:

- Auth failures > 10/min from one IP.
- Share token 404s > 30/min from one IP.
- Unusual service-role-key usage patterns (should be constant and
  low).
- Webhook signature failures > 1/hour.
- RLS policy test failures in CI.

Alerts go to on-call via PagerDuty.

---

## Security review gates

A PR merges only if:

1. No secrets in diff (gitleaks).
2. No new `dangerouslySetInnerHTML`.
3. No new unvalidated fetch to user-provided URL.
4. No RLS disabled.
5. No new route missing auth (unless explicitly in the
   allowlist).
6. Schema migrations don't drop RLS or soften policies without
   review.

Template: `.github/PULL_REQUEST_TEMPLATE.md` includes "Security
review needed?" — any answer other than "no, trivial" requires
second approval.

---

## If it all goes wrong (incident runbook)

1. **Detect** (alert, user report, external disclosure).
2. **Contain** — revoke keys, disable affected endpoints, rate-limit
   harder.
3. **Eradicate** — patch, rotate, reset.
4. **Recover** — bring services back, verify health.
5. **Learn** — postmortem within 5 business days, public disclosure
   if users affected.

Runbook lives at `/ops/runbooks/incident.md`. Tabletop exercises
quarterly.

---

## The user-facing side of security

Security is also UX.

- **Show signed-in sessions** — let users revoke sessions they don't
  recognize.
- **Email on suspicious auth** — new device, new country. Don't lock
  the account; inform the user.
- **Tell the truth in errors** — "something's wrong on our side" not
  "system unavailable (code 42-X)".
- **Respect the user's time** — don't 2FA every action; session trust
  decays gradually.
- **Don't hide behind legalese** — privacy policy is plain English.

A product users trust is a product users stay in. Trust is built in
invisible details; it's lost in one visible mistake.

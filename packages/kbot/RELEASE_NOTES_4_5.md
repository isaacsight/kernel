# kbot v4.5.0 — Audit-Grade Financial Infrastructure (`@kernel.chat/kbot-finance`)

**Release date:** 2026-05-10
**Headline:** First open-source AI agent that ships content-addressed envelopes, a hash-chained audit log, and a jurisdiction-aware regulatory verifier as first-class skills. Bloomberg ASKB validated the pattern in February; nobody open-sourced it. kbot 4.5.0 does.

---

## tl;dr

A new sibling package — `packages/kbot-finance/` — lands as the substrate for an AI Intelligence Layer that **never produces a financial number itself**. Numbers come from deterministic engines wrapped in content-addressed envelopes. Every step is logged in a hash-chained append-only audit log. Every action passes a regulatory verifier (rules-as-code, jurisdiction-aware) before reaching the engine.

kbot's tool registry picks up two new skills via a single `registerKbotFinanceTools(registerTool)` call in `swarm-2026-04.ts`:

- **`polymarket_query`** — read-only Polymarket prediction-market data via Gamma API, wrapped in the full envelope + verifier + audit pipeline.
- **`audit_log_verify`** — hash-chain integrity check over the on-disk audit log.

Substrate-deep on purpose. The two tools are the *first* of a family — QuantLib pricing, NautilusTrader execution, alts-NAV, and EU AI Act Annex IV exporters slot into the same shape without further kbot edits.

License split is deliberate: kbot core stays MIT. `@kernel.chat/kbot-finance` is Apache 2.0 — the Aeron / PyKX pattern for an open-core + commercial-premium path on the compliance side.

---

## Why this exists

Five strategic facts decided the shape:

1. **Bloomberg ASKB shipped this architectural pattern Feb 23, 2026** — agent emits BQL code, the BQL engine produces the number. Closed, terminal-only. No published spec.
2. **EU AI Act high-risk obligations bite Aug 2, 2026** (possibly deferred to Dec 2027 by the May 7 Council/Parliament agreement). Federal Reserve SR 26-02 (Apr 17, 2026) supersedes SR 11-7. FINRA's 2026 ROR named GenAI as exam priority. Audit substrates are now compliance artifacts, not nice-to-haves.
3. **No open-source AI agent occupies this slot.** Palantir AIP is closed. Bloomberg ASKB is closed. Hebbia/AlphaSense/Rogo sit above the substrate. The infrastructure layer is publicly unoccupied.
4. **Polymarket is the cleanest proving harness.** Settlement-deterministic, public API, no data licensing, CFTC-supervised since Nov 2025. Audit primitives are free because the chain provides them.
5. **The 12-18 month window** between "Bloomberg validates the pattern" (done) and "first nine-figure AI enforcement action lands" (H2 2026 – H1 2027) closes after the spec freezes around whoever shipped first.

This release ships first.

---

## What landed

### `packages/kbot-finance/` — new sibling package (Apache 2.0)

Self-contained subdirectory. Replit-importable. Node 22+. 16 source files, 6 test files, 38 tests (35 unit + 3 live against real Gamma).

```
packages/kbot-finance/
├── .replit                       # Replit auto-config: install + run demo
├── replit.nix                    # Node 22 + TS + tsx
├── LICENSE                       # Apache 2.0
├── README.md
├── src/
│   ├── envelope.ts               # canonical JSON + SHA-256 + sealEnvelope()
│   ├── audit-log.ts              # hash-chained append-only log + verify()
│   ├── governance.ts             # HMAC-signed material-gate approval tokens
│   ├── verifier/
│   │   ├── index.ts              # Rule + VerifierContext + runVerifier()
│   │   ├── position-limit.ts     # Pre-trade size + notional caps (Rule 15c3-5 echo)
│   │   └── kelly-cap.ts          # Half-Kelly position-sizing cap
│   ├── adapters/polymarket/      # Read-only Gamma client; never throws across boundary
│   ├── tools/polymarket-query.ts # The full wiring: verifier → audit → engine → seal → audit
│   ├── kbot-tool.ts              # kbot ToolDefinition surface for registry import
│   ├── demo.ts                   # End-to-end script run on Replit first-launch
│   └── index.ts                  # Public surface
└── test/                         # vitest, isolated config (own vitest.config.ts)
```

### Content-addressed envelopes (`envelope.ts`)

The load-bearing primitive. Every engine call resolves to a SHA-256 hash over RFC-8785-style canonicalized inputs — sorted keys, recursive, refuses non-finite numbers. Identical hash → identical engine result, byte-for-byte (when the engine is deterministic). The AI cannot produce a number; it can only request one inside an envelope.

Companion: `sealEnvelope()` wraps the engine call, computes the hash, and emits a response envelope with `byte_identical_replayable` as an honesty primitive — false when running through live HTTPS (Gamma) or non-deterministic hardware (GPU inference). Truthful determinism claims only.

### Hash-chained append-only audit log (`audit-log.ts`)

Every entry includes its predecessor's hash. Tampering with any entry invalidates every subsequent entry. `AppendOnlyAuditLog.verify(path)` walks the chain and returns either `ok` or the broken sequence number. Concurrent appends serialize through a promise-chain lock so multi-tool sessions don't fork the chain.

Storage in v0.1 is JSONL for inspectability. Production deployments override `KBOT_FINANCE_AUDIT_LOG` to point at WORM-mounted storage (S3 Object Lock, immudb, Aeron log). API stays the same.

### Regulatory verifier (`verifier/`)

Norm-AI-pattern rules-as-code. Pure functions over `(action, context)`. Two production rules ship:

- **`rule.position_limit`** — Rule 15c3-5 echo. Emits `POSITION_SIZE_EXCEEDED` / `POSITION_NOTIONAL_EXCEEDED` adverse-action codes.
- **`rule.kelly_cap`** — half-Kelly position-sizing cap. Requires the agent to declare `edge_probability` + `payoff_b` for any trade-shaped action. Refuses negative-edge bets; refuses notionals above the configured Kelly fraction.

Jurisdiction-aware: rules declare which of `US | EU | UK | SG | HK | UAE | GLOBAL` they apply to. `runVerifier()` filters by jurisdiction + matching operations, runs *every* applicable rule (no short-circuit — audit logs record the full evaluation), returns a structured `VerifierReport`.

### Material-gate approval (`governance.ts`)

HMAC-signed approval tokens bound to the exact `request_hash + materiality + summary` the approver saw. Signature is verified via `timingSafeEqual`. Replay against a different request rejects with reason code. v0.2 swaps HMAC for Ed25519 so approvers can sign offline.

### Polymarket adapter (`adapters/polymarket/`)

Read-only Gamma API client. Discriminated-union outcomes (`{ok: true, value} | {ok: false, error}`), never throws across the adapter boundary — same pattern as the Peekaboo adapter that landed in 4.4.0. Five files: `types.ts`, `client.ts`, `commands.ts`, `index.ts`.

Coverage: `listMarkets`, `getMarket`, `listEvents`, plus `decodeOutcomes` / `decodeOutcomePrices` to parse Gamma's JSON-encoded outcome arrays. No trading / signing / order placement in v0.1 — that lands in v0.2 with the Polygon signing path and gated by the material-gate approval substrate.

### The wiring tool (`tools/polymarket-query.ts`)

Wires all layers for one operation. The reference shape every future kbot-finance tool follows:

1. Build the content-addressed request envelope
2. Run the regulatory verifier (informational ops still get audited)
3. Log the verifier check
4. Call the engine adapter
5. Seal the response into an envelope with `request_hash`
6. Log the engine request + engine response

Returns `{ok: true, response} | {ok: false, stage, detail}` — never throws.

### kbot registry surface (`kbot-tool.ts`)

Exports `kbotFinanceTools: readonly KbotToolDefinition[]` and `registerKbotFinanceTools(register)`. Type-compatible with kbot's `ToolDefinition` (`tier: 'free' | 'pro' | 'growth' | 'enterprise'`). Lazy singleton for the audit log so a single kbot run keeps a coherent hash chain across multiple tool calls.

### Four new kbot tools in the registry

| Tool | Tier | What it does |
|---|---|---|
| `polymarket_query` | free | `{ mode: 'list_active' \| 'by_id', market_id?, limit?, jurisdiction? }` → content-addressed Polymarket markets + audit trace |
| `edgar_query` | free | `{ mode: 'submissions' \| 'company_facts', cik, limit?, jurisdiction? }` → SEC EDGAR filings/XBRL facts with accession-number content addressing |
| `annex_iv_export` | free | `{ audit_log_path?, output_path?, system_name?, deployer?, jurisdiction? }` → EU AI Act Annex IV technical-documentation markdown bundle from the audit log |
| `audit_log_verify` | free | `{ path? }` → hash-chain integrity check on the audit log |

Plus an **MCP server** (`npx @kernel.chat/kbot-finance mcp`) that exposes the same tools over stdio MCP — Claude Code, Cursor, Claude.ai connectors, Replit Agent, or any other MCP client can use the same audit substrate without going through kbot.

### Wiring into kbot (`swarm-2026-04.ts`)

Three lines added, total:

```diff
+ "@kernel.chat/kbot-finance": "file:../kbot-finance",      // package.json
```
```diff
+ import { registerKbotFinanceTools } from '@kernel.chat/kbot-finance/kbot-tool'
  // …
+ registerKbotFinanceTools(registerTool)
```

`file:` link resolves at install time. kbot's existing tool middleware (timeouts, truncation, metrics, telemetry, fallback rules) applies to the new tools without further configuration.

### Replit-importable

`.replit` + `replit.nix` configure Node 22, TypeScript, tsx. First-run on Replit:

1. `npm install` — picks up the package
2. `npm run demo` — runs the end-to-end demo against live Gamma API, prints the audit log, verifies the hash chain

No keys, no setup. Public API only. Anyone can clone and see the architecture demonstrate itself in 30 seconds.

---

## Untouched (deliberately)

- **No trading.** Read-only Polymarket adapter. The `polymarket_propose_or_dispute` and `polymarket_maker` tools — flagged as the durable AI roles by the May 10 substrate research — are v0.2.
- **No CRlibm / deterministic floating-point.** Lands with the QuantLib pricing adapter in v0.2 when bit-identical replay becomes load-bearing.
- **No on-chain replay primitives.** Goldsky / The Graph subgraph integration for block-pinned replay is v0.3. v0.1 honestly emits `byte_identical_replayable: false` against live HTTPS.
- **No MCP server wrapper.** v0.2 ships an MCP server that exposes `polymarket_query` to any MCP client (Claude Code, Cursor, kbot core). For now, kbot is the consumer.
- **No alts-CDM schema.** The durable wedge — designed next.
- **kbot core MIT license.** kbot-finance is Apache 2.0; kbot's tool registry imports it without taking on Apache obligations (downstream linker exception).
- **Default behavior of kbot.** A user who never invokes `polymarket_query` sees zero change. No new env vars required. No new permissions prompted. The audit log directory is created lazily on first use.

---

## Tests

- **+38 tests** in this hop (kbot-finance package):
  - `test/envelope.test.ts` — 10 tests (canonical JSON, hash determinism, key-order independence, seal envelope)
  - `test/audit-log.test.ts` — 6 tests (genesis hash, chain linkage, reopen resume, tamper detection, concurrent-append serialization)
  - `test/verifier.test.ts` — 9 tests (rule firing, adverse-action codes, jurisdiction filtering, Kelly math)
  - `test/governance.test.ts` — 5 tests (approval signing, request-hash binding, unknown approver, secret rotation, forged signature)
  - `test/kbot-tool.test.ts` — 5 tests (registry surface, never-throw contract, input validation, audit verify on fresh log)
  - `test/polymarket.live.test.ts` — **3 live tests against real Gamma API** (`describe.skipIf(KBOT_FINANCE_OFFLINE=1)`)
- `npm run test:live` — green against `https://gamma-api.polymarket.com`
- `npx tsc --noEmit` in kbot — green after wiring; zero new errors
- `npx vitest run src/tools/peekaboo.test.ts` — **12/12** in kbot post-wiring (no regression)
- `npm run demo` in kbot-finance — green: request_hash f8553372…, 4 audit entries, hash chain INTACT

---

## Architecture (one diagram)

```
┌──────────────────────────────────────────────────────────────────┐
│  kbot (AI Intelligence Layer)  invokes polymarket_query          │
└─────────────┬────────────────────────────────────────────────────┘
              │ content-addressed request envelope
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Regulatory Verifier  (rules-as-code, jurisdiction-aware)         │
└─────────────┬────────────────────────────────────────────────────┘
              │ pass / adverse-action reason code
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Material-Gate Approval  (signed token, if action is material)    │
└─────────────┬────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Deterministic Engine Adapter  (Polymarket Gamma in v0.1)         │
└─────────────┬────────────────────────────────────────────────────┘
              │ sealed envelope: { request_hash, engine_version, value, ... }
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Hash-Chained Audit Log  (~/.kbot/audit/polymarket.jsonl)         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Operator configuration

All optional. Defaults sized for development.

| Env var | Default | Purpose |
|---|---|---|
| `KBOT_FINANCE_AUDIT_LOG` | `~/.kbot/audit/polymarket.jsonl` | Override the audit log path (point at WORM storage in prod) |
| `KBOT_FINANCE_MAX_SIZE` | `10000` | Per-action max position size (position-limit rule) |
| `KBOT_FINANCE_MAX_NOTIONAL` | `50000` | Per-action max notional (position-limit rule) |
| `KBOT_FINANCE_KELLY_FRACTION` | `0.5` | Fraction of full Kelly allowed (half-Kelly default) |
| `KBOT_FINANCE_BANKROLL` | `100000` | Bankroll the Kelly cap computes against |
| `KBOT_FINANCE_OFFLINE` | unset | When `1`, live-smoke tests skip — for CI without network |

---

## Scope notes

The original three-item plan included an MCP server wrapper and an alts-CDM schema design. Both got bumped to v4.6.0 / v0.2 of kbot-finance — the Polymarket wedge proved more compelling as the v0.1 substrate than the alts-CDM design after the May 10 research pass surfaced ICE's $2B Polymarket investment and the BQL-emission architectural signal from Bloomberg ASKB. The reshape is documented in `SCRATCHPAD.md` for the May 10 session.

The license split (kbot MIT, kbot-finance Apache 2.0) was settled in the strategic review: Aeron / PyKX dual-shape — open core, commercial premium for SOC 2 / hosted replay-retention / certified determinism. AGPL was considered and rejected — slows tier-1 bank adoption.

---

## What's next (v4.6.0 / kbot-finance v0.2)

- **QuantLib pricing adapter** — Crank-Nicolson / Black-Scholes / Heston / SABR via the existing BSD-3 QuantLib build. First serious-finance engine. Sets up the bit-deterministic floating-point problem (CRlibm or pinned-architecture cloud).
- **MCP server wrapper** — expose `polymarket_query` over MCP so any MCP client (Claude Code, Cursor, an external bank agent) can invoke it. Ship the **content-addressed envelope as an MCP RFC** in parallel.
- **Polymarket dispute + market-maker tools** — the AI roles flagged by the May 10 research as where Polymarket actually rewards AI participation. Gated behind the material-gate approval substrate.
- **EU AI Act Annex IV exporter** — one-click documentation pack from the audit log + model lineage. Sells itself once the August 2026 deadline starts biting.
- **alts-CDM schema** — the durable wedge. Designed when the Polymarket harness is solid.

---

## Acknowledgements

- Peter Steinberger (steipete) for the Peekaboo adapter pattern that shaped the kbot-finance adapter shape, and the broader proof that a single substrate-deep developer can ship infrastructure-shaped tools before the closed alternatives consolidate.
- The FINOS AI Governance Framework v2.0 maintainers — the 11 operational risks + 9 security risks + 3 regulatory risks catalog drove the verifier rule design.
- Polymarket / UMA for keeping the Gamma API and the optimistic oracle architecture publicly documented and key-free.

---

**Field name:** *provenance engineering* — at the intersection of stochastic calculus, distributed systems, IEEE 754 numerical determinism, cryptographic content-addressing, compliance-as-code, and AI agent engineering. Six disciplines rarely held by one team. The discipline doesn't quite have a public name yet. kbot 4.5.0 is one vote for the term.

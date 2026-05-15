# @kernel.chat/kbot-finance

[![npm version](https://img.shields.io/npm/v/@kernel.chat/kbot-finance.svg?style=flat-square)](https://www.npmjs.com/package/@kernel.chat/kbot-finance)
[![npm downloads](https://img.shields.io/npm/dm/@kernel.chat/kbot-finance.svg?style=flat-square)](https://www.npmjs.com/package/@kernel.chat/kbot-finance)
[![Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](./LICENSE)
[![node >=22](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg?style=flat-square)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/isaacsight/kernel/kbot-finance.yml?branch=main&style=flat-square&label=CI)](https://github.com/isaacsight/kernel/actions/workflows/kbot-finance.yml)
[![Run on Replit](https://replit.com/badge/github/isaacsight/kbot-finance)](https://replit.com/new/github/isaacsight/kbot-finance)

> **Two GitHub homes for the same package.** Canonical development happens
> in the [`isaacsight/kernel` monorepo](https://github.com/isaacsight/kernel/tree/main/packages/kbot-finance)
> alongside @kernel.chat/kbot and the kernel.chat magazine. A standalone
> mirror at [`isaacsight/kbot-finance`](https://github.com/isaacsight/kbot-finance)
> exists for clean one-click Replit import and focused discovery. Both
> stay in sync; the standalone repo is updated via `git subtree push`
> after each release.

**Audit-grade AI infrastructure for capital markets and other regulated industries.**

The open-source substrate for AI agents operating in audited environments —
content-addressed request envelopes, hash-chained append-only audit log,
jurisdiction-aware regulatory verifier (rules-as-code), MCP server, and
engine adapters (Polymarket, SEC EDGAR, more coming). The AI Intelligence
Layer never produces the source-of-truth number — deterministic engines
do, humans approve at material gates, every action is replayable
byte-for-byte under audit.

Apache 2.0. Node 22+. Replit-importable.

**Field:** [Provenance engineering](./ROLE.md) — the engineering discipline
of building substrates that prove what an AI agent saw, asked, computed,
decided, and who approved. Used in finance (this package), healthcare,
legal, defense, drug discovery, anywhere AI touches regulated decisions.

**Quick start:**

```bash
npm install @kernel.chat/kbot-finance
npx -y @kernel.chat/kbot-finance demo   # end-to-end against live Polymarket
npx -y @kernel.chat/kbot-finance mcp    # MCP server for Claude Code / Cursor / Replit Agent
```

---

## What this is

A reference implementation of three layers that together form an
AI-Native Capital Markets Operating System:

1. **Deterministic engine adapters** — call known-good engines (Polymarket
   Gamma in v0.1; QuantLib, NautilusTrader, Aeron, alts-NAV in later versions).
   The AI agent cannot compute the number — it can only request one inside a
   content-addressed envelope.

2. **Regulatory verifier** — Norm-AI-pattern rules-as-code. Every action
   passes through before reaching the engine. Failures emit adverse-action
   reason codes. Jurisdiction-aware (US, EU, UK, SG, HK, UAE, GLOBAL).

3. **Hash-chained audit log** — append-only, WORM-compatible. Every
   verifier check, engine request, engine response, approval, and incident
   is recorded with a hash linking it to the previous entry. Tampering
   anywhere invalidates everything after.

Plus a **material-gate approval substrate** for actions that require a signed
human approver token before execution.

## Try it on Replit

This subdirectory is self-contained. Import the repo into Replit and the
first `Run` will:

1. `npm install`
2. `npm run demo` — runs the end-to-end flow against the live Polymarket
   Gamma API, prints the audit log, verifies the hash chain.

No keys, no setup. Public API only.

## Run locally

```bash
cd packages/kbot-finance
npm install
npm run demo        # live end-to-end
npm test            # unit + integration
npm run test:live   # explicit live-smoke against Gamma
KBOT_FINANCE_OFFLINE=1 npm test  # CI without network
```

## Architecture (one diagram)

```
┌──────────────────────────────────────────────────────────────────┐
│  AI Intelligence Layer  (kbot agent calls polymarketQuery(...))   │
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
│  Hash-Chained Audit Log  (append-only, replayable, WORM-ready)    │
└──────────────────────────────────────────────────────────────────┘
```

## Public API

```ts
import {
  // Content addressing
  canonicalize,
  requestHash,
  sealEnvelope,
  // Audit
  AppendOnlyAuditLog,
  // Governance
  Approver,
  verifyApproval,
  // Verifier
  runVerifier,
  makePositionLimitRule,
  makeKellyCapRule,
  // Engines
  polymarket,
  // Tools
  polymarketQuery,
} from "@kernel.chat/kbot-finance";
```

## What v0.1 demonstrates

- **Content addressing.** Two calls with logically identical inputs produce
  byte-identical `request_hash`. Independent of object key order.
- **Audit-log integrity.** Tampering with any entry is detectable by
  `AppendOnlyAuditLog.verify()`. Concurrent appends serialize correctly.
- **Verifier short-circuit.** A rule rejection prevents the engine call
  entirely; the failure is logged with an adverse-action code.
- **Honesty primitive.** `byte_identical_replayable: false` on the Polymarket
  envelope — markets move; the live Gamma API is not deterministic at the
  block level. A future adapter that pins to a Goldsky/Graph snapshot will
  flip this flag to `true`.
- **Approval tokens.** HMAC-signed (Ed25519 in v0.2), bound to the exact
  request_hash + materiality + summary the approver saw.

## What v0.1 deliberately does NOT do

- No trading / signing / order placement on Polymarket. Read-only. Write
  comes after the audit primitives are proven.
- No deterministic floating-point. QuantLib + CRlibm integration lands in
  v0.2 when the rates/alts adapters arrive.
- No on-chain proofs. zk-STARK-verified compute against a Goldsky subgraph
  is the v3 audit primitive; v0.1 is HTTPS + content-hash.
- No MCP server wrapper. v0.2 ships an MCP server that exposes
  `polymarket_query` to any MCP client (Claude Code, Cursor, kbot core).

## Layout

```
src/
  envelope.ts                    # canonical JSON + SHA-256 + sealEnvelope()
  audit-log.ts                   # hash-chained append-only log + verify()
  governance.ts                  # Approver + verifyApproval()
  verifier/
    index.ts                     # Rule + VerifierContext + runVerifier()
    position-limit.ts            # Pre-trade size + notional caps (Rule 15c3-5 echo)
    kelly-cap.ts                 # Half-Kelly position-sizing cap
  adapters/
    polymarket/
      types.ts                   # Gamma API + outcome union types
      client.ts                  # HTTPS client; never throws across boundary
      commands.ts                # listMarkets / getMarket / listEvents
      index.ts
  tools/
    polymarket-query.ts          # The kbot-shaped tool wiring all layers
  demo.ts                        # End-to-end script (npm run demo)
  index.ts                       # Public surface
test/
  envelope.test.ts
  audit-log.test.ts
  verifier.test.ts
  governance.test.ts
  polymarket.live.test.ts        # LIVE SMOKE — hits real Gamma
```

## Strategic positioning

This is the open-source counter to Palantir AIP: same architectural pattern
(deterministic substrate + AI orchestration + governance), but MIT/Apache
core, BYOK, MCP-native, lower price floor, developer-first.

Bloomberg ASKB shipped the "AI emits engine query, engine produces number"
pattern (BQL emission) in Feb 2026. That pattern, generalized, is the
content-addressed envelope. ASKB picked their own proprietary engine; this
package picks open ones and ships the **deterministic-replay MCP extension
spec MCP currently lacks**.

The 12-18 month window is the gap between *Bloomberg validates the pattern*
(done) and *first nine-figure AI enforcement action lands* (H2 2026 - H1 2027).
After that, the spec freezes around whoever shipped first.

## License

Apache 2.0. Built to underpin commercial premium offerings (SOC 2, hosted
replay-retention, certified determinism) — the Aeron / PyKX dual-shape.

## Status

v0.2 reference implementation. Not yet certified for production trading.
Not investment advice. Not affiliated with Polymarket, Bloomberg, FINOS,
ISDA, or any regulator.

## For people, not machines

- **[ROLE.md](./ROLE.md)** — Provenance engineer role definition (the
  field, the six-discipline overlap, how to enter).
- **[HIRING.md](./HIRING.md)** — We're hiring a founding provenance
  engineer. JD, comp band, 90-day milestones, how to apply.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — How to contribute, the
  contribution ladder, good first issues, PR checklist.
- **[RFC-content-addressed-mcp.md](./RFC-content-addressed-mcp.md)** —
  Spec proposal for the MCP audit-extension this package implements.
- **[agents-and-money.md](../../docs/agents-and-money.md)** — Practitioner's
  note on what AI agents can actually earn, what they need to earn it,
  and why the audit trail (this package) is the product, not the
  trading strategy. Filed alongside ISSUE 381.

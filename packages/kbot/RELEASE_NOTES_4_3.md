# kbot v4.3 — Security Audit Skill Family + Anthropic Agent SDK Adapter

**Release date:** 2026-05-09
**Headline:** the BYOK / local-first counterpart to Project Glasswing + Claude Mythos, plus a provider-agnostic adapter to the Anthropic Agent SDK.

---

## tl;dr

The May 2026 news cycle had two events that wanted a kbot answer in the same release:

1. **Project Glasswing.** Anthropic handed Claude Mythos Preview to ~6 named partners (AWS, Apple, Cisco, Google, JPMorganChase, Microsoft) to find security vulnerabilities. The Mozilla Firefox 150 evaluation surfaced 271 zero-days in a single pass. The launch-day third-party-vendor incident was real. Mythos is gated; eligibility is an application form.
2. **Anthropic Agent SDK opened to external developers.** Tool packages built for the Agent SDK now have a public ecosystem.

kbot 4.3 ships:

1. The democratized counterpart to Glasswing — a skill family (`local-vulnerability-hunt`, `dependency-audit`, `secrets-leak-scan`, `threat-model-quickdraw`) plus a substrate tool (`security_audit_local`) that walks a local source tree, builds a typed surface map, and persists the audit trail to disk where the operator controls it. BYOK any frontier model. MIT. No phone-home.
2. A schema-only adapter (`src/adapters/agent-sdk/`) translating between kbot `ToolDefinition` and Anthropic Agent SDK tool format, in both directions. **No runtime dependency on `@anthropic-ai/sdk`** — kbot stays provider-agnostic.

**Eligibility for 4.3 is `npm install`.**

---

## What's new

### `security_audit_local` tool

Substrate that backs the skill family. Walks the tree once, builds a surface map, persists JSONL to `~/.kbot/security-audits/<session>/`. Pattern set covers nine languages and ten common vulnerability categories.

```bash
kbot run "security audit ./src using my BYOK model — file the trail"
```

Pattern coverage (25 patterns across 9 languages):

| Category | Severity floor | Languages |
|---|---|---|
| eval-shaped sinks (`eval`, `new Function`, `vm.runInContext`, dynamic `require` / `import`) | HIGH | JS/TS, Py, Shell |
| subprocess / shell-out (`exec`, `spawn`, `os.system`, `subprocess(shell=True)`) | HIGH | JS/TS, Py, Shell |
| HTTP route registrations (Express, Fastify, Flask, Django) | INFO | JS/TS, Py |
| weak crypto (MD5, SHA1, predictable random, JWT none / verify:false) | LOW–HIGH | All |
| SQL string concatenation near query call sites | HIGH | All |
| FS writes near user-controlled paths | INFO–MEDIUM | JS/TS |
| disabled TLS verification | HIGH | JS/TS, Py |
| non-constant-time secret comparisons | MEDIUM | JS/TS |

Caps at 5,000 files / 2,000 signals / 1 MB per file. Excludes the standard ignore list (`node_modules`, `.git`, `dist`, `build`, etc.) plus any caller-supplied additions.

Returns a markdown summary; the full trail goes to disk in JSONL so it survives the chat.

### Skill family

Four SKILL.md files under `skills/security-audit/` setting the editorial workflow the substrate feeds.

- **`local-vulnerability-hunt`** — five phases: Scope → Surface map → Hypothesize → Confirm → File. Iron laws: no remote scan without consent; no finding without evidence; no fix without verification. The Mythos echo, BYOK and local.
- **`dependency-audit`** — `npm audit` + lockfile diff + provenance review. Lockfile is the truth; package.json is the wish.
- **`secrets-leak-scan`** — working-tree + git-history sweep with named patterns (AWS access keys, OpenAI/Anthropic `sk-*`, Slack tokens, GitHub PAT, JWT, private keys). Rotate before scrub; never rely on rewriting public history.
- **`threat-model-quickdraw`** — STRIDE-lite, 30 minutes, produces `docs/threat-models/<feature>.md` artifact.

### Anthropic Agent SDK adapter

`src/adapters/agent-sdk/` — bidirectional schema mapping. **No runtime dependency on `@anthropic-ai/sdk`.** kbot's ToolDefinition surface ↔ Anthropic's `Tool` shape (JSON Schema `input_schema`).

```ts
import { toAgentSdkTools, fromAgentSdkTool } from '@kernel.chat/kbot/adapters/agent-sdk'
import { kbotTools } from '@kernel.chat/kbot/tools'

// Advertise kbot tools to an Agent SDK project
const agentSdkTools = toAgentSdkTools(kbotTools)

// Import an Agent SDK tool back into kbot
const kbotShape = fromAgentSdkTool(someAgentSdkTool, {
  fallbackExecutor: (name, args) => routeToYourBackend(name, args),
})
```

Round-trip kbot → SDK → kbot is stable for the parameter shapes kbot itself uses.

## Test math

- **+36 tests** this release (16 for `security-audit-local` + 20 for the agent-sdk adapter).
- Full suite: **1122 passing across 60 files** (was 1086 / 58 at 4.2.0).
- All deterministic. No LLM calls in CI.

## What this release is NOT

- **Not a wrapper around Mythos.** kbot does not gate the skill family by allowlist. The substrate runs against any frontier model the operator has BYOK'd a key for.
- **Not a runtime coupling to the Agent SDK.** The adapter is types and schema mapping. Add `@anthropic-ai/sdk` to your own project if you want the SDK runtime; kbot will not pull it in.
- **Not a replacement for the existing `pentest` / `hacker-toolkit`.** Those tools cover authorized remote testing. The 4.3 skill family is local-only — your own repos, your own keys, your own trail.

## Untouched (deliberately)

- All `src/futures/` modules — V5 substrate is unchanged.
- Default agent behavior — no automatic scans, no automatic uploads.
- 4.1.1's `forecast_summary`, 4.2.0's persona-scoped permissions — both still ship as-is.

## How to use it

```bash
npm install -g @kernel.chat/kbot@4.3.0    # or just upgrade if you already have it
export ANTHROPIC_API_KEY=sk-...             # or any other supported provider key
kbot                                         # then ask "audit this repo for security issues"
```

The audit trail will land at `~/.kbot/security-audits/<session>/` — `surface.jsonl` (every signal the substrate caught) and `meta.json` (counts, scope, model attribution). Ship the directory alongside the patch commit when you file findings.

## Provenance

This release started as a one-line user question in a Tuesday session — "what's going on in AI today?" — pulled the May 2026 news, identified Mythos and the Agent SDK opening as the events worth a kbot answer, and shipped both in the same release because both were on the same beat. The editorial side of the magazine (kernel.chat) shipped a parallel response: a new `review` editorial spread, ISSUE 378 ON THE BENCH grading five routes through the AI-augmented security audit surface, and the long-deferred ledger-paper plumbing from ISSUE 372. See `SCRATCHPAD.md` for the full session arc.

The discipline this release enforces: when the news cycle has half-life, ship the answer in the same week or the answer is different by the time it lands. 4.3 is small on purpose — substrate plus skills plus a schema adapter, no architectural moves — because the value is in the date stamp.

---

*kbot is open-source, MIT-licensed, BYOK by contract. The substrate this release ships will outlive any single provider's most-capable model in any single domain. The point of BYOK is that the substrate stays useful when the model behind your key changes; the point of local-first is that the trail stays yours regardless of which lab is currently in front.*

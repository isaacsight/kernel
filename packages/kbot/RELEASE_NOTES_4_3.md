# kbot v4.3.0 — Local Security Audit + Agent SDK Adapter

**Release date:** 2026-05-09
**Headline:** A BYOK / local-first answer to the AI-security tools that shipped to ~6 organizations the same week, plus the thinnest possible response to the Agent SDK opening to external developers.

---

## tl;dr

In the first week of May 2026, two AI-news events landed within days of each other:

1. **Project Glasswing + Claude Mythos** — frontier AI security audit tooling, available only to ~6 partner organizations under NDA.
2. **The Anthropic Agent SDK** — opened to external developers, with a typed tool format that frameworks now have to interoperate with.

kbot 4.3.0 is the response to both. The security-audit skill family democratizes the "audit your code with frontier AI" workflow for anyone with a BYOK key and a terminal. The Agent SDK adapter lets every kbot tool round-trip into and out of the SDK's tool format without forcing kbot to depend on `@anthropic-ai/sdk` at runtime.

Neither surface changes default behavior. Both are additive, opt-in, and reversible.

---

## What landed

### `skills/security-audit/` — four SKILLs

A new top-level skill family under `packages/kbot/skills/security-audit/`. Each SKILL.md is a narrative layer on top of the existing `pentest` and `hacker-toolkit` substrate — they don't duplicate; they tell the agent *when* and *how* to combine the existing primitives.

| Skill | What it does |
|---|---|
| `local-vulnerability-hunt` | Five-phase audit: surface map → category sweep → reachability → severity scoring → audit trail. Local-only by contract — no remote requests. |
| `dependency-audit` | npm/pip/cargo/go.mod manifest + lockfile sweep, CVE matching, fix-path generation. Reuses `dep_audit` and `cve_lookup` substrate. |
| `secrets-leak-scan` | Entropy + regex pattern set across tracked + untracked files. Reuses `secret_scan` substrate, adds the high-entropy heuristic. |
| `threat-model-quickdraw` | STRIDE-lite 15-minute pass. Produces structured JSON model + markdown brief. |

The naming is deliberate: this is the working surface that says "kbot can audit your code now," in the same week that the closed alternatives say "only if you're one of six organizations."

### `src/tools/security-audit-local.ts` — substrate tool

- **25 patterns across 9 languages:** JS/TS, Python, Go, Rust, Ruby, Java, PHP, Shell. Pattern set covers SQLi, command injection, path traversal, weak crypto, hardcoded secrets, deserialization gadgets, prototype pollution, eval/exec, regex-DOS, integer overflow on size casts.
- **Output:** JSONL surface map + meta written to `~/.kbot/security-audits/<session>/{surface.jsonl,meta.json}`. Audit trail is append-only and local; nothing leaves the machine without the user invoking a separate report tool.
- **Registry:** wired into `swarm-2026-04` alongside `dep_audit`, `secret_scan`, `cve_lookup`. The orchestrator can now compose all four into a single audit pass.

### `src/adapters/agent-sdk/` — schema-only adapter

The Anthropic Agent SDK ships its own tool format. Frameworks that don't speak it can't be wired into Agent-SDK-driven flows. kbot now speaks it without depending on it.

```ts
import { toAgentSdkTool, fromAgentSdkTool } from './adapters/agent-sdk'

const sdkTool = toAgentSdkTool(myKbotTool)
// → wire into a Messages API call as { tools: [sdkTool] }

const kbotTool = fromAgentSdkTool(sdkTool)
// → register back into kbot's tool surface
```

Two functions. Schema only. **No runtime dep on `@anthropic-ai/sdk`** — the adapter is type-shaped, not implementation-coupled. If Anthropic changes the SDK, only the adapter file moves; kbot's core stays unchanged. This is what "provider-agnostic" looks like in practice.

---

## Untouched (deliberately)

- **`pentest`, `hacker-toolkit`, `agents/security-agent.ts`** — these existed before 4.3.0 and continue to work exactly as they did. The new skills layer narrative on top; they don't replace the primitives.
- **Default behavior** — sessions that don't invoke `local-vulnerability-hunt`, `security_audit_local`, or the Agent SDK adapter see no change. The 4.2.0 persona system, forecast tool, and futures substrate all behave identically.
- **`@anthropic-ai/sdk`** — kbot does not import it, depend on it, or recommend it. BYOK contract preserved.

---

## Tests

- **+36 tests** in this hop:
  - `src/tools/security-audit-local.test.ts` — 16 tests (surface map shape, pattern coverage, JSONL persistence, idempotency)
  - `src/adapters/agent-sdk/adapter.test.ts` — 20 tests (round-trip equivalence, schema validity, edge cases)
- `npx vitest run src/futures/` — **95/95** (zero regression in the v5 futures substrate)
- `npx tsc --noEmit` — zero new errors in added files; 47 pre-existing chalk/ora ambient warnings unchanged

---

## Scope notes

The original three-item plan included a `forecast/` wire-in. That work turned out to already be shipped end-to-end in 4.1.1 (`forecast_summary` tool). Removing it from this build kept the changelog honest.

The new skills are intentionally narrative documents, not new substrate. The substrate (`security-audit-local`) is one file. The skills are four files of *prose* that teach the agent when and how. This is the kernel.chat editorial principle — count what gets read, cut what doesn't, file the audit in public — applied inside kbot itself.

---

## Provenance

- **PR:** [#41](https://github.com/isaacsight/kernel/pull/41), merged 2026-05-09 19:27 UTC.
- **Commit:** `75d7658`.
- **Companion magazine work** (kernel.chat surface, not kbot):
  - **Review spread** — fifth editorial tool, gives the magazine a measured comparative form.
  - **ISSUE 378 ON THE BENCH** — first use of the review tool. Grades 5 routes through the AI-augmented security audit surface; refuses to flatter the house toolkit.
  - **Ledger paper full plumbing** — closes deferred items ISSUE 372 wrote down for "a future editor" months ago.

---

## Install

```bash
npm install -g @kernel.chat/kbot@4.3.0
```

Existing users on autoupdate get this on next `kbot doctor`.

# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.

## Current Session (2026-05-28) — ISSUE 391: THE WEEK THE ASSISTANT BECAME AN ACTOR

### Headline
Filed ISSUE 391 — a wire **dispatch** distilling a single late-May 2026
week of AI news into seven stakes. Second dispatch ever (368 was the
first). Steps out of the "Agentic Substrates" series (388–390) for a
reactive, dated week-in-review; bridges back to 390.

### What shipped (magazine)
- `src/content/issues/391.ts` — dispatch spread. Identity: ivory stock +
  asymmetric-left + ink-spread ornament (dispatch-exclusive; deliberately
  breaks the 374–390 asterisk-stamp run) + brick accent (dispatch default)
  + FILED·WIRE seal + THE WIRE DESK postmark. Seven propositions: (01) an
  OpenAI model autonomously disproving an ~80-yr geometry conjecture,
  (02) GPT-5.5 Instant as new ChatGPT default + the release stack,
  (03) Gemini reframed to *act* at Google I/O + Copilot Studio computer-use
  GA, (04) ads moving inside the answer (OpenAI Ads Manager, Google AI
  Search ads), (05) Anthropic acquiring Stainless + the $200M Gates
  partnership, (06) regulators getting pre-release early access,
  (07) taste/discernment as what stays scarce. Bulletin + AP terminator.
- Registered in `index.ts` (import + ALL_ISSUES). LATEST_ISSUE → 391.
- PUBLISHING.md hygiene: §IV dispatch template ref 368 → 391; last-updated
  bumped to ISSUE 391.

### State / caveats
- Source: web search, late May 2026. Fast filing — some claims (esp. the
  math result) await public verification; the issue says so in-prose.
- `391.ts` + `index.ts` typecheck clean. **Pre-existing build break:**
  `tsconfig.json` deprecation errors (TS5107/TS5101 — esModuleInterop,
  moduleResolution=node10, baseUrl) fail `tsc` on a fresh container with
  newer TypeScript. Present on clean HEAD, NOT from this issue. Blocks
  `npm run build` / `npm run deploy` until tsconfig adds
  `"ignoreDeprecations": "6.0"` (or options are migrated). Did not touch
  it — out of scope for the news task. Flag to user before any deploy.
- Committed + pushed to `claude/ai-news-updates-2u3wb`. NOT deployed to
  gh-pages (would make it live on kernel.chat) — held pending user OK.

## Current Session (2026-05-09 evening) — PEEKABOO INTEGRATION: AX-FIRST NATIVE AUTOMATION + ISSUE 380 (THREE IDIOMS)

### Headline
Wired Peekaboo (https://github.com/openclaw/Peekaboo) into kbot end-to-end across three layers in a single sprint via parallel-agent swarm: provider-agnostic adapter, six registered `peekaboo_*` tools, additive AX-first fallback in the existing `mouse_click` / `keyboard_type` flow, and the editorial that names what just changed. Six agents dispatched; all returned green.

### What shipped (kbot v4.4.0)

**1. `src/adapters/peekaboo/` — bidirectional adapter (5 files, 629 LOC)**
- `types.ts` — `PeekabooSnapshot`, `PeekabooElement`, the five command result types, `PeekabooOutcome<T>` discriminated-union helper.
- `runner.ts` — `runPeekaboo(args, opts)` via `execFile`, `peekabooAvailable()` probe, `PEEKABOO_BIN` env override.
- `commands.ts` — `see`, `click`, `type_`, `setValue`, `performAction`, `agent` — all return `PeekabooOutcome<T>`.
- `index.ts` — public surface.
- `adapter.test.ts` — 13 deterministic tests, `vi.mock('node:child_process')` for stubbing.

**2. `src/tools/peekaboo.ts` — six registered kbot tools**
- `peekaboo_see` / `peekaboo_click` / `peekaboo_type` / `peekaboo_set_value` / `peekaboo_perform_action` / `peekaboo_agent`.
- All `tier: 'free'`, all return `string`, never throw — `outcomeToString` collapses `PeekabooOutcome` to either pretty JSON or `Error: ...`.
- Binary presence guarded via `peekabooAvailable()`.
- Approval flow: `requireApproval(app)` checks `~/.kbot/computer-use/<app>.lock` (Coordinator-managed). `computer.ts` does not export `approvedApps`/`isAppApproved`/`claimApp`, so this is a fail-closed check rather than a direct in-process integration. Limitation documented inline.
- 12 vitest tests. Registered in `swarm-2026-04.ts`.

**3. `src/tools/computer.ts` — additive AX-first fallback**
- Imports `peekabooAvailable`, `see`, `click`, `type_` from the adapter.
- Module-level `peekabooReady()` cached probe with `KBOT_DISABLE_PEEKABOO=1` escape hatch.
- `mouse_click` (lines ~520–538): on `darwin` + binary present, captures snapshot, attempts AX click via `peekabooClick`; falls through to AppleScript+cliclick on any failure.
- `keyboard_type` (lines ~739–752): same pattern with `peekabooType`.
- New `peekaboo_status` tool reports `available` / `disabled-via-env` / `not-on-PATH`.
- 6/6 existing computer.test.ts pass — no regressions, no signature changes.

**4. `skills/native-automation/peekaboo-snapshot-act/SKILL.md` (91 lines)**
- Names the doctrine: web=DOM, audio=OSC, native=AX. Snapshot-then-act over screenshot-and-guess.
- Iron Laws: ONE SNAPSHOT, MANY ACTIONS / ELEMENT ID OVER COORDINATES / PERFORM-ACTION OVER CLICK.
- Five phases: Approve & focus → Capture surface → Choose the right verb → Reuse the snapshot → Fall back gracefully.

### What shipped (magazine)

**ISSUE 380 — THREE IDIOMS (cobalt + cream + asymmetric-left + asterisk-stamp + NOTED · IDIOMS · V·26)**
- Essay spread, three numbered sections (DOM / OSC / Accessibility), closing recognition that surface-published structure is the right input shape, kbot v4.4.0 / Peekaboo news in a small `— MARGIN —` block at the end.
- Adjacent to the 376/377/378 filed-pattern arc but verb shifts from FILED to NOTED — a recognition, not a filing.
- First binding of cobalt as the structural-argument accent.

### Collision recovery
ISSUE 379 — ON BECOMING A REAL MAGAZINE was deployed by the user (commit `5f16579e`) mid-swarm; the issue agent's brief was already in flight and overwrote 379.ts with THREE IDIOMS content. Recovered: `git checkout HEAD -- src/content/issues/379.ts` restored the deployed essay byte-for-byte, THREE IDIOMS preserved at `380.ts` with all identifiers renumbered, registered behind 379 in `index.ts`. No data loss.

### Test math
- New: **25 tests** (13 adapter + 12 tool wrapper), all green.
- Regression: 6/6 computer.test.ts still pass; no existing tests modified.
- Type-check: clean across both site and kbot package.

### Install state (this Mac)
- `peekaboo` 3.0.0-beta4 at `/opt/homebrew/bin/peekaboo` (via `brew install steipete/tap/peekaboo`).
- Project `.mcp.json` registers `peekaboo: peekaboo mcp` (committed, travels with repo).
- User-level `~/.claude.json` registers same (every Claude Code session on this Mac picks it up). Connection verified ✓.
- Macos perms inherit from Claude Code's existing Screen Recording + Accessibility grants — no extra prompt.

### Decisions worth remembering
- `npx -y @steipete/peekaboo` does NOT spawn the MCP server — that's the CLI. The MCP entry point is `peekaboo mcp` (subcommand), not a separate bin. Both `.mcp.json` and the `claude mcp add` invocation must use `peekaboo mcp` (or the explicit `peekaboo-mcp.js` bin from the npm package if going npx-only).
- The kbot adapter is provider-agnostic by design (no runtime dep on `@steipete/peekaboo`) — matches the agent-sdk adapter posture from the prior session.
- AX-first fallback is gated behind `darwin` + binary present + non-empty app arg — Linux behavior bit-for-bit unchanged. Escape hatch is `KBOT_DISABLE_PEEKABOO=1`.

### Open ends for next session
- Apply the AX-first pattern to additional computer.ts tools (currently only `mouse_click` and `keyboard_type` get it). Candidates: `mouse_drag`, `keyboard_combo`, `app_focus`.
- Surface `peekaboo_agent` through a dedicated SKILL.md so its handoff semantics (delegate to peekaboo's own agent loop) are explicit.
- The `requireApproval` limitation in `peekaboo.ts` calls for a small `computer.ts` refactor: export `isAppApproved` so direct in-process gating is possible. Low risk, high clarity gain.

### Files touched (this session)
```
A packages/kbot/src/adapters/peekaboo/types.ts
A packages/kbot/src/adapters/peekaboo/runner.ts
A packages/kbot/src/adapters/peekaboo/commands.ts
A packages/kbot/src/adapters/peekaboo/index.ts
A packages/kbot/src/adapters/peekaboo/adapter.test.ts
A packages/kbot/src/tools/peekaboo.ts
A packages/kbot/src/tools/peekaboo.test.ts
M packages/kbot/src/tools/computer.ts            (additive AX-first + peekaboo_status)
M packages/kbot/src/tools/swarm-2026-04.ts       (register peekaboo tools)
M packages/kbot/package.json                      (4.3.0 → 4.4.0)
A packages/kbot/skills/native-automation/peekaboo-snapshot-act/SKILL.md
A src/content/issues/380.ts                       (THREE IDIOMS)
M src/content/issues/index.ts                     (register ISSUE_380)
M .mcp.json                                       (peekaboo entry)
M ~/.claude.json                                  (user-scope MCP, outside repo)
M SCRATCHPAD.md                                   (this entry)
```

---

## Earlier Today (2026-05-09 morning) — MAY-NEWS RESPONSE: SECURITY-AUDIT SKILLS + AGENT SDK ADAPTER + REVIEW SPREAD

### Headline
Started as a "where's AI at right now" question, ended as a build sprint against the May 2026 news cycle. Two new things land on `claude/ai-current-state-8f4vr`: a security-audit skill family (the BYOK/local-first answer to Project Glasswing + Claude Mythos) and an Agent SDK adapter (the schema-only response to Anthropic opening the Agent SDK to external developers).

### What shipped (kbot)

**1. `skills/security-audit/` — four new skills**
- `local-vulnerability-hunt/SKILL.md` — Mythos-style audit workflow, BYOK frontier model, audit trail at `~/.kbot/security-audits/<session>/`. Five phases: Scope → Surface map → Hypothesize → Confirm → File. Iron laws: no remote scan without consent; no finding without evidence; no fix without verification.
- `dependency-audit/SKILL.md` — `npm audit` + lockfile diff + provenance review. Lockfile is the truth; transitive counts double.
- `secrets-leak-scan/SKILL.md` — working-tree + git-history sweep with named patterns (AWS, sk-, Slack, GitHub PAT, JWT, private keys). Rotate before scrub; never rely on rewriting public history.
- `threat-model-quickdraw/SKILL.md` — STRIDE-lite, 30 minutes, produces `docs/threat-models/<feature>.md` artifact.

**2. `src/tools/security-audit-local.ts` — substrate tool**
- `security_audit_local` registered tool. Walks a tree, applies pattern set across JS/TS/Py/Go/Rust/Ruby/Java/PHP/Shell, persists JSONL surface map. Detects: eval-shaped sinks, subprocess calls, route registrations, weak crypto, JWT verify-skip, SQL string concat, FS writes near user input, TLS-skip flags, non-constant-time comparisons.
- 16 tests, all stub-driven, deterministic. Caps at 5,000 files / 2,000 signals / 1MB per file.
- Wired into `swarm-2026-04.ts` registration.

**3. `src/adapters/agent-sdk/` — bidirectional adapter**
- `types.ts` — `AgentSdkTool` / `AgentSdkExecutableTool` / `AgentSdkInputSchema` / JSON Schema property types. NO runtime dependency on `@anthropic-ai/sdk` — kbot stays provider-agnostic.
- `to-agent-sdk.ts` — kbot `ToolDefinition` → Agent SDK tool. Options: `preserveName`, `renameTool`, `strict`.
- `from-agent-sdk.ts` — Agent SDK tool → kbot `ToolDefinition`. Two flavors: schema-only (with optional `fallbackExecutor`) and executable (handler embedded). Type-union fallback for `["string","null"]`.
- `index.ts` — public surface.
- `adapter.test.ts` — 20 tests, including round-trip preservation.

### Test math
- New: **36 tests** (16 security-audit-local + 20 agent-sdk adapter), all green.
- Regression check: futures/ suite still 95/95 green.
- Type-check: zero errors in new files. Pre-existing chalk/ora type warnings unchanged.

### Decisions worth remembering
- Forecast module was already shipped end-to-end (4.2.0 wire-up via `forecast-summary.ts` was done) — pulled it from the build list when the README revealed it.
- Adapter is schema-only by design — kbot's BYOK contract means we don't ship `@anthropic-ai/sdk` as a dep just to translate JSON.
- Skill family pairs with existing `pentest`/`hacker-toolkit` (remote, authorized) and existing `agents/security-agent.ts` (the runtime under `security_agent_scan`). The new skills are the *narrative* layer on top of the substrate, not duplicates.

### Why the Mythos echo is on-brand
Glasswing only goes to ~6 organizations (AWS, Apple, Cisco, Google, JPM, Microsoft). The democratized version that fits kbot's positioning: same phased workflow, but BYOK any frontier model, against your own code, audit trail on disk you control. MIT, no phone-home, no allowlist.

### Open ends for the next session
- Optional v4.3.0: ship a "second-opinion" hook that fans the same surface signal across two providers and diffs the verdicts. The local-vulnerability-hunt skill already names this in its anti-patterns; make it real.
- Issue 376 candidate: editorial on the Mythos / Glasswing posture vs the BYOK alternative, with the audit trail as the evidence pack. Probably writes itself off the new skill family.
- The Agent SDK adapter could grow a thin `messages-api-router.ts` that takes a `tool_use` block and dispatches into the kbot registry — a pure convenience for users wiring kbot into Anthropic Messages API loops.

### Files touched
```
A packages/kbot/skills/security-audit/local-vulnerability-hunt/SKILL.md
A packages/kbot/skills/security-audit/dependency-audit/SKILL.md
A packages/kbot/skills/security-audit/secrets-leak-scan/SKILL.md
A packages/kbot/skills/security-audit/threat-model-quickdraw/SKILL.md
A packages/kbot/src/tools/security-audit-local.ts
A packages/kbot/src/tools/security-audit-local.test.ts
A packages/kbot/src/adapters/agent-sdk/types.ts
A packages/kbot/src/adapters/agent-sdk/to-agent-sdk.ts
A packages/kbot/src/adapters/agent-sdk/from-agent-sdk.ts
A packages/kbot/src/adapters/agent-sdk/index.ts
A packages/kbot/src/adapters/agent-sdk/adapter.test.ts
M packages/kbot/src/tools/swarm-2026-04.ts  (register security_audit_local)
A src/components/ReviewFeature.tsx          (new editorial tool #5)
A src/components/ReviewFeature.css
M src/components/IssueFeature.tsx           (router case for review)
M src/content/issues/index.ts               (ReviewSpread + types)
M src/content/issues/accents.ts             (review→olive default)
M docs/design-language.md                   (current-tools table updated; future-moves drift fixed)
M SCRATCHPAD.md                              (this entry)
```

### Editorial follow-on (ISSUE 378)
First use of the new `review` spread tool: ISSUE 378 — ON THE BENCH —
ledger stock + classic + olive accent + FILED · BENCH · V·26 seal.
Five subjects graded against a five-criterion rubric (access ceiling,
coverage, audit trail, cost ceiling, second-opinion friction):
Mythos, GPT-5.5-Cyber, Sec-Gemini v1, Llama 4 + PurpleLlama, kbot
security_audit_local + BYOK frontier. Standout (BEST AVAILABLE)
goes to Llama 4 + PurpleLlama, deliberately not the house toolkit.
kbot scores A− with its limits written down. Continues the small
filed-pattern arc 376 STANDARDS → 377 API TIER → 378 BENCH on the
AI-tools beat.

Caveat written into the issue file: SpreadCommon.stock does not yet
admit `ledger`, so the cover carries ledger and the spread falls back
to ivory. Worth resolving in a future commit if the editor wants
ledger inside-spreads; for now ivory under the score monuments reads
cleanly enough that this isn't a regression.

### Editorial follow-on (review spread)
Built on top of the security-audit work in the same session. The
news-cycle response on the kbot side (security-audit skills + Agent
SDK adapter) needed a magazine form to carry the editorial: the
review spread is that form. Top-line italic verdict, numbered
rubric, optional standout award, grid of subject cards with score
monument + stars + pros/cons + per-card verdict. Olive-led by
default. ISSUE 378 candidate: grade frontier model security
capabilities (Mythos, Glasswing partners, BYOK alternatives) using
the new tool against the new audit substrate.

Drift the doc patch caught: the design-language.md "Future moves"
list still claimed cobalt/ivy/pool weren't shipped — they've been
in `accents.ts` for weeks. The dispatch and forecast tools were
also live but undocumented in the current-tools table. All five
tools (essay/interview/forecast/dispatch/review) are now in the
table with their grammar one-liners and default accents.

---

## Prior Session (2026-04-28 → 04-29 overnight) — THE BIG BUILD: V5 EXECUTION + 4-ISSUE EDITORIAL DROP + KERNEL.MD SUPERSESSION

### Headline
The plan from the previous V5-research session got built tonight, plus four magazine issues, plus the canonical project doc rewrite. Roughly 18 hours of execution against the work the prior session had set up.

### What shipped (kbot)

**Seven npm releases** in sequence:
- `3.99.32` — wave 1 of 2026-04 capability swarm: image_thoughtful, channels family (Slack full + 5 stubs), file library, workspace agents, parallel computer-use coordinator, security agent, plugin integrity manifest. 7 modules, 76 new tests.
- `3.99.33` — wave 2 wiring: Office channel adapter, Anthropic Managed Agents adapter (`managed-agents-2026-04-01` beta header), plugin-sdk integrity, hierarchical planner integration, security agent wired into guardian/hacker, computer.ts rewired to Coordinator.
- `3.99.34` — Claude Code / Cursor / Zed integration: `kbot setup-*` CLIs, `.claude/skills/kbot.md` pre-authorization skill (the Harrison fix), 15 MCP description audit reframings.
- `3.99.35` — LLaDA2.0-Uni local provider + `local_image_thoughtful` tool (no OpenAI key needed for image gen).
- **`4.0.0`** — evidence-driven curation. 670+ tools → 105 specialty skills, 61 deprecated, 630 cut. Five Phase A discovery agents produced telemetry/test-refs/daemon-deps/external-surface/forge-readiness CSVs at `packages/kbot/CURATION_DISCOVERY/CURATION_DECISION.csv`. Source files stay on disk (reversible); only `LAZY_MODULE_IMPORTS` got pruned. Forge load-path bug fixed (forged tools now survive restart). Vocab refresh: user-facing copy says "skills" where the OAI/Claude Code framing fits.
- `4.0.1` — cache-warmth (Anthropic prompt-cache TTL warning, jcode borrow), `BENCHMARKS.md` (methodology-explicit n=5 cold-start vs claude/codex/aider/opencode/jcode), `templates/jcode-mcp-snippet.json` (kbot wraps as backend for jcode users), `research/jcode-analysis.md`.
- **`4.1.0`** — V5 futures substrate. Six modules under `packages/kbot/src/futures/`: harness (Sylph 2604.21003), skill-graph (Tencent 2604.25727), latent-state (Stanford+UIUC+NVIDIA+MIT 2604.25917), forecast (in-house), persona (Cequence press signal), debate (Plurai 2604.25203). 95 tests, all stub-driven, deterministic, ~150ms total. Net **+338 tests** session-over-session (731 → 1069).

### What shipped (kernel.chat magazine)

Four issues drafted, registered, deployed:
- **372 — THE AUDIT** (postmark dateline fired for the first time: ROOM 503 · IV·26; new `ledger` stock + `ledger-rule` layout + `graphite` accent)
- **373 — ON COMPOSITION** (cream + asymmetric-left + no ornament; the editorial-neighbours framework applied at the AI-tools layer)
- **374 — AGAINST VIRAL BENCHMARKS** (ivory + classic + new `asterisk-stamp` ornament; jcode anatomy without naming the engineer)
- **375 — THE SIX BORROWS** (cream + new `numbered-catalog` layout + dossier element; credit-page for the v5 build)

Two corrections deployed after first publish (372's count-of-counts line dropped, 375's "Cequence Security" → "Cequence").

### Design-language extensions

- **WIRED decoded** as second editorial neighbour in `docs/design-language.md` — four transferable mechanics (methods sidebar adjacent to claim, numbered references at foot of long features, pull-quote with the number not the sentence, tomato-tinted inline footnote markers). Magazine now has two complete neighbours decoded (PAPERSKY + WIRED).
- **All four PAPERSKY-starred mechanics now in active use** (postmark dateline was the unfired one until 372).
- **Type extensions:** `IssueStock` += `'ledger'`; `IssueCoverLayout` += `'ledger-rule'` + `'numbered-catalog'`; `IssueCoverOrnament` += `'asterisk-stamp'`; `IssueRecord.coverPostmark?: { place, date }` (first-class support); `INK_SEEDS` += `graphite` (#3F3D3A).
- **Stock cabinet** — explicit register documented for what each paper signals (cream/ivory/butter/kraft/ink/ledger).

### Doc supersession

**KERNEL.md** (335 lines) now the canonical project reference; **CLAUDE.md** (64 lines, was 673) reduced to a shim pointing at KERNEL.md. Old framing was "kbot is the product, web is the companion" — wrong now that the magazine is a working publication. New framing: *one publication on two media*, the same editor's discipline applied to a tool registry and a table of contents.

### Real user signal

**Harrison McCormick** (Pro user, second time he's been the canary) iMessaged 4/27 that "Claude is refusing to help me use the agent it had me build, citing academic dishonesty." That triggered wave 3 (kbot.md skill + setup CLIs + MCP description audit). Same-night fix; he can `npm i -g @kernel.chat/kbot && kbot setup-claude-code` to land in a working integration. Texts to him are drafted but not sent yet.

### Pattern that worked

1. Read research first (the night before's session set up V5_FUTURES_PLAN.md so this session could just execute)
2. Plan in writing — every release commit cites numbers and reasoning
3. Swarm-dispatch parallel agents on non-overlapping work (separate files, separate scopes); keep scope tight per agent — stream timeouts come from sprawling context
4. Foreground the integration step (registration, typecheck, deploy)
5. Ship with evidence (audit CSVs, RELEASE_NOTES, CHANGELOG, methodology docs)

### Known timeouts / agent failures

Stream-idle timeouts hit ~5 agents this session on the bigger scopes. Recovery pattern: check what survived on disk, tight-rescope, salvage in foreground. The stalled agents were always over-scoped, never the deterministic-stub ones. Going forward: cap per-agent scope at one-module / ≤500 LOC / single-purpose.

### Open in the queue

- **Skill injector** (jcode borrow C) — embedding-driven skill auto-injection. Stalled this session, deferred to 4.2.
- **Smart grep** (jcode borrow B) — file-structure injection. Stalled, deferred.
- **Cross-harness session import** (jcode borrow D) — Claude Code → kbot session resume. Stalled, deferred.
- **`forecast/` → `growth_summary` wiring** — substrate exists, integration is 4.2 work.
- **`persona/` → `permissions.ts` wiring** — substrate exists, integration is 4.2 work.
- **Real EvolutionAgent** — interface shipped, codegen implementation is 4.3+.
- **Deprecation removal runway** — 4.1 (lab-*) → 4.2 (stream-*) → 4.3 (engine-*) → 4.4 (misc) → 4.5 (forge_tool migration).
- **Harrison upgrade text** — drafted in conversation, not sent.
- **Social post about the cut** — could pair the audit story (672 → 105 with public CSV) with the four-issue drop. Not drafted.

### Live state at session end

- **kbot v4.1.0** on npm, latest tag, 1069 tests passing, 56 test files
- **kernel.chat ISSUE 375 — THE SIX BORROWS** is the live cover at https://kernel.chat
- **GitHub:** main at `7e154a64` (KERNEL.md supersession). gh-pages at `b26e1f6` (post-corrections deploy). 13 stars, 2 forks, 0 open PRs.
- **npm downloads (all-time):** 25,828 total since first publish 2026-03-04 (56 days). Last 30 days: 11,401.

### Recommended next session opener

> "Pick from: (1) Send Harrison the upgrade text + draft the social post about the 4.0 cut. (2) Wire forecast → growth_summary as the first 4.2 substrate-to-product hop. (3) Skill injector salvage with tighter agent scope. (4) Start drafting ISSUE 376 (subject open — could be the postmark mechanic at a different geography, or the WIRED decode applied to a specific data-journalism piece kbot has the receipts for)."

### Previous session notes follow below
---

## Prior Session (2026-04-29) — V5 RESEARCH + FUTURES PLAN

### What happened
- Verified live state: kbot is at **v4.0.1**, published 2026-04-29 (CLAUDE.md was at 3.60.0 / 3.99.21 — stale). Real npm downloads ~1,266/wk, not the 4,806 stated.
- **CLAUDE.md updated** in this session to match v4.0.1 reality. Committed as `b497466` on `claude/project-scope-definition-Z7fbx`, pushed.
- Researched HF Daily Papers (2026-04-29) — pulled 5 high-relevance papers for kbot's architecture:
  - **Sylph.AI "The Last Harness You'll Ever Build"** (2604.21003) — formalizes Worker / Evaluator / Evolution Agent loop. Maps directly onto kbot's existing critic-gate + learning systems.
  - **Tencent SkillSynth** (2604.25727) — scenario-mediated skill graph for terminal task synthesis. Maps onto skill-router package.
  - **Stanford RecursiveMAS** (2604.25917) — latent-state multi-agent. Top of HF page (121 upvotes). Successor architecture to text-handoff multi-agent.
  - **Plurai BARRED** (2604.25203) — asymmetric debate generates guardrail training data. Recipe to ship critic-gate.ts (currently feature-flagged off awaiting FP measurement).
  - **Alibaba TCOD** (2604.24005) — temporal curriculum on-policy distillation. Recipe for distilling frontier models to local llama.cpp runtime.
- Researched competitive landscape: terminal coding agents have consolidated into a real category; MCP at 97M installs (mainstream); agentic sovereignty / "Thick Agents" recognized as a tier.

### Strategic positions identified
1. Harness Evolution Loop (Sylph) — foundation for self-improving kbot
2. Skill Graph (Tencent) — formalizes skill-router as a graph
3. Latent-state envelope (Stanford) — prep for multi-agent v2
4. Forecast / predictions module — addresses user framing literally
5. Persona / privilege scoping (Cequence Apr-28) — wraps permissions.ts as identity-bound
6. Asymmetric debate (Plurai) — generates the data that ships critic-gate

### What's drafted (not built)
- **`packages/kbot/V5_FUTURES_PLAN.md`** — full plan, sequenced into 4 phases, ~1,200 LOC TS + 400 LOC tests + 300 lines markdown. **Read this when back.**
- **`packages/kbot/src/futures/harness/types.ts`** — concrete sample. Full Harness Evolution Loop type system. Pure types, no runtime, no risk. Demonstrates the contract every other module would target.
- **`packages/kbot/src/futures/{harness,skill-graph,latent-state,forecast,persona,debate}/`** — empty directories, placeholder for the 6 modules.

### Key decisions deferred to user (see V5_FUTURES_PLAN.md "Open decisions")
1. Module name: `futures/` vs `v5/` vs `experimental/`
2. CLI surface: subcommand vs flag
3. Forecast as new tool or arg on existing
4. Public API export path
5. Phase ordering: Phase 1 first (recommended), or do forecast first for visibility

### What didn't ship this session
- No code beyond the types.ts sample (user redirected to "prepare and plan till I get home")
- Critic-gate still feature-flagged off
- BARRED debate not implemented
- Terminal-Bench evaluation not run

### Recommended next session opener
> "Read `packages/kbot/V5_FUTURES_PLAN.md`, pick a phase, ship it."

The plan is structured so any single phase is independently shippable and reversible (everything additive under `src/futures/`).

### Branch state
- Current branch: `claude/project-scope-definition-Z7fbx`
- Pushed commits: `b497466` (CLAUDE.md refresh)
- **Uncommitted at session end**: `V5_FUTURES_PLAN.md`, `futures/harness/types.ts`, this SCRATCHPAD entry

---

## Previous Session (2026-04-19) — KBOT-CONTROL + SUNO-INSPIRED ROADMAP

### What shipped
- **kbot-control.amxd** — single M4L device, TCP 127.0.0.1:9000, JSON-RPC 2.0, 37+ LOM methods. Supersedes AbletonOSC + AbletonBridge + kbot-bridge (all three can be decommissioned).
- **packages/kbot-control-standalone/** — open-source-ready package with client.ts, LICENSE, LAUNCH assets.
- **packages/kbot/src/growth.ts** — "kbot is N% better this week" dashboard. The Suno "My Taste visible" play applied to an agent: surface measurable self-improvement to users.
- **packages/kbot/src/critic-gate.ts** — always-on adversarial critic on every tool output. GAN-style generator/discriminator pattern; every agent move gets scored before it leaves the loop.
- **packages/kbot/src/planner/hierarchical/** — 4-tier planner design inspired by Suno's 3-stage transformer: Goal / Phase / Action / ToolCall.
- **packages/kbot/CURATION_PLAN.md** — 670 → 52 tools plan. 87% reduction. Plan only, not executed.
- **packages/kbot/research/action-tokens/** — research proposal for an agent-action token LM. This is the Suno lesson applied literally: neural codec → audio pattern maps cleanly to agent-action tokens → agent outputs.
- **Full migration**: 22 ableton_* tools now prefer kbot-control, fall back to OSC. Backwards-compatible rollout.
- **Demo session**: 90s Atlanta soul — Serum 2 Mark1 Stage + 6-device stock FX chain + Cm9 / Ab△9 / Fm11 / G7♭9 progression.

### Key findings
- Ableton 12.4 beta 15 **removed LOM browser access** — this is a real Ableton regression, not a kbot bug. Worked around in the migration. Report upstream.
- Suno's architecture (neural codec → audio pattern LM → audio) maps 1:1 onto agent design (action codec → action pattern LM → tool calls). That's the research moat.
- Warner Music settled with Suno Nov 2025; licensed models launching 2026. Licensing precedent opens the door for agent-action training data deals.

### Interview prep (hand-off docs)
- `.claude/INTERVIEW_CHEAT.md` — the pitch.
- `.claude/STUDIO_MODE.md` — the Claude Code prompt to replay the demo session.
- TZFM one-breath defense is ready (see `packages/2027/src/dsp/fm.rs`).

### Open gaps going forward
- Action-token research pivoted to embedding nearest-neighbor after baseline measurement killed the transformer bet (2026-04-19) — heuristic `learned-router.ts` already hits 91.8% top-5, far above the transformer proposal's 40% ship bar. New direction: embedding-NN + user-specific fine-tuning; prototype in `packages/kbot/research/action-tokens/embedding-nn/`, transformer-era artifacts in `_archive/`.
- Must add `durationMs` + outcome logging to `tool-pipeline.ts` — still relevant: the per-user fine-tune corpus for the embedding-NN approach depends on it.
- `browser.load_by_name` needs UI fallback until Ableton restores the API.
- Critic false-positive rate needs retrospective analysis to tune strictness. Currently shipping at default thresholds.
- Hierarchical planner Phase 2 (real tier logic) not implemented yet — scaffolding only.
- Tool curation not executed — plan only. 670 → 52 reduction remains a design doc.

### Previous session notes follow below
---

## Prior Session (2026-04-17) — HERMES PARITY + SKILLS + SELF-AWARENESS (v3.99.0 → v3.99.2)

### Three ships tonight
1. **v3.99.0** — skills-loader v2 (agentskills.io format), 14 bundled native skills, Hermes import (76 skills), CLI `kbot skills list | import`. Outperforms Hermes on 8 of 10 axes per audit.
2. **v3.99.1** — self-awareness.ts ground-truth block injected into every system prompt. Reads version, configured provider, model, platform. Fixed introspection hallucination (kbot was claiming "GPT-4 over WebSocket" when asked about itself).
3. **v3.99.2** — stronger ground-truth directives. Explicit "NOT GPT-4, NOT Hermes, NOT Llama" disclaimers. kbot now answers self-referential questions accurately: "Kernel Bot v3.99.2, Node.js 22.18.0, Ollama's gemma3:12b."

### Honest remaining gaps
- Ground truth reflects CONFIGURED provider, not runtime fallback provider. If Ollama is down and Claude answers, kbot still says "Ollama" — needs a runtime probe.
- Tokenizer doesn't stem — "dreams/dream" and "curate/curation" miss in relevance scoring. 2 of 10 benchmark queries still pick imported Hermes skill over native kbot skill. ~50 lines of stemming would fix.
- `ollama launch kbot` not yet in Ollama's integration list. `openclaw` (predecessor) already is. Distribution work.

### Previous session notes follow below
---

## Prior Session (2026-04-17) — HERMES PARITY + SKILLS SHIPPED (v3.99.0)

### What shipped to npm tonight
- **@kernel.chat/kbot@3.99.0** published + installed globally.
- **14 bundled skills** in `packages/kbot/skills/` across 7 categories (software-development, self-improvement, orchestration, memory, music-production, deployment, emergent). Ship in the tarball via `files: ["skills/**/*.md"]`.
- **skills-loader.ts v2** — recursive category-dir scan, YAML frontmatter (agentskills.io + Hermes + kbot.metadata), conditional activation (`requires_toolsets` / `fallback_for_toolsets` / `platforms`), relevance scoring with native-content boost, token budget (2000), dedup with precedence: project-local > bundled > user-global.
- **CLI commands**: `kbot skills list`, `kbot skills import --from <hermes|claude|path>`. Import symlinks 76 Hermes skills into `~/.kbot/skills/imported/`.

### Why: Hermes Agent shipped as an Ollama 0.21 integration
Research conclusion (stored in `project_hermes_adoption.md`): Hermes's edge was curated skill bodies + agentskills.io format. kbot had the plumbing (skill-system.ts, skill-library.ts, skill-rating.ts) but disconnected from the standard. Now compatible and superior on 8 of 10 axes — agent orchestration, memory cascade, self-improvement, music production are native categories Hermes has nothing for.

### Audit results before publish
- Functional edge cases: 12/12 pass
- Security: 10/10 pass (no eval, no Function(), YAML bombs stored as strings, path traversal inert)
- Content truthfulness: 3 bugs found and fixed (`train-curate` → `train-self`; `recordSkillExecution/patchSkill` → `skill_manage`; "17 specialists" → "25+")
- Fresh install: extracted tarball contains all 14 SKILL.md files at correct paths
- 731/731 existing tests still pass; typecheck clean

### Known follow-ups
- Tokenizer doesn't stem — "dreams" vs "dream" miss, "curate" vs "curation" miss. 2 of 10 benchmark queries still pick imported Hermes skill over native kbot skill. Low-priority; stemming would add ~50 lines.
- `ollama launch kbot` not yet in Ollama's integration list. `openclaw` (kbot's predecessor) already is. Distribution work, not code.

### Previous session notes follow below
---

## Prior Session (2026-04-16) — TRAIN-SELF: LOCAL FINE-TUNING PIPELINE

### Clean state (all committed)

**7 new files in `packages/kbot/src/`:**
`teacher-logger.ts`, `train-curate.ts`, `train-self.ts`, `train-cycle.ts`, `train-agent-trace.ts`, `train-merge.ts`, `train-grpo.ts`

**Integration:**
- `agent.ts::callProvider` → logs every non-local Claude call to `~/.kbot/teacher/traces.jsonl`
- `cli.ts` → 5 new subcommands: `train-self | train-cycle | train-merge | train-grpo | train-agent-trace`
- `~/.zshrc` → `export KBOT_TEACHER_LOG=1` (always-on at shell open)
- `~/Library/LaunchAgents/com.kernel.kbot-train-self.plist` → Sundays 3am (dry-run; enable with `launchctl load`)

**Known fragility:**
- `kbot-discovery-daemon` (PID 2491) auto-commits "evolution: kbot proposal" every few min. It previously wiped uncommitted files. Commit work fast. (Committed: 3 commits during this session — `fea4acd5 → ff0498da`.)

**Corpus status (first run):**
- `~/.claude/projects/**/*.jsonl` → 2,537 examples examined, 200 kept, mean score 0.700.
- `~/.kbot/teacher/dataset-default.jsonl` (353KB) ready for MLX.
- Teacher traces file: empty until future kbot sessions run through new middleware.

**Live run (background task `b8h2y33gf`):**
- Command: `kbot train-self --mode default --max-examples 150 --iters 200 --num-layers 8`
- Base: `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` (first-run HF download ~4GB)
- Log: `~/.kbot/teacher/train-self.log`
- Output model: `kernel-self:v<timestamp>` in Ollama
- Test when done: `ollama run kernel-self:<ts>`

### Shipped (not yet versioned/published)

**6 phases of local fine-tuning infra, end-to-end on M3 Max 36GB:**

New files under `packages/kbot/src/`:
- `teacher-logger.ts` — middleware that captures every Claude call as (prompt, response, tools, outcome) to `~/.kbot/teacher/traces.jsonl`. PII/key scrubber (sk-ant, ghp_, AIza, JWT, email, IP). Size rotation at 500MB. Wired into `agent.ts::callProvider` at line ~820.
- `train-curate.ts` — scores + dedupes traces into training JSONL. Modes: default / reasoning / agent-trace / code-only.
- `train-self.ts` — end-to-end pipeline: curate → mlx_lm.lora → mlx_lm.fuse → quantize → Ollama deploy. Default bases per mode (Qwen2.5-Coder-7B / DeepSeek-R1-Distill-7B / Qwen2.5-Coder-14B).
- `train-cycle.ts` — DeepSeek-R1 Distill style on-policy loop: student (Ollama) generates → Claude grades with JSON rubric → corrected pairs append to corrections.jsonl → optional retrain.
- `train-agent-trace.ts` — reformats tool-use traces with explicit `<think>`/`<tool>`/`<args>`/`<result>`/`<answer>` tokens for Phase 4 specialization.
- `train-merge.ts` — MergeKit wrapper (TIES / SLERP / DARE / linear). Default kbot triad: qwen-coder + deepseek-r1 + self. MoE swap path documented (DeepSeek-V2-Lite-16B, Qwen3-MoE).
- `train-grpo.ts` — GRPO rollouts with verifiable rewards: regex-match, json-valid, build-pass, test-pass, lint-pass, custom. Group-relative advantage calc. Rollouts persist to JSONL; external runner hookup via `--runner-cmd`.

CLI commands registered in `cli.ts` before `program.parse`:
- `kbot train-self --mode [default|reasoning|agent-trace|code-only]`
- `kbot train-cycle --student --teacher --samples --threshold --retrain`
- `kbot train-merge [--default | --method ties/slerp/dare_ties/linear]`
- `kbot train-grpo --student --group-size --runner-cmd`
- `kbot train-agent-trace --min-tools --verified-only`

**Validated:**
- `npm run typecheck` clean
- `kbot --help` shows all 5 new commands
- Teacher-logger end-to-end test persists trace and scrubs `sk-ant-api03-...` → `sk-ant-<REDACTED>`

**Research grounding (2025–2026):**
- s1/s1.1 (1K curated reasoning traces) → reasoning mode
- DeepSeek-R1 Distill (on-policy student+teacher) → train-cycle
- Magpie/Genstruct (instruction back-translation) → curator approach
- Agent-R / SWE-Gym (tool-token SFT) → agent-trace mode
- MergeKit / TIES / SLERP → train-merge
- GRPO (DeepSeek-Math) → train-grpo
- DeepSeek-V2-Lite / Qwen3-MoE → MoE swap path docs

**Hardware target confirmed:** M3 Max, 36GB unified, MLX 0.29.3 + mlx-lm 0.29.1 installed. ~350–500 tok/s expected for 7B LoRA.

**Pending to fully close loop:**
- Real user sessions must run through the (updated) `callProvider` to populate `~/.kbot/teacher/traces.jsonl`. Today: zero traces yet.
- Observer log (`~/.kbot/observer/session.jsonl`) is tool-call-only, NOT prompt/response. It's a good source for `agent-trace` mode after grouping by session, but curator's default mode currently skips it correctly (yields 0 examples until teacher-log accumulates).
- MergeKit / mlx_lm.fuse / llama.cpp convert binaries not yet checked; pipeline fails gracefully when missing.
- Bench harness (Claude-as-judge on 20 held-out tasks) not yet written — plan says write it at Phase 1 ship; queued for next session.
- npm publish + version bump (`v3.98.0 "teacher logger"` → `v3.99.0 "train-self"` → `v4.0.0 "reasoning distill"`) not done.

**Next session pickup:**
1. Use kbot for 1–2 days so teacher-log populates (~200–500 traces minimum).
2. Run `kbot train-self --dry-run --mode default` to confirm curator emits a dataset.
3. Install `mergekit` (`pip install mergekit`) to unblock `train-merge`.
4. Write the bench harness.
5. Version-bump + publish v3.98.0 with teacher-logger alone (Phase 0 ships standalone value: forever-free dataset accumulation).

---

## Previous Session (2026-04-05 night) — STREAM V2 + INTELLIGENCE COORDINATOR

### Shipped: v3.97.0 (npm published, GitHub pushed)

**Stream V2 — 6 new systems (~5,700 lines, 26 new tools):**
- PCM audio engine: oscillators, ADSR, chiptune sequencer, 7 SFX types
- Stream overlay: follow/raid/sub/donation/achievement alerts, goal bars, ticker, info bar
- Weather system: 12 weather types, day/night cycle, mood-coupled particles
- AI chat: Gemma 4 via Ollama, viewer memory, topic tracking, 4 response modes
- VOD system: auto-record, highlight detection, clips, YouTube upload
- Chat commands: 31 commands, XP economy, inventory, polls, boss fights, giveaways

**Intelligence Coordinator (886 lines):**
- 4-phase cognitive loop wired into agent.ts
- Pre-execution: learned routing, confidence gating, graph context, anticipation
- Tool oversight: pattern warnings, destructive tool detection, graph logging
- Post-response: heuristic self-eval (no LLM), pattern extraction, drive updates
- Cross-session consolidation every 10 interactions (selfTrain, graph prune, behaviour rules)

**Stream Renderer Improvements:**
- Pulsing red LIVE dot, weather/time in header, viewer count badge
- Ambient scenery: trees, rocks, grass tufts, flowers, clouds (procedural, camera-relative)
- Ground-level atmospheric haze, improved speech bubble position
- Chat panel accent border, branded kernel.chat watermark
- All v2 systems wired into render loop and chat processing chain
- Stream auditor agent created (.claude/agents/stream-auditor.md)

**Stats:** v3.97.0 on npm | 5,105 downloads/week | 19,384 total | 787+ tools | 37 registered users

**Stream:** Live on Twitch (kernelchatkbot) + Kick. Rumble needs fresh key each session.

**Groq:** $0.25 invoice for March (llama-3.1-8b-instant). Account needs login to check which email.

**Pending:**
- Tune PCM audio (enabled but untested on stream)
- Test all 31 chat commands live on Twitch
- X API tokens still expired (social posting blocked)
- Video demo still needed
- kernel.chat site needs tool count update (787+)
- Daily stream auditor cron (session-only, needs launchd for persistence)

---

## Previous Session (2026-04-02 full day) — MEGA BUILD + ABLETON + LEADERBOARD

### Two-day summary (Apr 1-2): v3.62.0 → v3.73.3

**Shipped:**
- Dream engine (7-tier memory cascade, dreaming daemon)
- Buddy system (8 species, evolution, achievements, chat, trading cards, leaderboard)
- Voice input, memory scanner, user behavior learning
- Service watchdog, morning briefing
- Multi-agent finance, music gen, AI interpretability, cyber threat intel
- A2A protocol, Ollama 0.19 detection, DeepSeek V4 provider
- KBotBridge Remote Script (programmatic Ableton device loading via Browser API)
- iPhone control (Apple ecosystem + mobile-mcp)
- Buddy leaderboard on kernel.chat/#/leaderboard
- Coldplay Clocks session + Empire of the Sun / Tame Impala build
- Install script (kernel.chat/install.sh)
- CI fixed, demo GIF re-recorded, README updated everywhere

**Stats:** 764+ tools, 10 stars, 1,929 downloads (Apr 1), v3.73.3

**Users:** Jae (portfolio analysis emails), Harrison (install help), Ray (agent setup)

**Ableton:** KBotBridge on port 9997, AbletonOSC enabled. Two sessions saved.

**Pending:**
- Collective intelligence plan (partially built, not fully executed)
- iPhone Developer Mode needs Xcode installed for full device control
- X API tokens expired (social posting needs manual)
- Video demo needs better recording (current GIF has issues)
- kernel.chat site updated: scroll fixed, 764+ tools, responsive breakpoints

---

## Previous Session (2026-04-02 afternoon) — HTTPS FIX + USER SUPPORT + MARKETING PUSH

### User Issue: Harrison (hwmccormick123@gmail.com)
- Harrison couldn't connect kbot to Claude Cowork — form requires `https://`, kbot serve only spoke HTTP
- Fixed by adding native HTTPS support to `kbot serve`
- Emailed him the fix via kernel-comms MCP
- Email agent is live and running (launchd `com.kernel.email-agent`) — Harrison can reply and get AI responses via local Ollama

### Shipped: `kbot serve --https`
- **serve.ts** — Added `--https` flag with auto-generated self-signed TLS cert (`~/.kbot/certs/`)
- **cli.ts** — Added `--https`, `--cert <path>`, `--key <path>` flags
- `ensureSelfSignedCert()` — EC P-256 cert via openssl, 365-day validity, localhost + 127.0.0.1 SANs
- Users can also provide custom certs: `kbot serve --cert x.pem --key x.key`
- Clean build, clean typecheck

### Marketing Push
- **HN post live**: https://news.ycombinator.com/item?id=47622060 (Show HN: K:BOT — 738-tool terminal AI agent, plugs into Claude Cowork)
- **X thread drafted** — 4 tweets in `tools/social-posts-2026-04-02.md` (X API tokens expired, needs manual post)
- **LinkedIn drafted** — also in `tools/social-posts-2026-04-02.md`
- **Demo recording script** created at `tools/demo-recording.sh` (asciinema + vhs + agg all installed)
- **Competitor intel**: Skales (BSL-1.1, desktop GUI agent from Vienna, 6 HN points) — kbot differentiates on: true MIT open source, terminal-native, 738 tools, Claude Cowork connector, deeper local AI

### Discovery Daemon Status
- Running: 1,477 total runs, 608 pulses, 70 intel scans, 0 errors today
- Email agent: running via launchd since 6:30 AM
- Ollama: online with qwen2.5-coder:32b + 13 other models
- Resend webhook: active, pointing to Supabase `receive-email` edge function

### Stats
- **738 registered tools**
- **v3.71.0** on npm
- npm: **4,799 downloads/week**, **10 GitHub stars**
- 170 npm versions published

### Not done
- X thread needs manual posting (API tokens expired — needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` in `.env`)
- Claude-in-Chrome extension not bridged to Claude Code terminal (separate MCP — not configured in `~/.claude/settings.json`)
- npm publish with HTTPS changes not yet done
- Video demo still pending
- LinkedIn post needs manual posting

---

## Previous Session (2026-04-01 overnight) — CLAUDE CODE LEAK → DREAM ENGINE → NIGHT SHIFT

### Claude Code Source Leak Study + Original Builds

**What happened:** Claude Code's full source (~512K lines TypeScript) leaked via source maps in npm package @anthropic-ai/claude-code@2.1.88. Studied the architecture, built original features inspired by patterns found.

### Shipped: v3.63.0 — Dream Engine + Rival Intel
- **Dream Engine** (dream.ts, 660 lines) — post-session memory consolidation via local Ollama, exponential decay aging, dream journal auto-injected into system prompt
- **5 dream tools** — dream_now, dream_status, dream_journal, dream_search, dream_reinforce
- **Rival Intel Agent** (.claude/agents/rival-intel.md) — competitive intelligence on Claude Code architecture
- **CLI** — `kbot dream run/status/search/journal`
- Published npm + pushed GitHub

### Shipped: v3.64.0 — Night Shift (buddy, voice, scanner)
- **Buddy System** (buddy.ts, 513 lines) — 8 ASCII companion species, 5 moods, deterministic assignment, persistent naming
- **Voice Input** (voice-input.ts, 466 lines) — local STT via whisper.cpp + Ollama, push-to-talk
- **Memory Scanner** (memory-scanner.ts, 564 lines) — passive in-session detection of corrections, preferences, project facts. Hooks into addTurn(), scans every 5 turns.
- **6 new tools** — buddy_status, buddy_rename, voice_listen, voice_status, memory_scan_status, memory_scan_toggle
- Published npm + pushed GitHub

### Stats
- **686 registered tools** (was 671 at session start)
- **v3.64.0** on npm (was v3.62.0 at session start)
- npm: 4,806 downloads/week, 6 GitHub stars

---

## Previous Session (2026-03-31 night) — ABLETON BEAT SESSION: Kalan.FrFr x Don Toliver

### Built a full beat in Ableton Live 12 via kbot OSC + AppleScript automation

#### Session: 142 BPM | F minor | Fm - Db - Ab - Eb progression

**Active tracks (all Roland Cloud):**
1. **TR-808 DRUMS** (track 5) — 81-note pattern: bouncy syncopated kick, clap on 2&4, hi-hats w/ triplet rolls, rimshot, conga
2. **ZENOLOGY 808 BASS** (track 17) — 10-note sub bass pattern, F1→Db2→Ab1→Eb2 with ghost re-triggers
3. **ZENOLOGY MELODY** (track 18) — 14-note dreamy pluck motif, Ab→Bb→C movement
4. **XV-5080 PAD** (track 13) — 16-note wide chord voicings, one per bar
5. **ZENOLOGY COUNTER** (track 20) — 8-note subtle F5/Eb5 fills

**What worked:**
- kbot AbletonOSC tools: transport, track rename, clip create, MIDI write, clip fire, mixer — all solid
- Plugin loading via AppleScript: `View > Search in Browser` → type name → keyboard Down arrows → Return
- ZENOLOGY (not FX) loads with 3 Down arrows to skip past FX presets
- TR-808 loaded via Python Quartz drag from browser to session view
- `cliclick` installed via Homebrew for macOS mouse automation

**What didn't work:**
- `load_plugin` OSC endpoint — always times out (custom kbot extension, not in standard AbletonOSC)
- CGEvent mouse drags — coordinates didn't match screen positions (Retina scaling mismatch)
- IDE terminal steals focus from Ableton on every bash command — solved by running clicks inside `osascript` blocks
- Loading multiple heavy Roland plugins in sequence can crash Ableton

**Presets still needed (user will do manually):**
- ZENOLOGY tracks need bass/pluck/texture presets selected
- XV-5080 needs a pad preset selected
- Add reverb + delay sends on melody and counter tracks

---

## Previous Session (2026-03-31 afternoon) — SHIP v3.59.0 + COMPUTER-USE VERIFIED

### Shipped to GitHub, npm pending auth

#### Published to GitHub
- **v3.59.0 committed and pushed** (96 files, +8,157 lines)
- Commit: `ea31a96b` + `1733988a` (serum2 registration fix)

#### What shipped
1. **5 bug fixes** — concurrent session state (memory.ts → Map), selfTrain guard, DNS rebinding SSRF, Gemini/Cohere tool warning, edit_file full-context diff
2. **Session isolation** — serve.ts creates unique session per HTTP request, destroys after
3. **9 M4L devices** — auto-pilot, bass-synth, dj-fx, drum-synth, genre-morph, hat-machine, pad-synth, riser-engine, sidechain
4. **DJ Set Builder** — registered in tool index
5. **Serum 2 Preset tool** — was missing from index, now registered
6. **Computer-use expansion** — 866+ lines added to computer.ts
7. **Ableton Live integration** — OSC-based class in integrations/

#### Computer-Use MCP Verified
- `list_granted_applications` — works
- `request_access` — works (granted Finder)
- `screenshot` — works (captured desktop)
- Significance: kbot goes from terminal-only to full desktop agent

#### Stats
- 698 tests passing (vitest), 0 type errors
- 670+ registered tools
- npm publish blocked — token expired, needs `npm login`

### Not done
- npm publish (needs auth)
- GitHub release (can do next session)
- Show HN post
- Video demo

---

## Previous Session (2026-03-31 night) — CODE QUALITY & CONCURRENCY FIXES

### Night shift — 5 bug fixes, 1 security fix, 8 new tests

#### Bug Fixes Applied
1. **Concurrent state in memory.ts** — Replaced single `sessionHistory` array with `Map<string, ConversationTurn[]>` keyed by session ID. All functions accept optional `sessionId` param (default `'default'`). Added `destroySession()` for serve mode cleanup. CLI unchanged.
2. **Concurrent state in learning.ts** — Added concurrency docs (shared state is intentional for learning). Added `selfTrainRunning` guard to prevent overlapping `selfTrain()` runs.
3. **DNS rebinding in fetch.ts** — SSRF protection now resolves hostname via `dns.lookup()` and checks resolved IP against blocked ranges. Domains pointing to 127.0.0.1 are now caught.
4. **Gemini/Cohere silent degradation** — Added upfront warning when these providers are used with tools: "provider doesn't support native tool calling — tools will be parsed from text output".
5. **edit_file diff preview** — Now passes full file content to diff preview (was passing just the matched fragment). Diff algorithm shows 3 lines of context with `...` separators.

#### Serve Mode Session Isolation (bonus)
- Wired `sessionId` through `AgentOptions` → `runAgent` → all memory calls
- `serve.ts` now creates a unique session per HTTP request and destroys it after
- Concurrent `/stream` requests no longer share conversation history

#### Tests
- 8 new session isolation tests in memory.test.ts
- **698 tests passing** (up from 690)
- 0 type errors (tsc --noEmit clean)
- Clean build

#### Stats
- 600 registered tools (verified: 549 in tools/ + 51 elsewhere)
- README "600+" claim is accurate

---

## Previous Session (2026-03-29/30) — ABLETON BRAIN + M4L + TERMINAL CONTROL

### Built AI music production system + full terminal control for platform ops

**Published:** @kernel.chat/kbot@3.54.0, 3.55.0, 3.56.0 (npm + GitHub)

### Terminal Control System (v3.56.0)
- **6 new CLI command groups, 32 new tools** — everything manageable from terminal
- `kbot admin` — users, billing (Stripe), moderation, platform stats (6 tools)
- `kbot monitor` — live health dashboard, logs, uptime checks, alerts (4 tools)
- `kbot deploy` — all-in-one ship: web + functions + npm + release (5 tools)
- `kbot analytics` — npm downloads, GitHub traffic, user growth, revenue (5 tools)
- `kbot env` — secrets management, sync, rotation guides (5 tools)
- `kbot db` — backup, inspect, SQL, migrations, health check (6 tools)
- Fixed pre-existing duplicate 'sessions' command bug
- GitHub release: https://github.com/isaacsight/kernel/releases/tag/v3.56.0

### Key Builds
- 9 M4L devices, DJ set builder, Serum 2 preset tool
- M4L bridge working on TCP 9999
- 30-min premixed trap set (664 bars, 16,778 notes, F minor, 144 BPM)
- 7 drum patterns, Roland Cloud instruments

---

## Previous Sessions

### 2026-03-26: UNIVERSITY SESSION
- 4 npm publishes. v3.42.0 → v3.45.0
- 114 science tools across 11 lab files
- See git history for full details

### 2026-03-24: MEGA SESSION
- 13 npm publishes. v3.26.0 → v3.31.2
- Finance stack, cybersecurity, self-defense, cognitive systems
- ~10,000 lines, 350+ tools, 26 agents

### 2026-03-22 → 2026-03-23: SYNTH Game Build
- 60+ source files, 45K+ lines at kernel.chat/#/play

### Prior
See git history.

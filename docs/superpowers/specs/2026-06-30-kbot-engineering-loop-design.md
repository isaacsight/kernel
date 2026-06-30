# kbot Engineering Loop + Decision Narration — Design

*Spec. Dated 2026-06-30. Filed alongside [`packages/kbot`](../../../packages/kbot/).*

## Problem

`autonomous-contributor.ts` is analysis-only by design — it clones a repo, scans
it, and emits a one-shot `ContributionReport`. It never applies a fix, never
verifies, never iterates. There is no engineering *loop*: no plan → act →
observe → reflect → repeat, and therefore no principled way to stop.

Separately, when an agent does grind on a task, the reasoning is invisible. The
project cannot "speak back" — say *what* it decided and *why* — so a human (or a
supervising session) cannot follow or steer it.

This design adds both, as two well-bounded units, reusing existing substrates
(`decision-journal.ts`, `reflection.ts`) rather than growing new ones.

## Goals

- An unattended engineering loop in kbot that **auto-applies** edits and iterates
  until a goal is met, a budget is spent, or it gets stuck.
- A **decision narration channel**: a live + persisted stream of decisions with
  rationale, defaulting to journal file + stdout.
- Clean boundaries: the loop logs decisions but never formats them; the journal
  records decisions but never drives control flow.

## Non-goals

- No model-driven (ReAct-style) tool selection — that overlaps with the existing
  `agent.ts` main loop and is out of scope. The loop's control flow is explicit.
- No automatic PR creation or push. The loop mutates a working tree; shipping is
  a separate, human-initiated step.
- No Discord-by-default. Discord push is an off-by-default config knob reusing
  the existing `kernel_notify`.

## Architecture — two units

### Unit 1 — `packages/kbot/src/engineering-loop.ts`

The loop orchestrator. Single entrypoint:

```ts
runEngineeringLoop(opts: LoopOptions): Promise<LoopResult>

interface LoopOptions {
  repoPath: string            // local working tree (already cloned)
  goal: string               // natural-language objective for narration + reflexion
  budget: LoopBudget         // hard stop conditions
  autoApply?: boolean        // default true; false = propose-only, loop on approval
  verify?: VerifyCommand     // default: detect (npm run build / npx vitest run / tsc --noEmit)
  narrateTo?: NarrationSink[] // default ['journal', 'stdout']
}

interface LoopBudget {
  maxIterations: number      // e.g. 12
  maxWallClockMs: number     // e.g. 20 * 60_000
  maxNoProgress: number      // consecutive stuck iterations before handback, e.g. 2
}

type LoopExit = 'success' | 'budget' | 'handback'

interface LoopResult {
  exit: LoopExit
  iterations: number
  applied: AppliedChange[]   // what was edited
  finalVerify: VerifyOutcome
  handbackSummary?: string   // present when exit === 'handback'
}
```

Each iteration runs five phases:

1. **plan** — pick the next actionable slice. Source the candidate set from
   `runAutonomousContributor` findings (reused as the analyzer), ranked by
   severity then `isSimpleFix`. Emit a `plan` decision.
2. **act** — apply the chosen fix as a real edit to `repoPath`. Emit an `act`
   decision capturing the file + change summary. Skipped when `autoApply` is
   false (loop waits for approval instead).
3. **observe** — run `verify` (build / test / typecheck), capture
   `VerifyOutcome { ok, failingStep, output }`.
4. **reflect** — call `generateReflections(goal, observeSummary, failureType)`
   when verify is not green (`failureType: 'error_correction'`). The returned
   `lesson` is the reflexion signal.
5. **decide** — compute the exit, emit a `decide` decision:
   - **success** — goal slice complete *and* verify green *and* no findings of
     the targeted severity remain.
   - **budget** — `maxIterations` / `maxWallClockMs` exceeded.
   - **handback** — `noProgress` counter (incremented when an iteration fails to
     move verify forward or reflexion's lesson repeats) reaches `maxNoProgress`,
     OR an act would cross a risk boundary (e.g. touching files outside
     `repoPath`, or a finding flagged `critical` security). Writes
     `handbackSummary` and stops. This is the explicit "stuck → hand to a human"
     exit, not silent grinding.

**Checkpointing.** Each iteration writes `LoopState` to
`<repoPath>/.kbot/engineering-loop.json` (iteration count, applied changes,
noProgress counter, last verify). A killed run resumes from it. This mirrors the
existing `checkpoint.ts` pattern.

**No-progress detection.** `noProgress` increments when: verify's `failingStep`
is unchanged from the prior iteration, or the reflexion `lesson` is byte-equal to
the prior iteration's lesson. It resets to 0 on any verify improvement.

### Unit 2 — narration (extend `decision-journal.ts`)

- Add `'engineering-loop'` to `DecisionType`.
- The loop calls the existing `logDecision({ type: 'engineering-loop', decision,
  reasoning, alternatives, confidence, evidence, userContext })` at each
  plan/act/decide step. `evidence` carries `{ phase, iteration, file?,
  verifyStep?, exit? }`. No new persistence code — reuses today's JSONL file.
- Add `narrateLoop(decisions: Decision[]): string` — a formatter that renders the
  engineering-loop decisions as a human-readable running log
  (`#3 plan → fix typo in auth.ts (because verify step "tsc" was red); act →
  applied; observe → tsc green; decide → continue`). Built on the existing
  `formatDecisions` style.
- A thin `NarrationSink` layer in `engineering-loop.ts` fans `narrateLoop` output
  to: `journal` (already persisted via `logDecision`), `stdout` (default on), and
  `discord` (off by default; calls `kernel_notify` when enabled).

Boundary check: `engineering-loop.ts` imports `logDecision` + `narrateLoop` but
the journal module imports nothing from the loop. One-directional.

## Data flow

```
runEngineeringLoop
  └─ loop (until exit):
       plan  ── runAutonomousContributor(findings) → pick slice → logDecision(plan)
       act   ── apply edit to repoPath            → logDecision(act)
       observe ─ verify()                         → VerifyOutcome
       reflect ─ generateReflections(...)         → lesson  [only when red]
       decide ── success|budget|handback          → logDecision(decide)
       checkpoint → .kbot/engineering-loop.json
       narrate  → narrateLoop() → [stdout, journal, (discord)]
  └─ return LoopResult
```

## Error handling

- **Verify command missing/unknown** → loop refuses to start (can't observe →
  can't loop safely). Returns `exit: 'handback'` with a summary naming the
  missing command. Never loops blind.
- **Apply fails** (edit doesn't match / file moved) → that slice is marked failed,
  `noProgress` increments, loop continues to next candidate; does not crash.
- **Exception inside a phase** → caught, logged as a `decide` decision with
  `outcome: 'failure'`, counts toward `noProgress`.
- **repoPath escape** → any computed edit path resolving outside `repoPath` is a
  hard handback (risk boundary), never applied.

## Testing (Vitest)

- `engineering-loop.test.ts`:
  - terminates on **success** when verify goes green and findings clear.
  - terminates on **budget** when `maxIterations` hit with verify still red.
  - terminates on **handback** when `noProgress` reaches `maxNoProgress`.
  - resumes from a written `LoopState` checkpoint.
  - refuses to start with an undetectable verify command.
  - never applies an edit outside `repoPath` (risk-boundary handback).
  - `autoApply: false` waits instead of editing.
- `decision-journal.test.ts` (extend): `narrateLoop` renders plan/act/decide in
  order; tolerates an empty decision list.
- All analyzer / verify / reflexion calls are stubbed — no real repo clone, no
  network, no real build, per project testing rules.

## Rollout

1. Land Unit 2 (narration extension) — additive, low risk, unblocks Unit 1.
2. Land Unit 1 behind an explicit entrypoint (CLI subcommand / MCP tool wiring is
   a follow-up, not this spec).
3. Default `autoApply: true`, `narrateTo: ['journal', 'stdout']`, Discord off.

## Open questions (resolved)

- Auto-apply vs propose-only → **auto-apply**, with **handback on stuck**.
- Narration default → **journal + stdout**; Discord opt-in.

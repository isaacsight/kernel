/**
 * K:BOT Self-Evolution API
 *
 * kbot is the first open-source CLI agent that can improve its own source code.
 *
 * The evolution loop:
 *   1. DIAGNOSE  — Analyze learning data, error logs, and tool usage to find weaknesses
 *   2. PROPOSE   — Generate targeted code changes to address each weakness
 *   3. VALIDATE  — Typecheck (tsc) and run tests to verify the change is safe
 *   4. SCORE     — Measure quality delta (did the change actually help?)
 *   5. APPLY     — Commit good changes, roll back bad ones
 *   6. LOG       — Record everything to ~/.kbot/evolution-log.json
 *
 * Safety guarantees:
 *   - Only modifies files in packages/kbot/src/ (never configs, node_modules, etc.)
 *   - Protected files: evolution.ts, cli.ts, auth.ts, test files
 *   - Uses git stash for instant rollback on any failure
 *   - Max 3 changes per cycle (bounded blast radius)
 *   - Never auto-publishes or pushes
 *
 * Install:
 *   npm install -g @kernel.chat/kbot
 *
 * Usage from the CLI:
 *   kbot          # then type /evolve diagnose
 *   kbot          # then type /evolve
 */

// ── Programmatic API ──

import {
  diagnose,
  formatDiagnosis,
  runEvolutionCycle,
  type Weakness,
  type EvolutionCycle,
} from "@kernel.chat/kbot";

// Step 1: Diagnose weaknesses
//
// Scans learning data, error patterns, and tool usage stats to identify
// areas where kbot underperforms. Returns a list of weaknesses ranked
// by severity.

const weaknesses: Weakness[] = diagnose();
console.log(formatDiagnosis(weaknesses));

// Example output:
//
//   K:BOT Self-Diagnosis
//   ────────────────────
//   [HIGH]   streaming — Response truncation on large outputs (severity: 0.82)
//   [MEDIUM] routing   — Misroutes research queries to coder agent (severity: 0.54)
//   [LOW]    memory    — Slow pattern lookup with >1000 entries (severity: 0.31)
//
//   3 weaknesses found. Run /evolve to fix them.

// Step 2: Run a full evolution cycle
//
// This will:
//   - Re-diagnose (fresh scan)
//   - Generate code patches for the top 3 weaknesses
//   - Apply each patch, typecheck, run tests
//   - Keep patches that pass, roll back patches that fail
//   - Log everything

const cycle: EvolutionCycle = await runEvolutionCycle();

console.log(`Status:    ${cycle.status}`);
console.log(`Proposals: ${cycle.proposals.length}`);
console.log(`Applied:   ${cycle.results.filter((r) => r.applied).length}`);
console.log(`Rolled back: ${cycle.results.filter((r) => !r.applied).length}`);

// Inspect individual results
for (const result of cycle.results) {
  const icon = result.applied ? "+" : "-";
  console.log(`  [${icon}] ${result.area}: ${result.summary}`);
  if (result.qualityDelta) {
    console.log(`      Quality delta: ${result.qualityDelta > 0 ? "+" : ""}${result.qualityDelta}`);
  }
}

// ── Practical examples ──

// Run evolution in CI (e.g., weekly cron job)
//
//   name: Weekly Self-Evolution
//   on:
//     schedule:
//       - cron: '0 3 * * 1'  # Monday 3 AM
//   jobs:
//     evolve:
//       runs-on: ubuntu-latest
//       steps:
//         - uses: actions/checkout@v4
//         - uses: actions/setup-node@v4
//           with: { node-version: '20' }
//         - run: npm install -g @kernel.chat/kbot
//         - run: |
//             kbot --yes --pipe <<< '/evolve'
//             git diff --stat
//           env:
//             ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
//         - uses: peter-evans/create-pull-request@v6
//           with:
//             title: 'chore: kbot self-evolution cycle'
//             branch: kbot-evolve
//             commit-message: 'chore: apply kbot self-evolution improvements'

// Check the evolution log
//
//   cat ~/.kbot/evolution-log.json | jq '.[0]'
//
//   {
//     "id": "evo-2026-03-14-001",
//     "startedAt": "2026-03-14T03:00:00Z",
//     "endedAt": "2026-03-14T03:02:14Z",
//     "status": "completed",
//     "weaknesses": [...],
//     "proposals": [...],
//     "results": [
//       { "area": "streaming", "applied": true, "qualityDelta": 0.12 },
//       { "area": "routing", "applied": true, "qualityDelta": 0.08 },
//       { "area": "memory", "applied": false, "reason": "typecheck failed" }
//     ]
//   }

# kbot × OSWorld-Verified

Eval harness to measure kbot's computer-use performance against the 369-task OSWorld-Verified benchmark.

## Why

As of 2026-04-19 the leaderboard:
- Claude Mythos Preview — 79.6%
- Holo3-122B-A10B — 78.8%
- Holo3-35B-A3B — 77.8%
- GPT-5.4-Thinking — 75.0%

kbot has the primitives (screenshot/click/type/window ops, 16 tools) but no perception-verification loop, no AX tree, no SoM grounding. Estimated cold run: 30–45%. Closing to 60%+ is the v1 goal.

## Plan

### Phase 1 — Harness (this week)
- [ ] Vendor OSWorld VM config (Ubuntu 22.04 + Chrome + LibreOffice + VS Code + GIMP + VLC)
- [ ] Write `driver.ts` that implements OSWorld ActionSpace (click/type/scroll/key/screenshot)
- [ ] Bridge to kbot's `computer_*` tools via MCP or direct import
- [ ] `run.ts` — iterate the 361 runnable tasks (excl. 8 Google Drive), capture pass/fail, save traces

### Phase 2 — Perception (next week)
- [ ] `axtree.ts` — macOS AX API reader via AppleScript `System Events` (already wired in kbot)
- [ ] `som.ts` — Set-of-Marks overlay: screenshot + numbered boxes on detected UI elements
- [ ] `verify.ts` — post-action screenshot diff + "did the intent land?" check via VLM
- [ ] Route vision through `qwen2.5-vl:7b` via Ollama (free, local) for grounding

### Phase 3 — Publish
- [ ] Blog post: `kbot on OSWorld-Verified — 30%→60% in two weeks`
- [ ] HN, X, Discord
- [ ] Add to kbot README as continuously-tracked metric

## Running

TBD — scaffold in progress.

## Files

- `driver.ts` — OSWorld ActionSpace → kbot tool bridge (stub)
- `run.ts` — orchestrator that loops tasks and writes `results.jsonl`
- `axtree.ts` — macOS accessibility tree reader (stub)
- `som.ts` — set-of-marks overlay (stub)
- `verify.ts` — verify-after-action loop (stub)
- `docker/` — OSWorld VM wrapper (vendored from xlang-ai/OSWorld)

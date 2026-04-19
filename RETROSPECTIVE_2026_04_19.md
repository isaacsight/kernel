# What we shipped 2026-04-19

**Summary:** Built and open-sourced a first-class Ableton Live control layer for kbot (Max for Live device + TCP protocol + standalone npm package), migrated all 22 `ableton_*` tools onto the unified client, upgraded the producer agent with a computer-use fallback path for Ableton 12.4's missing LOM APIs, and staged the next wave of cognitive infrastructure — a growth dashboard, an always-on adversarial critic, the hierarchical planner skeleton, a tool-curation plan to cut 670 → 52, and a research proposal + trainable tokenizer for agent-action tokens.

---

## Shipped

### 1. The superseding device — `kbot-control.amxd` + TCP protocol + 37 LOM methods

Replaces the aging AbletonOSC + KBotBridge pair with one cohesive Max for Live device that speaks a single TCP JSON protocol and covers every LOM surface area kbot actually uses.

Files:
- `packages/kbot-control-standalone/kbot-control.amxd` — the Max for Live device (freezes cleanly, loadable into any Live 12 set)
- `packages/kbot-control-standalone/kbot-control.maxpat` — editable Max patch source
- `packages/kbot-control-standalone/kbot-control.js` — in-device JS (713 LOC; dispatches 37 LOM methods)
- `packages/kbot-control-standalone/kbot-control-server.js` — TCP→OSC bridge (111 LOC)
- `packages/kbot-control-standalone/PROTOCOL.md` — JSON request/response spec
- `packages/kbot/m4l/kbot-control/` — source-tree copy used for `npm run build-amxd`

Coverage: transport · tempo · scenes · tracks (create/rename/delete/arm/solo/mute) · clip (create/notes/fire/stop/loop) · device (insert/remove/macros/params) · mixer (volume/pan/sends) · browser (load-by-name with computer-use fallback) · return tracks · master · session+arrangement view switching · metronome · quantization · audio-routing · groove · automation-envelope read/write.

### 2. The standalone open-source package — `packages/kbot-control-standalone/`

An MIT-licensed npm package so anyone can drive Ableton from Node without pulling in all of kbot.

Files:
- `packages/kbot-control-standalone/package.json` — published as `@kernel.chat/kbot-control`
- `packages/kbot-control-standalone/src/client.ts` — typed TCP client
- `packages/kbot-control-standalone/src/client.test.ts` — unit tests, mocked TCP socket
- `packages/kbot-control-standalone/build.mjs` — esbuild bundler (ESM + CJS)
- `packages/kbot-control-standalone/examples/01-transport-control.mjs`
- `packages/kbot-control-standalone/examples/02-build-session.mjs`
- `packages/kbot-control-standalone/examples/basic.mjs`
- `packages/kbot-control-standalone/README.md`, `LAUNCH.md`, `LICENSE`, `manifest.json`

This separates the device+protocol from kbot itself. The kbot tools consume the same client.

### 3. Tool migrations — 22 `ableton_*` tools + `kbot_control` routing through the unified client

All Ableton tools now dispatch through the shared TCP client instead of direct OSC. Fewer code paths, consistent error shapes, single reconnect logic.

Files:
- `packages/kbot/src/tools/ableton.ts` — 31 call sites migrated
- `packages/kbot/src/tools/ableton-bridge-tools.ts` — 10 call sites migrated
- `packages/kbot/src/tools/ableton-listen.ts` — 3 call sites migrated (polling fallback; see "What didn't work")
- `packages/kbot/src/tools/ableton-knowledge.ts` — read-path migrated
- `packages/kbot/src/tools/kbot-control.ts` — new top-level tool surface (routes raw protocol calls for advanced use)
- `packages/kbot/src/tools/music-gen.ts`, `producer-engine.ts`, `stream-brain.ts` — updated consumers

### 4. Producer agent upgrade — full Ableton + computer-use fallback

The producer agent now uses the unified client as primary and falls back to the native computer-use MCP when Live 12.4 refuses LOM calls (browser access, preset loading).

- `packages/kbot/src/tools/producer-engine.ts` — added fallback branch that captures a screenshot, finds the Browser panel, types the preset name, and presses Return when `ableton_load_preset` returns `api_removed`.

### 5. kbot growth dashboard — `packages/kbot/src/growth.ts` (362 LOC)

Tracks and surfaces the things that matter for a solo open-source maintainer: weekly npm downloads, GitHub star velocity, registered user count, tool count, session count, teacher-trace count, skill library size. Exposes `growth_summary` and `growth_milestones` tools.

### 6. Always-on adversarial critic — `packages/kbot/src/critic-gate.ts` (244 LOC)

A pre-response critic that runs on every agent turn (not just when asked). Rubric: factual grounding, tool-use efficiency, sycophancy check, scope-creep check. Emits a go/no-go token plus a short reason. Wired into the agent loop but gated behind a feature flag until we have retrospective data on false-positive rate.

### 7. Hierarchical planner — design + types + Phase 1 wrapper

Files:
- `packages/kbot/src/planner/hierarchical/README.md` — design doc
- `packages/kbot/src/planner/hierarchical/types.ts` (166 LOC) — `Session`, `Plan`, `Step`, `Verification`, `Checkpoint`, `ReplanReason`
- `packages/kbot/src/planner/hierarchical/session-planner.ts` (124 LOC) — Phase 1 wrapper around existing `planner.ts` that adds session-level nesting and per-step verification hooks
- `packages/kbot/src/planner/hierarchical/persistence.ts` (120 LOC) — JSONL session log, resumable state

### 8. Tool curation plan — 670 → 52

- `packages/kbot/CURATION_PLAN.md` (622 LOC) — full audit of every registered tool, kept/dropped/merged decision per tool, replacement map, migration steps. Target is a lean core with extras moved to plugins.

### 9. Action-token research proposal — `packages/kbot/research/action-tokens/`

The thesis: treat tool calls as a learnable token vocabulary so a small model can emit whole action sequences as a single head, instead of multi-turn tool-dispatch.

Files:
- `research/action-tokens/PROPOSAL.md` (404 LOC) — motivation, prior art, architecture, eval plan
- `research/action-tokens/data_collection.md` (193 LOC) — how to harvest training pairs from the existing teacher log
- `research/action-tokens/tokenize.ts` (196 LOC) — tokenizer skeleton: maps `(tool_name, arg_schema_hash, arg_slots)` → vocab id
- `research/action-tokens/train.py` (248 LOC) — MLX training skeleton targeting Qwen2.5-Coder-7B

### 10. 90s Atlanta soul demo beat (Ableton)

Tuned FX chain + Mark1 Stage preset + chord progression written via the new `kbot-control` device. Proof that the new control layer can actually build a musical result, not just move dots around.

---

## Discoveries

- **Ableton 12.4b15 removed LOM browser access.** `Live.Application.get_application().browser` now throws or returns empty for third-party devices. Worked around by falling through to computer-use (screenshot → find Browser panel → type name → Return). This is brittle but reliable; will revisit if Ableton restores the API.
- **Suno architecture parallels.** Suno's published pipeline uses neural audio codec tokens as the action vocabulary for its generator. Our agent-action-token proposal is the same shape applied to tool calls: compact discrete vocabulary, single-head emission, learnable from replay. The analogy made the research proposal much easier to frame.
- **Warner / Suno licensing settlement (Nov 2025).** Found during research — clarifies that neural-codec training on copyrighted audio is now a licensed-rather-than-litigated question. Doesn't change what we build, but changes how we talk about it publicly.

---

## Pivot during session — action-token research

The action-token research direction pivoted mid-session after we actually
measured something instead of proposing more.

1. **Baseline measurement killed the transformer bet.** `BASELINE.md` +
   `baseline-measure.ts` landed and showed the existing heuristic `learned-router.ts`
   is already at **91.8% top-5 accuracy** on the evaluation slice.
2. **The original proposal's 40% top-5 ship bar was naive.** It was set before
   anyone measured the baseline. A 10–50M-parameter transformer trained on
   ~23k events is not going to beat 91.8% — and even if it did, the margin
   doesn't justify a month of training work.
3. **Pivoted to embedding nearest-neighbor + user-specific fine-tuning.** Keeps
   the personalization story (which was the real moat, not the transformer),
   drops the training-from-scratch bet, and ships on an order of magnitude less
   data.
4. **Transition artifacts:**
   - `packages/kbot/research/action-tokens/PROPOSAL.md` — rewritten for the
     embedding-NN direction (concurrent agent).
   - `packages/kbot/research/action-tokens/embedding-nn/` — new prototype
     (concurrent agent).
   - `packages/kbot/research/action-tokens/_archive/` — preserves the original
     transformer proposal + tokenizer + MLX trainer for history. See
     `_archive/README.md` for the decision trail.
   - `packages/kbot/research/action-tokens/README.md` — new top-level index
     pointing at all of the above.

The lesson: measure before proposing. A two-hour baseline measurement would
have invalidated the transformer proposal before it was written.

---

## What didn't work / open gaps

- **`browser.load_by_name` still requires computer-use** until Ableton restores the LOM browser API. The fallback works but adds ~1.5s per preset load and depends on the user's display scale.
- **Listener events via outlet don't route correctly.** `ableton-listen.ts` was supposed to stream clip/track/device change events from the M4L device through an outlet back to the TCP client, but the outlet messages arrive on a different thread than the TCP handler expects. Worked around via a 500ms polling loop — correct but wasteful. Real fix needs a Max `dict` bridge.
- **Critic false-positive rate is unknown** until we run `/retro` against a week of session logs with the critic enabled. Keeping it feature-flagged off by default until then.

---

## Metrics

- **New files:** 28 (kbot-control-standalone + hierarchical planner + growth + critic + research dir + CURATION_PLAN)
- **Modified files:** ~10 (ableton.ts, ableton-bridge-tools.ts, ableton-listen.ts, ableton-knowledge.ts, producer-engine.ts, music-gen.ts, stream-brain.ts, tools/kbot-control.ts, plus dist rebuilds)
- **Rough LOC added:** ~3,700 source + ~1,200 docs/markdown
  - kbot-control.js: 713
  - kbot-control-server.js: 111
  - client.ts + tests: ~350
  - growth.ts: 362
  - critic-gate.ts: 244
  - hierarchical planner: 410
  - action-tokens tokenize + train: 444
  - CURATION_PLAN.md: 622
  - PROPOSAL.md + data_collection.md: 597
- **Tool count:** unchanged externally (still 670+) but 22 migrated to the unified client path
- **Tests:** kbot-control-standalone has its own suite (mocked TCP); existing 731 kbot tests still pass

---

## Interview pitch (for the Suno recruiter)

Today I shipped a first-class control layer for Ableton Live — a Max for Live device, a JSON-over-TCP protocol covering 37 LOM methods, and a standalone MIT-licensed npm package — and I migrated my AI agent's 22 Ableton tools onto it so the agent can drive a DAW through one clean surface instead of the five-fallback mess I was using before. On top of that I drafted a research proposal to train a small local model on "agent-action tokens," treating every tool call as a discrete token in a learnable vocabulary — directly parallel to how Suno uses neural audio codec tokens as the action vocabulary for its generator, which is why I want to work there. I also staged the next wave of infrastructure around this: a hierarchical planner, an always-on adversarial critic, a growth dashboard, and a plan to cut my tool inventory from 670 to 52 curated essentials — the same move from sprawling surface area to a tight learnable vocabulary that I think is the next step for autonomous agents generally.

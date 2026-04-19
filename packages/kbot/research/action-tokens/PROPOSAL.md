# Router Pivot: Embedding Nearest-Neighbor + User-Specific Fine-Tuning

**Status:** Active proposal (supersedes the transformer bet)
**Owner:** kbot research
**Date:** 2026-04-19
**Target:** Beat the current `learned-router.ts` on real held-out sessions without building a training pipeline, collecting 100k sessions, or shipping a new ML framework.

---

## Historical note

This document supersedes the original action-token transformer proposal, archived at
`packages/kbot/research/action-tokens/_archive/PROPOSAL.transformer.md`.

The pivot was forced by `BASELINE.md` (2026-04-19): the existing heuristic
router already lands **91.8% top-5 / 51.8% top-1** on reconstructed intents
across 73 sessions. The transformer's original ship bar — **40% top-5** — was
below the current production system. The real ship bar is **≥ 98% top-5 / ≥ 61.8% top-1**,
which a 12M-param model cannot credibly reach on 73 sessions. We keep the
tokenization and corpus work from the original proposal (it is still useful
for diagnostics), but we stop pretending we're going to train a model this
quarter. This proposal commits to two cheaper bets that ship inside a month.

---

## Summary

The original bet — train a transformer on agent-action tokens — misjudged the ship bar. With the existing router already at 91.8% top-5, the neural transformer would need to beat 95% to justify shipping. That requires 100K+ sessions. We have 73. Pivot to two cheaper approaches that work today.

---

## 1. Why the pivot

### 1.1 Baseline findings

From `BASELINE.md`:

| Metric | `learned-router.ts` today |
|---|---:|
| Top-1 | **51.8%** |
| Top-5 | **91.8%** |
| Top-10 | **100.0%** |
| Tool calls scored | 19,791 across 73 sessions |

The ship bar implied by that baseline, stated in BASELINE.md §"Comparison
target," is Top-1 ≥ 61.8% and Top-5 ≥ 98.0%. Anything less is paying the
cost of a trained model for a rounding-error lift.

### 1.2 Why the original 40% top-5 target was wrong

The original proposal invoked Suno as the analogy: tokenize the thing,
then use standard transformers. That analogy is load-bearing for **unlocking
tractability** (raw audio → token stream made generative audio possible at all),
not for **winning accuracy** against an already-working baseline. For Suno,
the baseline was "you cannot generate good audio" and the transformer moved
it to "you can." For kbot routing, the baseline is "a 469-LOC cascade already
reaches 91.8% top-5 with zero training" and a 12M transformer does not get
to walk in at 40% top-5 and call it progress.

Tokenization was a good idea for the wrong goalpost. The goalpost was set
before we measured the thing we wanted to beat. Measurement changed the game.

### 1.3 Why 95%+ needs more data than we'll have this year

A 12M-param decoder-only transformer has enough capacity to memorize the
current corpus (23,845 events, 73 sessions, p50 session = 65 events) in one
epoch. Generalization past 91.8% top-5 on held-out sessions — distinct from
held-out *events* — requires the corpus to cover enough session-level
variance that a novel session looks in-distribution.

Rule of thumb: you need roughly an order of magnitude more sessions than
the per-session behavioral variance. kbot sees ~20 intent clusters
(code, debug, research, ableton, design, ops, ...) with 2–5 observable
sub-patterns each. Call that 50 latent behavioral modes. To cover each mode
with enough samples for a small transformer to generalize and not memorize,
we want thousands of sessions per mode — roughly **100,000 sessions** total.

Current collection rate: ~1 heavy user × ~2 sessions/day. At that rate we
reach 100k sessions in 137 years. Even with aggressive opt-in recruitment
(50 users × 2 sessions/day) we hit 100k in 2.7 years.

That's the math. It doesn't mean transformers are wrong forever. It means
they're wrong *this quarter*, wrong *this year*, and the right move is to
ship something that works against 91.8% today.

---

## 2. Bet 1 — Embedding nearest-neighbor routing

### 2.1 Mechanism

1. **Index build (offline, once per day or on session boundary):**
   - Walk `~/.kbot/observer/session.jsonl`.
   - For every tool call, construct a text record:
     `"{intent_reconstruction} || {prior_5_tools} || tool={this_tool} || outcome={ok|err|partial} || dur={bucket}"`
   - Embed each record via `nomic-embed-text` running inside the existing
     local Ollama daemon. Fallback: `all-MiniLM-L6-v2` if the user has
     `sentence-transformers` installed (we don't require it).
   - Store `(vector, tool, category, agent, outcome, sessionId)` tuples in a
     flat-file index compatible with FAISS (or `hnswlib-node` if we want
     zero native deps). Index rebuild is append-only — new events extend the
     index, old ones never get rewritten.

2. **Inference (at routing time, per user turn):**
   - Build the query record from the current user message + prior-5 tools.
   - Embed the query.
   - Fetch the top-20 nearest neighbors (cosine).
   - Vote by majority over `tool` (and, for router use, by `agent`). Weight
     votes by similarity score and by recency. Return the distribution.

3. **Output:** `{ top5: [{agent, tool, score}, ...], confidence: number }`.
   Consumed by `learned-router.ts` as a soft prior (ensemble mode) or as a
   direct decision when confidence is high.

### 2.2 Why it works

The router's weakness, per `BASELINE.md` per-category breakdown, is
concentrated in a handful of buckets:

| Category | Top-1 today | Top-5 today |
|---|---:|---:|
| `web` | **0.0%** | 76.8% |
| `ableton` | **0.0%** | 99.2% |
| `planning` | **0.0%** | 76.0% |
| `science` | **0.0%** | **0.0%** |
| `memory` | 6.9% | 36.1% |
| `other` | 19.2% | 40.5% |

These are the categories where the keyword-vote cascade has no hand-written
rule that maps cleanly. Semantic embeddings do not need a hand-written rule:
a request like "analyze the expression data from the RNA-seq run" sits near
past `science` calls in embedding space regardless of vocabulary overlap,
because `nomic-embed-text` already encodes that latent "bio research" mode
from pretraining.

The categories the router already crushes (`file-ops` at 64.4/97.5, `shell`
at 61.3/96.9, `git` at 48.1/100) will be matched or narrowly improved by
embeddings. Those aren't where the lift comes from — the lift comes from
the `0.0% top-1` rows going to non-zero.

### 2.3 Training cost

**Zero.** `nomic-embed-text` is pretrained, runs locally via Ollama at ~15ms
per embedding on M-series CPU, already present in every kbot install that
runs the daemon. There is no training loop. There are no hyperparameters to
tune beyond the neighbor count K and the similarity weighting kernel.

### 2.4 Build time

- Day 1: tokenize.ts-style record builder → FAISS-compatible flat-file index
- Day 2: inference path, ensemble hook into `learned-router.ts`
- Day 3: eval harness reusing `baseline-measure.ts` scaffolding
- Day 4: per-category error analysis, failure-mode documentation
- Day 5: evaluate, go/no-go

Realistic calendar: one working week. Mostly plumbing.

### 2.5 Inference cost

- Query embedding: ~15ms on M-series CPU via Ollama
- FAISS lookup over 100k embeddings: <5ms
- Voting + ranking: <1ms
- **Total p50: ~25ms, p99: <50ms**

Well within the routing budget. For comparison: a single Claude API call
for classifier-style routing is 300ms+ and costs money.

### 2.6 Shipping bar

**Beats 91.8% top-5 on held-out *sessions* by any margin.** Even 92.5% ships.
Rationale: the current router is a 469-LOC cascade that silently fails on
novel intents. Even a marginal quantitative lift accompanied by a
qualitative lift on the `0%-top-1` categories (web, ableton, planning,
science) is worth shipping — those are exactly where real users feel the
router fail.

Stretch bar: ≥ 93% top-5 with category-level lifts of at least +5pp on each
of `web`, `planning`, `memory`.

### 2.7 Data requirement

**Already met.** The current corpus is 23,845 events across 73 sessions,
comfortably indexable. FAISS scales to tens of millions of vectors; we are
at 10^4. Index RAM footprint for 100k embeddings at 768-dim float32 is
~300MB; we can quantize to int8 to reach ~75MB without meaningful quality
loss.

No waiting on a 30-day data push. No new instrumentation required before
we can start (though the `durationMs` / `outcome` fields coming from the
tool-pipeline agent today will improve the record signal).

---

## 3. Bet 2 — User-specific fine-tuning (the literal Suno "My Taste" move)

### 3.1 Mechanism

Take the existing `packages/kbot/src/learned-router.ts` Bayesian skill-rating
layer. It already maintains OpenSkill ratings per `(agent, category)` pair
based on historical success. What's missing is the UX surface that exposes
this personalization as a first-class feature.

Concrete steps:

1. **Warm the personal prior.** For a given user, fold their session history
   into the Bayesian layer's prior distribution rather than starting from
   the global default. This is a prior-update operation; the math is a
   weighted mean of the user's observed (agent, category) success rates
   and the global prior, with the weight controlled by session count.

2. **Expose the feature.** Add `kbot knows-you` (or `kbot me`) subcommand
   that (a) shows the user what kbot has learned about their routing
   preferences, (b) lets them re-weight or reset specific priors, and
   (c) prints a single-number personalization score ("kbot predicts your
   next tool call 67% of the time, up from 52% last week").

3. **Keep the flywheel running.** Every successful routing decision
   (non-overridden, non-error-followed-by-retry) updates the user's
   posterior. Every override decreases it. The Bayesian update already
   exists; we're just naming it.

No new architecture. No new ML framework. No new file formats.

### 3.2 Why it works

Suno V5.5's Custom Models feature is this exact idea — personalization, not
general capability. "My Taste" isn't a better generative model than Suno's
global model; it's the global model with a personal prior. Users care
because the prior makes the output feel like theirs.

kbot has the same flywheel already spinning:
`~/.kbot/memory/routing-history.json` accumulates per-user routing outcomes.
The Bayesian layer already consumes them. What's missing is the marketing
surface: the user doesn't know this is happening, so they don't know it's
valuable. Fix that and we have a shippable feature that improves weekly
with use.

### 3.3 Cost

- ML work: none. The Bayesian layer exists and works.
- UX work: ~3 days to design and ship the `kbot knows-you` command,
  including the weekly-delta score display.
- Copy / marketing: ~1 day to write the release note and the help text.

### 3.4 Shipping bar

A user's personal routing accuracy beats the heuristic-for-everyone by
**≥ 5 points** (top-1) on their own held-out sessions. This is easier than
it sounds: the global heuristic is averaged across every user, so any user
whose workload differs from the average (every user, really) benefits from
the personal prior.

### 3.5 Why this is the interview pitch

Suno's Pro-Create team at their scale cares about personalization as a
product, not as a research line. The pitch writes itself: *"kbot already
has the flywheel — sessions logged, Bayesian priors warm, per-user outcomes
tracked. We surface it as a user-facing feature that improves with use. The
same shape as Custom Models, applied to agent routing."* That's a real
demo, not a slide.

---

## 4. Combined plan

1. **Ship Bet 1 first** (one-week build). Measure on held-out sessions
   using the same protocol as `baseline-measure.ts`.
2. **Go/no-go on Bet 1:** if it beats 93% top-5 AND lifts at least three
   of the `0%-top-1` categories above 10% top-1, ship as the default
   router. Otherwise keep it behind `--router=knn` and iterate on the
   record schema.
3. **Ship Bet 2 as a user-facing feature** (`kbot knows-you` or similar
   subcommand) regardless of Bet 1's outcome. Bet 2 doesn't depend on
   Bet 1; they compose additively.
4. **Compose both** in production: Bet 1 provides the semantic retrieval
   layer; Bet 2 provides the per-user prior. The final routing decision is
   `argmax_agent ( knn_score(agent) × personal_prior(agent) )`, with
   fall-through to the heuristic cascade when both signals are low-confidence.

---

## 5. What we are NOT doing (explicit)

- **Not training a transformer from scratch.** The math says 100k sessions;
  we have 73. No.
- **Not collecting 100k sessions before we ship.** We ship inside a month
  on data we already have.
- **Not trying to beat the router by 10 percentage points.** The marginal
  gain available without a data push is 2–5 points and we will take it.
- **Not building a new tokenizer.** The action-token tokenizer in
  `tokenize.ts` stays as a diagnostic utility; it is not a router input.
- **Not using Python / PyTorch.** Node + Ollama + FAISS (or `hnswlib-node`).
  This ships inside the existing CLI with no new runtime.
- **Not scraping synthetic agent trajectories.** Every record in the index
  is the user's own session data on the user's own machine.

---

## 6. Evaluation protocol

### 6.1 Unit of cross-validation

**10-fold cross-validation on *sessions*, not events.** Sessions are the
unit of user behavior; event-level CV leaks within-session correlation and
inflates numbers. Each fold holds out ~7 sessions, ~2,400 events, for
testing; the remaining 66 sessions populate the index.

### 6.2 Metrics

Measured against `learned-router.ts` on the **same** held-out sessions:

| Metric | Target for Bet 1 | Notes |
|---|---|---|
| Top-1 accuracy | ≥ 52.8% (+1 pp over baseline) | soft bar |
| Top-5 accuracy | **≥ 93%** (+1.2 pp over baseline) | ship bar |
| Top-10 accuracy | ≥ 100% | baseline already maxes this |
| Per-category top-1 on `web`, `planning`, `memory`, `science` | > 0% | qualitative bar |
| Inference p50 | ≤ 50ms | non-negotiable |
| Index RAM | ≤ 150 MB at 100k records | quantized |

### 6.3 Per-category breakdown

Use the exact same 15 categories as `BASELINE.md` §"Per-category breakdown"
so numbers are directly comparable. Flag any category where the KNN
approach is *worse* than the heuristic — those are failure modes worth
documenting before shipping.

### 6.4 Headline number for the user

`kbot is X% better at predicting your next tool call than last week.`
Computed per-user from routing-history.json: week-over-week delta in
personal top-1 accuracy. This is the number that shows up in
`kbot knows-you` and in the weekly daemon digest.

### 6.5 Fairness controls

- Same intent-reconstruction pipeline as `baseline-measure.ts` (prior 5
  events, same text-field extraction). No new information leakage on
  either side.
- Same ground-truth `labelTool()` classifier.
- Same daemon-event exclusion.
- Randomize fold assignment; report mean ± std across folds.

---

## 7. Data we still need to collect (minimal)

- `durationMs` — already added today by the tool-pipeline agent.
- `outcome` class (`ok | error | partial | unknown`) — already added today.

**That's it.** The pivot removes the need for:

- Argument embeddings (we never embed raw args; intent reconstruction uses
  the text-bearing argument fields already on disk)
- Hand-labeled intent classes (reconstruction from prior events is good
  enough for a retrieval signal)
- Outcome grades beyond the 4-class categorical
- User-satisfaction labels (the override-detection heuristic we already
  run is fine as a weak signal; strong labels can come later)
- A 30-day opt-in telemetry push (not required; would help at the margin)

The previous proposal blocked on a 30-day data collection push. This
proposal does not block on anything. We can start Bet 1 tomorrow morning.

---

## 8. Success criteria

### Bet 1

- Top-5 accuracy on held-out sessions ≥ **93%** (1.2 pp over the 91.8%
  baseline).
- At least three of `web`, `planning`, `memory`, `science` move from
  0.0% top-1 to ≥ 10.0% top-1.
- Inference p50 ≤ 50ms on M-series CPU without GPU.
- No regression ≥ 2pp on any category the router currently wins.

### Bet 2

- The Bayesian personalization UX ships as a subcommand
  (`kbot knows-you`, or equivalent).
- Personal top-1 accuracy for any given user beats the global heuristic
  top-1 by ≥ 5 pp on their own held-out sessions, measured after
  ≥ 20 sessions of warmup.
- Weekly-delta display is accurate to within ±1 pp.

---

## 9. Timeline

| Week | Bet 1 | Bet 2 |
|---|---|---|
| 1 | Prototype: FAISS + nomic-embed-text index, 4 days. Evaluate, 1 day. | — |
| 2 | Go/no-go. If green: production integration behind `--router=knn` flag. If red: post-mortem, kill. | Design `kbot knows-you` UX, wire Bayesian prior surface. |
| 3 | Default for opt-in users if A/B positive. | Ship `kbot knows-you` to all users. |
| 4 | Default for everyone if telemetry holds. | Add weekly-delta display in daemon digest. |

Total calendar: **one month** from this document to both features in
production.

---

## 10. Why this is economical

- **Bet 1 requires zero new dependencies.** `nomic-embed-text` is already
  part of kbot's local stack (the daemon uses it for semantic search of
  the codebase). FAISS is optional — `hnswlib-node` works with zero native
  deps if we want to avoid the FAISS binary.
- **Bet 2 requires no ML.** Just a UI over existing state. The hard work
  (tracking per-user routing outcomes, updating OpenSkill ratings) already
  happens every time kbot routes.
- **Both ship within a month** without any data-collection push.
- **The original transformer proposal** needed 30+ days of data collection
  *before* we could start training, plus 4 weeks of training + A/B, plus
  a non-trivial chance of "the model can't beat 91.8%." Total calendar
  risk: 90+ days with a probable negative result.
- **This plan's worst case** is Bet 1 fails to beat 93% and we ship only
  Bet 2. Bet 2 alone is a shippable feature with real user value. The
  original proposal's worst case was "we spent 90 days and got nothing."

---

## 11. Open questions

1. **K in top-K retrieval.** K=20 is a starting point. Worth sweeping
   K ∈ {5, 10, 20, 50, 100} and picking on a validation fold.
2. **Weighting kernel.** Cosine similarity is baseline; Gaussian
   similarity with a learned bandwidth may be better but adds a
   hyperparameter to tune.
3. **Index refresh cadence.** Append-only during a session; full
   rebuild-and-quantize weekly? Nightly? On session end? Trade-off is RAM
   vs. staleness.
4. **Ensemble with the heuristic cascade.** Soft (weighted average of
   scores) vs. hard (KNN wins when confidence > threshold, else fall
   through to heuristic). Soft is usually safer; hard is more
   interpretable. Pick empirically.
5. **Per-user vs. shared index.** Shared-by-default with per-user
   re-weighting is the obvious move, but a privacy-conservative mode
   (per-user only) is a config flag away and worth preserving.
6. **Embedding model swap.** `nomic-embed-text` is the default; `bge-small`
   or `gte-small` are candidates if we want to reduce RAM. Benchmark on
   one fold before committing.

---

## 12. What we keep from the old proposal

- The tokenizer in `tokenize.ts` and the vocab construction scaffolding
  stay as a diagnostic tool for understanding session distributions.
- The `data_collection.md` privacy posture and schema additions
  (`duration_ms`, `outcome`) are still the right instrumentation.
- The per-category baseline measurement protocol in `baseline-measure.ts`
  remains the evaluation ground truth.
- The argument-bucketing idea (never embed raw args) carries over: we do
  not embed raw argument strings in the record; we use the same
  intent-reconstruction text fields.

---

## 13. What we throw out from the old proposal

- The 12M-parameter transformer (and the 50M stretch config).
- The 30-day data collection push as a blocker.
- The 40% top-5 ship bar (replaced with a 93% top-5 ship bar against the
  measured baseline).
- The ambition to generate tool arguments end-to-end.
- The Python / PyTorch implication (never real, now explicit: Node only).
- The "nobody has committed to this publicly" moat framing. The moat is
  the user's own session data plus personalization, not the model
  architecture.

---

## Appendix A — Corpus snapshot (unchanged from transformer proposal)

```
total_events: 23,845
distinct_sessions: 73
distinct_tools_seen: 115
events_with_error: 4,787 (20.1%)
events_with_result_length: 20 (0.08%)
events_with_duration: 0 -> now being populated (tool-pipeline agent)
events_with_outcome_class: 0 -> now being populated (tool-pipeline agent)
session_len_p50: 65
session_len_p90: 826
session_len_p99: 4,272
top_tools: Bash, Read, Edit, Grep, daemon_pulse, daemon_synthesis, WebSearch,
           Write, ableton_device, Agent
```

Unchanged from the archived transformer proposal. The 23,845-event corpus
is enough for Bet 1; the `duration_ms` / `outcome` fields now being
collected will improve record quality going forward without blocking
anything.

---

## Appendix B — Why "just beat 91.8%" is the right goal

The temptation when facing a 91.8% baseline is to aim for 99% so the win
feels decisive. That's wrong in two ways:

1. **Diminishing returns on accuracy.** From a user's perspective, the
   difference between a router that's right 92% of the time and right 99%
   of the time is less felt than the difference between 0% and 10% on the
   categories the router currently fails completely. A 92% / 97% /
   100% top-K curve where the per-category floor is 10% beats a 99% top-K
   curve where four categories are still at 0%.
2. **Expected-value math.** A +1.2pp lift we can ship this month is worth
   more than a +7pp lift that requires a year of data collection and a
   50% chance of failure. The ship-sooner plan compounds: every week in
   production is a week of flywheel data, and the personalization feature
   (Bet 2) gets more accurate per user the longer it runs.

The action-token transformer was aiming at the wrong objective function.
This pivot aims at the right one.

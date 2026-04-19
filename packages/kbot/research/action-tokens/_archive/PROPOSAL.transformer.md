# Action-Token Language Models for Agent Routing

**Status:** Research proposal + PoC skeleton
**Owner:** kbot research
**Date:** 2026-04-19
**Target:** Replace heuristic `learned-router.ts` with a small transformer trained on agent-action tokens.

---

## 0. TL;DR

Suno made generative audio tractable by tokenizing raw waveforms into discrete neural-codec tokens and then training standard autoregressive LMs on the token stream. The same move is available for agent behavior: treat every tool call as a token, and learn a small LM over tool-call sequences.

If this works, kbot's router stops being pattern-matching over keywords and becomes a 10–50M-parameter next-action predictor — trained on real user sessions, personalized per user, runnable on a consumer CPU at <50ms p50.

Honest bottom line: the data we have right now (23k tool-call events across 73 identified sessions, 115 distinct tools, no outcome or intent labels) is enough to prototype tokenization and confirm the next-token distribution is non-uniform, but **not** enough to train a router that beats the current heuristic. We need ~30 days of richer collection first. That collection push is the critical path — spec'd in `data_collection.md`.

---

## 1. Motivation

### 1.1 The Suno lesson

Generative audio was stuck for a decade because raw 44.1 kHz PCM has ~44,100 samples per second with ~65,536 values each — far too long and too high-dimensional for sequence models. Neural audio codecs (SoundStream, EnCodec, later iterations at Suno) compressed audio into a vocabulary of ~1,024–4,096 discrete tokens at ~50–75 Hz. Suddenly "generate audio" became "predict next token" — the same problem GPT already solved. Audio generation went from laboratory curiosity to product.

The bottleneck wasn't model capacity. It was **representation**. Once a task has a good tokenization, the autoregressive transformer toolbox handles the rest.

### 1.2 Agent behavior has the same shape

Today an "agent framework" is a hand-crafted router + planner + tool-dispatch loop. Every vendor (Claude Code, Cursor, OpenCode, Aider, kbot) reimplements the same heuristics. Our `learned-router.ts` uses keyword voting, exact-match patterns, and an OpenSkill Bayesian rating per agent-category pair. It works, but it's not a learned function of history — it's a cascade of if-statements.

Claim: a sequence of tool calls is a near-ideal candidate for tokenization.

- **Discrete.** There are a finite, enumerable set of tools (~670 in kbot; ~115 seen in practice per-user).
- **Causal.** Each tool call is conditioned on prior calls and their outcomes. This is exactly the autoregressive setting.
- **Structured but noisy.** There are clear patterns ("Read → Edit → Bash(test)") but also genuine variability that a small LM can capture better than hand-coded rules.
- **Cheap to collect.** kbot already writes every tool call to `~/.kbot/observer/session.jsonl`.
- **Per-user distributions.** Isaac's workload looks different from a user who only does Ableton sessions. A model can learn per-user priors; a heuristic can't.

### 1.3 Why this is kbot's moat

Every agent CLI has tools. Every agent CLI has session logs. Very few have an explicit research program to treat those logs as training data for a small, shippable model that replaces the router. This is the obvious next step and nobody has committed to it publicly.

- Anthropic's Claude Code is closed; its routing is prompt-engineered, not learned.
- Cursor/Copilot focus on completion, not agent routing.
- OpenCode/Aider use rule-based dispatch.
- Factory Droid and Cognition Devin talk about "agent trajectories" but train on scraped synthetic data, not real user sessions on the user's own machine.

A learned router shipped inside kbot that ran on-device, improved with use, and was personalized per user would be the kind of feature that is obvious in retrospect and hard to copy — because copying it requires having the session data, which requires having the users, which requires having shipped the CLI that produces the data.

This is the flywheel: ship CLI → collect sessions → train small router → ship better CLI. kbot has the first two. This proposal covers the third.

---

## 2. Problem Formulation

### 2.1 Inputs and outputs

Given a session history up to time $t$:

$$ H_t = [(a_1, o_1, d_1), (a_2, o_2, d_2), \ldots, (a_t, o_t, d_t)] $$

where $a_i$ is a tool name, $o_i \in \{\text{ok}, \text{error}, \text{partial}\}$ is the outcome class, and $d_i$ is a bucketed duration, predict the next tool's distribution:

$$ P(a_{t+1} \mid H_t, u) $$

where $u$ is an optional user-intent signal (the last user message, embedded or classified).

At inference we return top-k with scores. The router consumes this by either:
- **Soft mode:** bias the existing heuristic toward the top-k (ensemble).
- **Hard mode:** pre-select the agent whose tool distribution best matches top-k, saving a classifier LLM call.

### 2.2 Scope of "tool call"

A tool call is one line in `session.jsonl`. Agent invocations (`Agent`, `subagent`), MCP tools (`mcp__kbot__*`), and native kbot tools all count. Daemon-originated calls (`daemon_pulse`, `daemon_synthesis`) are in a separate stream and excluded from the router training set because they don't reflect user intent.

### 2.3 What we are not trying to do

- We are **not** generating agent trajectories end-to-end (that is a future direction).
- We are **not** generating tool arguments — only the tool name distribution (argument generation is a separate, harder problem).
- We are **not** replacing the LLM's own tool-use reasoning inside a turn. This model augments routing between agents, not tool choice within an agent.

---

## 3. Token Schema

### 3.1 Design

Each tool call is compressed into a single token id drawn from a learned vocabulary of size 8,192–32,768. The token encodes four fields:

```
token = hash(tool_name, args_bucket, outcome_class, duration_bucket) -> vocab_id
```

| Field | Description | Cardinality |
|---|---|---|
| `tool_name` | e.g. `Read`, `Bash`, `mcp__kbot__ableton_device` | ~670 possible, ~115 seen |
| `args_bucket` | Coarse arg signature (see 3.2) | 4–16 per tool |
| `outcome_class` | `ok` \| `error` \| `partial` \| `unknown` | 4 |
| `duration_bucket` | log2-bucketed ms: `<50`, `<500`, `<5s`, `<60s`, `>=60s` | 5 |

Naive product: `670 × 8 × 4 × 5 ≈ 107,200`. We collapse rare combinations into `<unk>` tokens per tool; the actual learned vocabulary is capped at 16,384 by default.

### 3.2 Argument bucketing

We never train on raw arguments — that leaks secrets and blows up the vocab. Instead we compute a small feature vector per tool and hash it to a bucket.

- `Bash` → classify command into `{read_only, git, build, test, destructive, network, other}` (7 buckets).
- `Read`/`Edit`/`Write` → hash directory prefix into 8 buckets (`src/`, `packages/kbot/`, `supabase/`, `.claude/`, `tools/`, `tests/`, `docs/`, `other`). This lets the model learn that Read-in-packages-kbot is predictive of Edit-in-packages-kbot.
- `Grep`/`Glob` → pattern length bucket (short/medium/long).
- MCP tools → 1 bucket (the tool name already carries intent).
- Fallback → 1 bucket.

This schema is implemented in `tokenize.ts`. Buckets are chosen to preserve routing-relevant signal and discard PII.

### 3.3 Special tokens

| Token | Meaning |
|---|---|
| `<bos>` | Start of session |
| `<eos>` | End of session |
| `<turn>` | Boundary between user message and agent response |
| `<user:code>` `<user:music>` `<user:research>` ... | Coarse user-intent label (see §5.2) |
| `<agent:coder>` `<agent:aesthete>` ... | Active agent tag |
| `<unk>` | Unknown/rare tool |
| `<pad>` | Padding |

The input fed to the transformer at turn-start looks like:

```
<bos> <user:code> <agent:coder> Read_src_ok_fast Read_src_ok_fast Grep_med_ok_fast Edit_src_ok_mid Bash_test_err_slow <turn> ...
```

### 3.4 Vocabulary construction

1. Walk the full corpus of session.jsonl.
2. For each event emit `(tool, args_bucket, outcome, duration)`.
3. Count frequencies; keep top-N minus reserved specials; rest → `<unk>`.
4. Persist vocab to `vocab.json` with reverse index.

Estimated vocab size given 115 tools × ~6 avg buckets × 4 outcomes × 5 durations → ~13,800 combinations; after long-tail collapse we expect to ship a 8,192-token vocab.

---

## 4. Model Architecture

### 4.1 Target config

Small GPT-style decoder-only transformer.

| Hyperparam | Value | Rationale |
|---|---|---|
| Vocab size | 8,192 | Covers all realistic tool+bucket combos |
| Context length | 512 tokens | Covers p90 session (~826 events) when pruned |
| Embedding dim | 256 | Small but adequate for 8k vocab |
| Layers | 6 | Transformer depth for small data regime |
| Heads | 8 | Standard |
| FFN dim | 1024 | 4× embed |
| Params total | ~12M | Fits on one 8GB GPU; trains in hours |
| Activation | GELU | Standard |
| Dropout | 0.1 | Regularize given small dataset |

An alternative config at 50M params (layers=12, dim=512) is the upper bound we'd try if 12M underfits.

### 4.2 Training compute

- 23k current tokens → ~5MB dataset. Trivial.
- Projected 30-day collection: ~200k events if collection quality improves (see `data_collection.md`). Still trivial.
- One 3090 / M-series GPU / Colab free tier runs 10 epochs in under an hour.
- Distillation / quantization to int8 for CPU inference: standard.

### 4.3 Inference

- Greedy top-k softmax over vocab, filtered to `tool_name` prefix.
- Target: <50ms p50 on M-series CPU, <5ms on GPU.
- For router use we only need `argmax_tool`, not full distribution, so we compute marginals over tool_name dimension.

### 4.4 Why not a bigger model

Because the dataset is tiny. A 1B-param model will overfit a 200k-token corpus in one epoch and generalize worse than a 12M model. The small-model-small-data argument is the whole reason this project is tractable now.

---

## 5. Data Pipeline

### 5.1 Source of truth

- Raw: `~/.kbot/observer/session.jsonl`, append-only, one JSON line per tool call.
- Current schema: `{ts, tool, args, session, error?, result_length?}`. See `data_collection.md` for what's missing.
- Current size: 23,845 events across 73 distinct session ids.

### 5.2 Pipeline stages

1. **Ingest** — stream `session.jsonl`, partition by `session` field.
2. **Filter** — drop daemon-only sessions; drop sessions with <5 events.
3. **Tokenize** — apply `sessionToTokens()` from `tokenize.ts`.
4. **Augment** — prepend `<user:intent>` tag if user message is available (currently it isn't — see data_collection).
5. **Split** — train/val/test at the **session** level (not event level), 80/10/10. This prevents leakage where later events in a session look like they predict earlier ones in another split.
6. **Per-user holdout** — additionally hold out one session per unique user for personalization eval.

### 5.3 Length distribution (observed)

From current corpus:

| Metric | Value |
|---|---|
| Sessions with ≥5 events | ~60/73 |
| p50 session length | 65 events |
| p90 session length | 826 events |
| p99 session length | 4,272 events |
| Mean | 326 events |

With context 512, we cover full p90 sessions and slide over the rest via causal chunking.

### 5.4 Estimated training volume at 30 days

If kbot's current rate holds (~600 events/day for one heavy user), 30 days = 18k events. If we add opted-in telemetry from even 50 users at modest rates, the corpus multiplies to 200k–500k events — still small by LM standards but enough for a 12M model.

---

## 6. Evaluation Protocol

### 6.1 Primary metrics

| Metric | Definition | Target |
|---|---|---|
| **Top-1 accuracy** | Fraction of next-token predictions where argmax == ground truth tool | ≥20% |
| **Top-5 accuracy** | Fraction where ground-truth tool in top-5 | **≥40%** |
| **Top-10 accuracy** | Fraction where ground-truth tool in top-10 | ≥60% |
| **Perplexity** | Standard LM metric on held-out tokens | Report |
| **Inference p50** | ms per call on M-series CPU | ≤50ms |

### 6.2 Comparison baselines

| Baseline | Expected Top-5 |
|---|---|
| Uniform over 115 tools | 4.3% |
| Bigram (previous tool → next) | ~25% |
| Current `learned-router.ts` | **unknown — needs measurement** |
| Proposed 12M transformer | target ≥40% |

The single most important experimental step is measuring the current heuristic router's actual top-5 accuracy on the same held-out set. If the heuristic already hits 35%+, the transformer must beat it by a margin that justifies shipping a new dependency. If the heuristic is at 20%, a transformer at 45% is a clear win.

### 6.3 Qualitative eval

- Per-user trajectory traces: does the model predict the next tool in "obvious" sequences (Read → Edit → Bash)? 
- Surprise analysis: top-5 cases the model gets right but the heuristic gets wrong.
- Error cases: what categories of user request does the model fail on?

### 6.4 A/B test in production

Once offline metrics pass, ship behind a flag:

- `kbot --router=model` vs default heuristic.
- Telemetry: measure agent-match rate (did the user immediately override the chosen agent?), session success proxy (did the session end with a non-error final tool?).
- 2-week A/B at 10% → 50% → 100% if positive.

---

## 7. Success Criteria

**Ship criteria (all must hold):**

1. Top-5 next-tool accuracy ≥40% on held-out sessions.
2. Beats heuristic `learned-router` baseline by ≥5 percentage points on the same eval set.
3. Inference p50 ≤50ms on M-series CPU (no GPU required).
4. Model + vocab ≤20MB packaged.
5. No personally identifiable information in the training data or serialized weights.

**Research success (lower bar):**

- Show the model learns non-trivial structure: perplexity <<$\log(8192)=13$ on held-out, ideally perplexity <20 (i.e. meaningful compression over uniform).
- Per-user adaptation: fine-tuning on one user's sessions visibly improves that user's predictions.
- Identify the tool-call feature that carries the most signal (tool name alone vs tool+args_bucket vs tool+outcome).

---

## 8. Failure Modes

### 8.1 Not enough data

Current: 23k events, 73 sessions, one power user. That's a toy dataset. Even with clean outcomes and intents, a 12M model might memorize it.

**Mitigation:** the PoC doesn't try to ship — it validates that tokenization is well-defined and that perplexity beats uniform. Production model waits for 30-day collection (§9).

### 8.2 Narrow task distribution

Isaac's sessions are heavily weighted toward Ableton + coding. A model trained on that corpus will overfit to that distribution. A user who does mostly research will get bad predictions.

**Mitigation:** per-user fine-tuning; fall back to heuristic router when predicted probability is below threshold (e.g. top-1 confidence <0.15 → skip to heuristic).

### 8.3 Tool vocabulary drift

New tools get registered monthly (kbot is up to 670). A model trained on last month's vocab won't know this month's new tools.

**Mitigation:** vocab reserves ~10% slots for `<unk_new_tool_0>` etc. Retrain monthly in CI. Treat as part of release process.

### 8.4 Distribution shift when the router itself changes

This is a reflexivity problem. If we ship the model and it changes which tools get called, we've now polluted the training distribution for the next iteration.

**Mitigation:** log both the predicted tool and the actually-chosen tool; train on actually-chosen. Add an exploration ε so we occasionally take the heuristic's choice and learn from it.

### 8.5 The heuristic is already good enough

Genuine possibility: `learned-router.ts` at 469 lines of hand-tuned logic may already be at 35%+ top-5. If so, a transformer adds complexity for marginal win.

**Mitigation:** measure baseline first (§6.2). If baseline is >35%, defer production until we have 10× more data.

### 8.6 Privacy

Tool args can contain secrets (bash commands, file paths with usernames). We solve this at tokenization time by bucketing args and never feeding raw strings to the model. But the training corpus itself still lives on disk.

**Mitigation:** training is opt-in, local-only by default. Cloud-sync is separate and explicitly off until privacy review. Never train on another user's sessions without explicit consent.

---

## 9. Ship Plan

### 9.1 Phase 0 — This proposal (week 0)

- Land `research/action-tokens/` directory.
- Instrument missing telemetry (see `data_collection.md`) — this is the critical path.

### 9.2 Phase 1 — Tokenization PoC (week 1)

- Run `tokenize.ts` over full `session.jsonl`.
- Produce `vocab.json` and inspect distribution.
- Sanity: top-20 tokens are the top-20 tools seen; vocab collapses long tail as designed.
- Measure bigram top-5 accuracy as the simplest baseline.

### 9.3 Phase 2 — Baseline measurement (week 2)

- Implement top-k eval harness against current `learned-router.ts`.
- Get the real baseline number. This dictates whether Phase 3 is worth starting.

### 9.4 Phase 3 — First model (weeks 3–4)

- Train 12M transformer on current corpus.
- Report top-k, perplexity, compare to baselines.
- Likely result: model does OK but not enough to ship. Prove it learns something.

### 9.5 Phase 4 — 30-day data push (weeks 5–8)

- Parallel to Phase 3: fix collection schema (intent, outcome, duration, user message).
- Opt-in beta for 10–50 users willing to share tool-call telemetry.

### 9.6 Phase 5 — Retrain + A/B (weeks 9–12)

- Retrain on richer corpus.
- Ship behind `--router=model` flag to opt-in users.
- A/B for 2 weeks, 10% → 50% → 100% if win.

### 9.7 Phase 6 — Default for opted-in users (week 13+)

- Default to model router for users who opted into telemetry.
- Heuristic stays as fallback and as the safety net for new users.

---

## 10. Open Questions

1. **Do we use `Agent` invocations as tokens or as boundary markers?** `Agent` (i.e. subagent spawn) is both a tool and a scope change. Candidate: emit `<agent:researcher>` tag when subagent starts, `<return>` when it ends, treat tools inside as nested.

2. **Is one tokenizer per user better than one global tokenizer?** Probably global with per-user fine-tune, because vocab is tool-level.

3. **Can the model emit tool arguments?** Not in v1. A separate head predicting arg_bucket might be added in v2.

4. **Should we mix synthetic data?** Tempting but dangerous. Claude Code transcripts, OpenCode traces, Aider logs all available. Risk: pollutes the user-specific signal. Decision: not in v1.

5. **Does the model need user-message embeddings as context, or is tool-history alone enough?** Empirical. We'd run both and compare; the hypothesis is that recent tool history dominates.

---

## 11. Why kbot Specifically

Three preconditions, all satisfied here:

1. **Session data is already being logged.** `~/.kbot/observer/session.jsonl` exists and is growing.
2. **The router is local and replaceable.** `learned-router.ts` is a single file, clear interface — swapping in a neural net is a plumbing exercise, not an architectural rewrite.
3. **The user trusts on-device inference.** kbot already runs Ollama locally. A 12M int8 model packaged inside the CLI is the same shape as what users already accept.

OpenAI can't do this in ChatGPT — they don't have per-user tool sequences. Cursor can't — their traces are code, not tools. Claude Code could but hasn't. This is a research direction where a tiny team with good session logging can credibly win.

---

## Appendix A — Corpus Stats (2026-04-19 snapshot)

```
total_events: 23,845
distinct_sessions: 73
distinct_tools_seen: 115
events_with_error: 4,787 (20.1%)
events_with_result_length: 20 (0.08%)
events_with_duration: 0 (0.0%)   <-- must fix
events_with_user_message: 0 (0.0%)   <-- must fix
events_with_outcome_class: 0 (0.0%)  <-- must fix
session_len_p50: 65
session_len_p90: 826
session_len_p99: 4,272
top_tools: Bash, Read, Edit, Grep, daemon_pulse, daemon_synthesis, WebSearch, Write, ableton_device, Agent
```

The three `<-- must fix` lines are what drives `data_collection.md`.

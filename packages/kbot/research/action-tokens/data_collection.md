# Data Collection — Honest Assessment

**Date:** 2026-04-19
**Subject:** What `~/.kbot/observer/` currently captures, what's missing, and what must start collecting NOW to have a training-ready corpus in 30 days.

---

## 1. What we have today

### Files

- `~/.kbot/observer/session.jsonl` — 4.6MB, 23,845 lines, one JSON object per tool call.
- `~/.kbot/observer/cursor.json` — pointer for incremental ingestion.
- `~/.kbot/observer/stats.json` — aggregated tool-frequency counters.

### Current schema (per line)

```json
{
  "ts": "2026-03-23T06:30:52.087Z",
  "tool": "Grep",
  "args": { "pattern": "...", "file_path": "..." },
  "session": "2cb43984-d06d-416e-b79e-fffb6088b0f4",
  "error": "<only sometimes>",
  "result_length": 42
}
```

### Observed stats

| Metric | Value |
|---|---|
| Total events | 23,845 |
| Distinct session ids | 73 |
| Distinct tool names | 115 |
| Events with `error` field | 4,787 (20.1%) |
| Events with `result_length` | 20 (0.08%) |
| Events with duration | 0 (0.0%) |
| Events with user_message | 0 (0.0%) |
| Events with intent label | 0 (0.0%) |
| Events with outcome class | 0 (0.0%) |
| Events with agent context | 0 (0.0%) |

Session length: p50=65, p90=826, p99=4,272, mean=326.

### Verdict on what we have

Tokenization works — we can mint a vocab and produce sequences. Bigram and trigram baselines will run. A 12M transformer will technically train but will be learning from strings like `Bash|b?|unk|d?` over and over — the outcome and duration slots collapse to `<unk>` because we never collected them.

**This is enough for Phase 1 (tokenization PoC) and Phase 2 (baseline measurement). It is NOT enough to hit the >40% top-5 ship criterion.**

---

## 2. What's missing

Ordered by training value (highest impact first).

### 2.1 Outcome class — CRITICAL

Right now an event is just "this tool was called." We have no structured signal for whether it worked. `error` is set only when a tool throws; it's silent on "the tool ran but returned nothing useful," which is >50% of real failures.

**Needed:** a normalized `outcome` field per event: `ok | error | partial | unknown`.

- `ok`: tool returned useful data (result_length > 0 for readers, exit 0 for executors).
- `error`: tool threw, or exit != 0, or returned explicit error object.
- `partial`: tool succeeded but hit a limit (timeout, truncation).
- `unknown`: couldn't classify.

Without this the model cannot learn the most important signal in agent sequences: "after a Bash that errored, the next tool is Read (to diagnose)."

### 2.2 Duration — CRITICAL

Duration is load-bearing for routing because slow tools often precede retries or fallbacks. Currently not captured at all.

**Needed:** `duration_ms` integer per event, measured from tool invocation to return.

### 2.3 User message / intent — HIGH

A tool-call sequence without the user's actual prompt is half the story. We want the model to learn `<user:code>` leads to `Read → Edit → Bash(test)` while `<user:research>` leads to `WebSearch → url_fetch → Write`.

**Needed one of:**

- **Minimum:** a coarse intent label attached to the session start. Ten classes: `code, debug, test, research, doc, music, ops, design, social, other`. Can be derived via a cheap local classifier (Ollama) over the first user message.
- **Preferred:** the full first user message (hashed or truncated) so we can embed it in the future.

Privacy: user messages can contain anything. Default should be the label only; the raw message is opt-in.

### 2.4 Agent context — HIGH

kbot routes to an agent (`coder`, `researcher`, `aesthete`, ...). The model needs to know which agent was active when the tool was called so it can condition on it.

**Needed:** `agent` field per event, populated from the current active agent.

### 2.5 Turn boundaries — MEDIUM

Within a session there are multiple user messages and multiple agent responses. Today everything is flat. The model benefits from a `<turn>` marker between user turns.

**Needed:** a synthetic event `{tool: "<turn>", ts: ...}` emitted at each user-message boundary, OR a `turn_id` field on every event.

### 2.6 User satisfaction signal — MEDIUM

The holy grail: did the session succeed from the user's POV? Proxies:

- User did not immediately retry with a rephrase.
- User did not override the agent choice mid-session.
- Session ended with a non-error tool.
- Explicit: `kbot feedback --good` / `--bad` at end of session.

**Needed:** session-level `outcome: success | abandoned | failed` in a `session-summary.jsonl` written at session end.

### 2.7 Result length / error details — LOW

`result_length` is already in the schema but populated for 0.08% of events. Error messages are strings that may contain PII.

**Needed:** populate `result_length` for all reader/executor tools. Error messages should be classified into coarse buckets (`timeout`, `not_found`, `permission`, `syntax`, `other`) rather than stored verbatim.

---

## 3. Proposed updated schema

```json
{
  "ts": "2026-04-19T12:00:00.000Z",
  "session": "uuid",
  "turn_id": 3,
  "agent": "coder",
  "intent": "code",
  "tool": "Bash",
  "args_bucket": "bTST",
  "outcome": "error",
  "error_class": "timeout",
  "duration_ms": 62000,
  "result_length": 0
}
```

And a parallel `session-summary.jsonl`:

```json
{
  "session": "uuid",
  "started": "2026-04-19T12:00:00.000Z",
  "ended": "2026-04-19T12:12:00.000Z",
  "first_message_class": "code",
  "agent_path": ["kernel", "coder"],
  "event_count": 42,
  "outcome": "success"
}
```

`args_bucket` is computed at log time using the bucketing rules in `tokenize.ts` — this way raw args never leave the tool-pipeline layer.

---

## 4. Where in the code to add this

- `packages/kbot/src/tool-pipeline.ts` — the middleware that wraps every tool call. Add outcome classification, duration timing, and args bucketing here. One hook covers all tools.
- `packages/kbot/src/agent.ts` — emit `<turn>` markers and agent context.
- `packages/kbot/src/cli.ts` — classify first user message into intent via local Ollama; write session-summary.jsonl on exit.

All of this is local. No cloud required. No API costs. Writing one additional line to `session.jsonl` per tool call adds microseconds.

---

## 5. The 30-day plan

- **Week 1** — Ship new observer schema behind `KBOT_OBSERVER_V2=1`. Isaac + 5 beta users opt in. Validate schema for a week.
- **Week 2** — Add Ollama-backed intent classification on first user message. Emit session-summary.jsonl. Spot-check 50 sessions.
- **Week 3** — `kbot observer enable/disable` command. Document privacy model. Recruit 25–50 volunteers in release notes.
- **Week 4** — Freeze training snapshot day 30. Expect 100k–500k events with outcome/duration/intent across 20+ users. Run Phase 3 training.

---

## 6. The one thing that must start NOW

If we only do one thing this week, it's **logging `duration_ms` and `outcome` on every tool call from `tool-pipeline.ts`.**

Reason: without those two fields, every day of session logging produces training data that we will have to throw away. Every other missing field (intent, agent, turn_id) can be backfilled from other sources or inferred later. Duration and outcome can only be measured at the moment the tool runs. Every day we wait is a day of permanent data loss.

Concretely: add a Date.now() before/after the tool execution and a try/catch classifier in `tool-pipeline.ts`, then append `duration_ms` and `outcome` to the JSONL line written by the observer. Ten lines of code. No UI changes. No user-visible difference.

Do this today. The rest of the 30-day plan is scheduled work. This one item is the item with irrecoverable opportunity cost.

---

## 7. Privacy posture (for docs / release notes)

- All observer data is local-only by default in `~/.kbot/observer/`.
- Tool arguments are bucketed (hashed/categorized) at log time; raw strings never hit disk in the observer stream.
- User messages are classified into 10 coarse labels; raw text is stored only if the user opts in explicitly.
- No cloud sync of observer data without explicit `kbot observer sync on`.
- Users can delete all observer data with `kbot observer reset`.
- Training a model on this data is opt-in and produces a local `.safetensors` file on the user's machine.

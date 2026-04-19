---
name: teacher-trace-curation
description: Use weekly. The teacher log captures every non-local Claude call — curate the best ones into training data so the local model learns from your actual work.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [training, fine-tuning, mlx, local-model, dataset]
    related_skills: [autopoiesis-loop, skill-self-authorship]
---

# Teacher Trace Curation

Every time kbot calls Claude, the prompt + response is written to `~/.kbot/teacher/traces.jsonl`. Left alone, this is just a log. Curated, it's the dataset that teaches the local model to answer *your* questions without touching the API.

## Iron Law

```
ONLY SUCCESSFUL, CORRECTED, AND USER-APPROVED TRACES ENTER THE DATASET.
```

Failed traces teach the model to fail. Garbage in is not "more data."

## The Weekly Ritual

1. `kbot train-self --mode default --max-examples 500 --iters 200 --num-layers 8` — curates + fine-tunes in one pass. The curator runs first, scores traces, and writes `~/.kbot/teacher/dataset-default.jsonl`.
2. Review the top 50 entries in the dataset file. Skim titles + first 200 chars.
3. Remove anything you wouldn't want the local model to imitate:
   - Responses you corrected mid-session.
   - Hallucinated library names or APIs.
   - Advice you later decided was wrong.
4. Re-run step 1 with the cleaned dataset if you made significant deletions.
5. Test: `ollama run kernel-self:<timestamp>` on a task from the last week. Compare against the Claude baseline.

For longer cycles of evaluation + retraining, use `kbot train-cycle` which chains curate → train → evaluate → merge across multiple iterations.

## The Quality Signal That Matters Most

Was this answer *used* without correction? The curator scores partly on: no correction in the next 5 turns, no follow-up question asking for clarification, no user rephrasing. Approved-by-silence is the strongest endorsement.

## What You're Actually Building

A local model that answers "how do I deploy this?" using *your* deploy flow, not Anthropic's generic best practice. Your infrastructure, your naming, your conventions, your past decisions. That's what the local model becomes over weeks.

## Anti-Pattern

Training on everything. Larger datasets with noisy data fine-tune *worse* models than small curated datasets. 200 excellent examples beat 2,000 mediocre ones every time.

## Integration

- `KBOT_TEACHER_LOG=1` in `~/.zshrc` keeps the logger always-on.
- `launchd` plist at `~/Library/LaunchAgents/com.kernel.kbot-train-self.plist` runs the curation + training weekly.
- The trained model gets tagged `kernel-self:<timestamp>` in Ollama and becomes available to every kbot command via `--model kernel-self:latest`.

# Archive — Transformer-Era Action-Token Artifacts

These files are the original transformer-based action-token research artifacts,
superseded by the embedding nearest-neighbor pivot on **2026-04-19**.

## Why archived

The transformer proposal (see `PROPOSAL.transformer.md`) set a 40% top-5 ship bar
for a learned router trained on action-token sequences. Before committing to that
direction, we measured the existing heuristic `learned-router.ts` as a baseline —
see `../BASELINE.md` — and found it already at **91.8% top-5 accuracy** on the
evaluation slice.

That killed the transformer bet. A 10–50M-parameter model trained on ~23k
events is not going to beat a well-tuned heuristic at 91.8%, and the ship bar
was naive to set before the baseline was in hand. The right next step is a
low-risk embedding nearest-neighbor approach with user-specific fine-tuning,
which is the direction captured in the new `../PROPOSAL.md`.

## Contents

| File | Original location | What it was |
|---|---|---|
| `PROPOSAL.transformer.md` | `../PROPOSAL.md` | Research proposal: small transformer trained on action tokens, Qwen2.5-Coder-7B + MLX, 10–50M param head |
| `tokenize.transformer.ts` | `../tokenize.ts` | Tokenizer skeleton — `(tool_name, args_bucket, outcome_class, duration_bucket)` → vocab id |
| `train.transformer.py` | `../train.py` | MLX training loop skeleton for the action-token LM |

## What replaces them

- `../PROPOSAL.md` — current proposal (embedding-NN + user-specific fine-tuning)
- `../BASELINE.md` — the 91.8% top-5 measurement that invalidated the transformer bar
- `../embedding-nn/` — the new prototype (owned by the build-prototype agent)

Kept for history and to document the decision trail. Do not use these files as
the starting point for new work — use `../PROPOSAL.md` instead.

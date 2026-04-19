# Action-Token Research

Research track: replace the heuristic `learned-router.ts` with a learned
next-action predictor, trained on real kbot session tool-call sequences.

**Current direction (2026-04-19):** embedding nearest-neighbor with
user-specific fine-tuning. Pivoted from an earlier transformer-from-scratch
proposal after the baseline measurement (see below).

## Index

| File / dir | What |
|---|---|
| [`PROPOSAL.md`](./PROPOSAL.md) | Current research proposal (embedding-NN + per-user fine-tuning) |
| [`BASELINE.md`](./BASELINE.md) | Baseline measurement of the existing heuristic router — **91.8% top-5** |
| [`BASELINE.template.md`](./BASELINE.template.md) | Template used to produce BASELINE.md |
| [`baseline-measure.ts`](./baseline-measure.ts) | Script that measures the heuristic router against session replay |
| [`data_collection.md`](./data_collection.md) | How to harvest training pairs from `~/.kbot/observer/session.jsonl` (still needed for per-user fine-tune corpus) |
| [`embedding-nn/`](./embedding-nn/) | Prototype: embedding nearest-neighbor router (owned by build-prototype agent) |
| [`_archive/`](./_archive/) | Historical transformer-era artifacts, superseded by the pivot. See `_archive/README.md` for the transition notes. |

## The pivot in one paragraph

The original proposal planned a small transformer (10–50M params) over an
action-token vocabulary, targeting a 40% top-5 ship bar. That target was set
before we measured anything. Once `BASELINE.md` landed, the heuristic router
was already at 91.8% top-5 — well above the proposed ship bar. Pivoted to
embedding-NN + user-specific fine-tuning, which keeps the personalization story
without betting a month of training on an approach the baseline had already
beaten. See `_archive/` for the original artifacts.

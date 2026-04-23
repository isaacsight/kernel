# READ FIRST — Pivot Note

## Ambiguity to resolve

Your messages mentioned **both**:

1. "showcase to Suno as a full stack engineer" — suggests **Suno** (AI music
   generation, Cambridge MA).
2. "pro create interview" and "pro create engineering... science and physics"
   — suggests **Procreate** (Savage Interactive, Hobart Tasmania).

I didn't clarify before starting, so I built the scaffold **dual-track**:

- **Track A (Suno)**: the Setlist music-studio demo. Lives in
  [`README.md`](./README.md), [`docs/`](./docs/), [`specs/`](./specs/),
  [`interview/`](./interview/).
- **Track B (Procreate)**: a drawing-studio demo (planned). A research
  doc is being built in
  [`interview/PROCREATE_RESEARCH.md`](./interview/PROCREATE_RESEARCH.md)
  by a research agent as I write this.

## When you get home — choose one

### If it's Suno

- Delete / ignore `interview/PROCREATE_RESEARCH.md`.
- The Setlist docs are production-ready scaffold. Start on
  [`specs/ROADMAP.md`](./specs/ROADMAP.md) Phase 1.

### If it's Procreate

- Keep [`interview/PROCREATE_RESEARCH.md`](./interview/PROCREATE_RESEARCH.md)
  as interview prep.
- Pivot the demo to a browser drawing studio — see
  [`docs/PROCREATE_ANGLE.md`](./docs/PROCREATE_ANGLE.md) (below) for the
  concept. Most of the stack docs (`TECH_STACK.md`, `STACK_RD_2027.md`,
  `SECURITY.md`, `TESTING.md`, `DEPLOYMENT.md`) apply unchanged — just
  the domain objects swap from tracks/playlists to
  canvases/brushes/layers.

### If it's both (two interviews, different companies)

- Lucky you. Run them as parallel scaffolds — the shared infrastructure
  (auth, storage, realtime) is identical.

## What's stack-agnostic vs company-specific

| File | Suno-specific | Procreate-specific | Either |
|---|---|---|---|
| `README.md` | ✅ | — | — |
| `docs/ARCHITECTURE.md` | ✅ audio-flavored | — | core shape reusable |
| `docs/TECH_STACK.md` | — | — | ✅ |
| `docs/STACK_RD_2027.md` | — | — | ✅ |
| `docs/DATA_MODEL.md` | ✅ tracks/playlists | — | shape reusable |
| `docs/API.md` | partial | — | shape reusable |
| `docs/SECURITY.md` | — | — | ✅ |
| `docs/TESTING.md` | — | — | ✅ |
| `docs/DEPLOYMENT.md` | — | — | ✅ |
| `docs/PERFORMANCE.md` | — | — | ✅ |
| `docs/GETTING_STARTED.md` | — | — | ✅ |
| `docs/OBSERVABILITY.md` | — | — | ✅ |
| `docs/ACCESSIBILITY.md` | — | — | ✅ |
| `docs/PROCREATE_ANGLE.md` | — | ✅ | — |
| `specs/FEATURES.md` | ✅ | — | — |
| `specs/ROADMAP.md` | slight | — | shape reusable |
| `interview/STACK_QA.md` | — | — | ✅ (stack-neutral) |
| `interview/PROCREATE_RESEARCH.md` | — | ✅ | — |
| `interview/DEMO_SCRIPT.md` | ✅ | — | template reusable |
| `interview/QUESTIONS_FOR_SUNO.md` | ✅ | — | template reusable |

Roughly **60%** is stack-agnostic and useful to either interview.

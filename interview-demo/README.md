# Setlist — Suno Full-Stack Interview Demo

> An AI music mini-studio. Prompt → track → playlist → share link. Built to
> showcase full-stack depth in the problem space Suno cares about: generative
> audio, realtime streaming, and a user-facing product that makes music feel
> personal.

## Elevator pitch

**Setlist** lets anyone type a prompt ("lo-fi 90s Atlanta soul, 82 BPM, minor
key, with a Rhodes lead") and stream back a generated track with live waveform
feedback, then save it to a collaborative playlist they can share with a link.
Think: *if Suno and Spotify had a baby and raised it on WebSockets.*

## Why this demo

Picked deliberately to hit every pillar Suno interviews likely probe:

1. **Generative audio UX** — streaming generation, cancel mid-gen, waveform
   scrubbing, stem toggles.
2. **Realtime infra** — WebSocket progress updates, pub/sub over a Postgres
   `LISTEN/NOTIFY` channel, optimistic UI.
3. **Data modeling** — users, tracks, playlists, generations, shares — with
   row-level security and public-link token flows.
4. **Polish** — empty states, error boundaries, loading skeletons,
   keyboard shortcuts, mobile-responsive.
5. **Pragmatism** — one polished feature > three half-finished ones.

## Stack (one-liner)

React 19 + Vite + TypeScript on the client, Hono on Cloudflare Workers for the
edge API, Supabase (Postgres + Auth + Storage), WebSockets for generation
progress, WaveSurfer.js for waveform rendering, shadcn/ui + Tailwind for UI,
Vitest + Playwright for tests, Vercel for the web deploy.

Full rationale in [`docs/TECH_STACK.md`](./docs/TECH_STACK.md).

## Repo layout (planned)

```
interview-demo/
├── README.md                       ← you are here
├── docs/
│   ├── ARCHITECTURE.md             ← system diagram + request lifecycle
│   ├── TECH_STACK.md               ← every choice + rationale
│   ├── DATA_MODEL.md               ← Postgres schema + RLS
│   ├── API.md                      ← REST + WS contracts
│   ├── STREAMING.md                ← realtime generation pipeline
│   ├── AUDIO_PIPELINE.md           ← generation, storage, playback
│   ├── UI_UX.md                    ← screens, components, motion
│   ├── DEPLOYMENT.md               ← CI/CD + infra
│   ├── SECURITY.md                 ← auth, rate limits, moderation
│   ├── TESTING.md                  ← unit/integration/e2e strategy
│   ├── PERFORMANCE.md              ← budgets + optimization
│   ├── OBSERVABILITY.md            ← logs, metrics, traces
│   ├── ACCESSIBILITY.md            ← a11y checklist
│   ├── GETTING_STARTED.md          ← local dev setup
│   ├── TRADEOFFS.md                ← decisions + why
│   └── GLOSSARY.md                 ← terms
├── specs/
│   ├── FEATURES.md                 ← P0/P1/P2 feature spec
│   ├── ROADMAP.md                  ← phased build plan
│   ├── USER_STORIES.md             ← who uses this and why
│   └── NON_GOALS.md                ← explicit scope cuts
└── interview/
    ├── TALKING_POINTS.md           ← key points to hit
    ├── DEMO_SCRIPT.md              ← 5-min walkthrough narrative
    ├── QUESTIONS_FOR_SUNO.md       ← reverse-interview questions
    ├── ANTICIPATED_QUESTIONS.md    ← interview Q&A prep
    └── ELEVATOR_PITCHES.md         ← 30s / 2min / 5min versions
```

## Read order

If you only have 10 minutes: read
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md),
[`specs/FEATURES.md`](./specs/FEATURES.md),
[`interview/DEMO_SCRIPT.md`](./interview/DEMO_SCRIPT.md).

If you're building it: read
[`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md),
[`docs/TECH_STACK.md`](./docs/TECH_STACK.md),
[`specs/ROADMAP.md`](./specs/ROADMAP.md).

If you're prepping for the interview: read everything in
[`interview/`](./interview/).

## Status

Scaffolding only — docs first, code follows. Target: working MVP in
[`specs/ROADMAP.md`](./specs/ROADMAP.md) Phase 1.

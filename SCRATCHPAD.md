# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-15)

### Accomplished This Session

#### K:BOT v2.16.0 — VFX & Creative Production Tools
- **8 new Houdini-inspired tools**: vex_generate, shader_generate, ffmpeg_process, imagemagick, blender_run, texture_generate, color_palette, audio_visualize
- **VEX code generation**: 8 procedural effect templates (noise, curl_noise, scatter, wave, fractal, vortex, erosion, growth)
- **GLSL shaders**: 7 fragment shaders (water, fire, plasma, raymarching, bloom, film_grain, dissolve)
- **FFmpeg**: 11 video operations (encode, extract_frames, gif, timelapse, stabilize, grayscale, reverse, speed, trim, audio_extract, thumbnail)
- **ImageMagick**: 13 image operations with v7/v6 fallback
- **Blender**: Background-mode Python script execution for 3D generation
- **Procedural textures**: Pure Python texture generator (perlin, marble, wood, brick, hexagon, voronoi, checkerboard)
- **Color palettes**: HSL color harmony (complementary, analogous, triadic, split_complementary, tetradic, monochromatic)
- **Audio visualization**: FFmpeg showcqt, waveform, spectrum, vectorscope video generation
- **62 → 72 npm keywords**: added vfx, shader, glsl, houdini, ffmpeg, imagemagick, blender, procedural, creative-coding, audio-visualization
- **Published**: v2.16.0 to npm, Docker `isaacsight/kbot:2.16.0` pushed
- **README**: updated What's New section for v2.16.0

#### Previous Session (2026-03-14) — Billing Hardening & npm Categories
- 28 research + container tools (v2.15.0–2.15.2)
- 62 npm keywords covering all homepage categories
- Obsidian vault synced

#### Billing Hardening — Overage Removed Entirely
- **Overage bypass vulnerability fixed** — removed `skipAtomicDaily`, `webOverageEnabled`, `webSpendingCeilingHit` from claude-proxy
- **All users hard-capped** — Free at 10/month, Pro at 200/month, no exceptions
- **Atomic enforcement** — ALL users go through `check_and_increment_message` RPC (race-condition safe)
- **Migration 084** — disabled `overage_enabled` on all existing DB subscriptions
- **Frontend cleanup** — removed OveragePrompt component, localStorage bypass (`kernel_overage_accepted`), dead overage rendering in EnginePage
- **Stripe webhook fixes** — `cancel_at_period_end` no longer immediately downgrades, `invoice.payment_failed` handler added, `invoice.paid` renewal handler
- **Settings panel** — dynamic plan display with upgrade/manage buttons
- **Full billing audit** — backend, config, webhook, frontend all PASS
- **Claude-proxy deployed** — clean enforcement live in production
- **Obsidian vault updated** — Status and Billing docs brought current

#### Commits This Session
- `c056054f` — fix: remove overage billing, hard-cap Pro at 200 messages/month
- `5309984d` — fix: handle payment failures and cancel-at-period-end correctly
- `9dc8136b` — feat: dynamic subscription panel and overage indicator in chat UI
- `e2daca62` — feat: real-time overage reporting to Stripe from claude-proxy
- `ddadd459` — feat: add metered overage line item to checkout and billing meter setup

### Previous Session (2026-03-13)

#### K:BOT v2.13.1 Published
- **6 new feature modules**: test runner, watch mode, voice mode, export, plugin marketplace, rate limiter
- **Streaming hardening**: retry with exponential backoff (1s/2s/4s) for 429/5xx errors
- **Smarter context management**: priority scoring preserves high-value turns during compaction
- **80 tests across 6 files** (vitest)
- **Rebrand**: "Antigravity Group" → "kernel.chat group" across entire codebase
- **Rename**: `kbot ollama` → `kbot local` (with backwards-compatible alias)
- **Published**: v2.13.1 to npm, pushed to GitHub
- **5 core modules**: repo map, provider fallback, self-eval, memory tools, task ledger
- **37 specialist agents**, i18n for 24 languages

### Pending
- **Launch posts** — drafts ready in `tools/launch-drafts.md`, update to reflect `kbot local` naming
- **iOS Capacitor sync** — need CocoaPods then `npx cap sync ios`
- **Frontend cleanup** — remove dead overage CSS from index.css, update Terms & Privacy pages
- **awesome-openclaw-skills PR** — blocked until skill gains traction on ClawHub

## Key Decisions
- **Repo identity**: K:BOT is the primary product. kernel.chat web app is the "companion."
- **Billing**: 2-tier only. Free (10/month), Pro ($15/month, 200/month). NO overage. Hard cap.
- **Profit margin**: ~$11/Pro user/month (~73%). Most users won't hit 200, so real-world ~80%+.
- **8th-grade copy**: All user-facing text written simply, no jargon.
- **Zero Tailwind**: All vanilla CSS with `ka-` prefix.
- **Edge function deploys**: ALWAYS use `--no-verify-jwt` flag.

## K:BOT Current State
- **npm version**: 2.16.0 (`@kernel.chat/kbot`)
- **Specialists**: 39 agents
- **Tools**: 216
- **Providers**: 19
- **Keywords**: 72 (npm discoverability)
- **Downloads**: ~1,594/month, 855/week (accelerating)
- **Docker**: `isaacsight/kbot:2.16.0` on Docker Hub
- **Reality core**: error correction, entropy context, emergent swarms, Gödel limits, simulation — all always-on
- **Research tools**: arXiv, Semantic Scholar, Papers With Code, HuggingFace, PyPI, CRAN, Cargo, NASA, DOI
- **Container tools**: Docker build/run/ps/logs/compose, API testing, data queries, math, LaTeX, Terraform
- **VFX tools**: Houdini VEX, GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures, color palettes, audio viz

## Test Accounts
- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`

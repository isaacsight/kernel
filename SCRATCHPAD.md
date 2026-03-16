# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-15)

### Accomplished This Session

#### K:BOT v2.17.3 — Smart CLI Onboarding & Bug Fixes
- **Smart onboarding**: `detectProjectSuggestions()` auto-detects project type (Node/Rust/Python/Go/Docker) and shows contextual example prompts on first run
- **Extended tips**: Sessions 2-5 rotate tips about BYOK, specialists, sessions, learning, and embedded mode
- **BYOK visibility**: Shows `kbot auth` hint when user has BYOK configured but no local model
- **Dynamic version**: Replaced hardcoded VERSION with `createRequire` reading package.json at runtime
- **Model selection fix**: `isModelAvailable()` now requires exact tag match (was prefix-matching, caused gemma3:27b→gemma3:12b bug)
- **install.sh tracked**: Added `.gitignore` exception for `packages/kbot/install.sh`
- **Security audit**: Full platform scan — PASS (0 P0, 0 P1, 2 P2)
- **Usage analysis**: Deep dive into 8 active users — identified CLI onboarding friction (58% "what can you do" queries)
- **Published**: v2.17.3 to npm, Docker `isaacsight/kbot:2.17.3` pushed, GitHub up to date

#### K:BOT v2.18.0 — Share Feature + R&D
- **`kbot share`** — new command + `/share` slash command. Creates branded GitHub Gists from conversations
- **Gist branding** — every shared conversation links back to `@kernel.chat/kbot` npm + GitHub repo
- **Fallback chain** — GitHub Gist (if `gh` CLI available) → clipboard copy → stdout
- **Help updated** — `/share` added to printHelp menu
- **R&D analysis** — identified top 5 expansion categories by download impact:
  1. Document & Data Tools (CSV/Excel/PDF) — +800-1,500/week
  2. Deploy Tools (Vercel/Netlify/CF) — +500-1,000/week
  3. Database Tools (Prisma/SQL) — +500-800/week
  4. SEO & Content Tools — +300-500/week
  5. Email & Communication Tools — +400-600/week
- **Published**: v2.18.0 to npm, Docker pushed, GitHub pushed

#### K:BOT v2.19.0 — Open Source Expansion (Audit, Docs, Contribute)
- **`kbot audit <repo>`** — full 6-category scored audit of any GitHub repo (security, docs, quality, community, devops, health) with grade A-F
- **`kbot audit --share`** — auto-creates branded Gist of audit report
- **Document tools**: csv_read, csv_query, csv_write, data_transform, generate_report, generate_invoice
- **Contribute tools**: find_issues, prepare_contribution, submit_contribution, find_quick_wins
- **`kbot contribute`** — search for good-first-issue across all of GitHub
- **`kbot contribute <repo>`** — scan repo for quick-win opportunities
- **85 npm keywords** — added csv, spreadsheet, document, audit, contribute, open-source, etc.
- **228 tools** (was 216)
- **Published**: v2.19.0 to npm, Docker building, GitHub pushed

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

#### Open Source Governance & SEO Expansion
- **CODE_OF_CONDUCT.md** — Contributor Covenant v2.1, conduct@kernel.chat reporting
- **SECURITY.md** — Vulnerability disclosure policy, scope definition, hall of fame
- **GOVERNANCE.md** — Roles (Creator/Maintainer/Contributor/Community), decision-making process, release process
- **CONTRIBUTING.md** — Expanded with 228 tools, quick start guide, tool/specialist creation guides, conventional commits
- **ROADMAP.md** — v2.19.0 current, v2.20.0 next (community/CLI/integrations), v3.0 future (mobile/platform/intelligence)
- **CITATION.cff** — Academic citation metadata for Zenodo/DOI discoverability
- **GitHub Issue Templates** — bug_report.md, feature_request.md, config.yml with Discord/docs links
- **PR Template** — Checklist with build/test/typecheck gates
- **20 GitHub topics** — ai-agent, cli, terminal, llm, mcp, local-ai, self-evolving-ai, etc. (at GitHub's 20-topic max)
- **GitHub Discussions enabled** — community Q&A unlocked

#### Discord Community — "K:BOT Community" Server
- **Server scaffolded** — Guild ID: 1472796320015192178
- **6 categories**: Announcements, Community, Development, AI & Models, Resources, Meta
- **20 channels created**: announcements, releases, roadmap, general, introductions, showcase, help, contributors, feature-requests, bug-reports, github-feed, providers, local-models, agents, tools, tutorials, tips-and-tricks, links, bot-commands, feedback
- **6 roles**: Creator (Gold), Maintainer (Purple), Contributor (Green), Pro User (Blue), Community (Gray), Bot (Blurple)
- **GitHub webhook live** — pushes, PRs, issues, releases, stars → #github-feed
- **npm releases webhook** — #releases channel ready for publish notifications
- **Welcome messages posted** — #general (welcome embed), #announcements (v2.19.0 release), #help (getting started guide), #showcase (intro)
- **Server description set**
- **Discord agent** — `.claude/agents/discord.md` with full management protocol
- **Setup script** — `tools/discord-setup.ts` for automated channel/role/webhook creation
- **Discord notification workflow** — `.github/workflows/discord-notify.yml` (release/issue/PR → Discord)
- **Invite**: https://discord.gg/pYJn3hBqnz

#### Commits This Session
- `f071942b` — feat: governance files, Discord infrastructure, and GitHub templates
- `294b979c` — feat: audit, document, and contribute tools — open source expansion (v2.19.0)
- `0e9ef92c` — feat: kbot share — share conversations as GitHub Gists (v2.18.0)
- `ee3f08a7` — feat: smart CLI onboarding with project auto-detection (v2.17.3)
- `8c354364` — fix: Ollama model selection matched wrong size variants
- `4a3d20c6` — fix: add kbot install.sh to repo
- `c5735791` — fix: update Dockerfile provider count to 20
- `8088515e` — fix: read version dynamically from package.json
- `d50fafbd` — feat: v2.17.0 — embedded llama.cpp inference engine
- `868b0bc5` — feat: v2.16.0 — 8 VFX & creative production tools
- Earlier billing commits (c056054f, 5309984d, 9dc8136b, e2daca62, ddadd459)

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
- **Discord invite link** — add to README, npm package, kernel.chat website, kbot CLI help
- **Discord bot launch** — run `npx tsx tools/discord-bot.ts` as persistent process
- **Label 20+ issues as good-first-issue** — populate for contributors
- **GitHub Release v2.19.0** — create formal release for Zenodo DOI
- **Record terminal demo** — VHS/asciinema GIF for README
- **Awesome list submissions** — awesome-cli-apps, awesome-ai-tools, awesome-node, etc.
- **MCP registry submissions** — modelcontextprotocol.io, mcp.so

## Key Decisions
- **Repo identity**: K:BOT is the primary product. kernel.chat web app is the "companion."
- **Billing**: 2-tier only. Free (10/month), Pro ($15/month, 200/month). NO overage. Hard cap.
- **Profit margin**: ~$11/Pro user/month (~73%). Most users won't hit 200, so real-world ~80%+.
- **8th-grade copy**: All user-facing text written simply, no jargon.
- **Zero Tailwind**: All vanilla CSS with `ka-` prefix.
- **Edge function deploys**: ALWAYS use `--no-verify-jwt` flag.

## K:BOT Current State
- **npm version**: 2.21.0 (`@kernel.chat/kbot`)
- **Agents**: 22 built-in (17 specialists + 5 presets)
- **Tools**: 223
- **Providers**: 20
- **Keywords**: 85 (npm discoverability)
- **Downloads**: ~1,594/month, 855/week (accelerating)
- **Docker**: `isaacsight/kbot:2.19.0` on Docker Hub
- **Discord**: Guild 1472796320015192178, 20 channels, 6 roles, webhooks live
- **Discord Invite**: https://discord.gg/pYJn3hBqnz
- **GitHub Topics**: 20 (at max)
- **Reality core**: error correction, entropy context, emergent swarms, Gödel limits, simulation — all always-on
- **Research tools**: arXiv, Semantic Scholar, Papers With Code, HuggingFace, PyPI, CRAN, Cargo, NASA, DOI
- **Container tools**: Docker build/run/ps/logs/compose, API testing, data queries, math, LaTeX, Terraform
- **VFX tools**: Houdini VEX, GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures, color palettes, audio viz

## Test Accounts
- See `.env` or password manager for test credentials (removed from tracked files)

# kbot Roadmap

> Last updated: March 18, 2026

This roadmap reflects the current direction of kbot. Priorities may shift based on community feedback.

## Current: v3.6.0 (March 2026)

### Core Architecture (v3.0)
- [x] Checkpointing — save and resume long-running agent sessions
- [x] Bayesian routing — smarter agent selection based on success rates
- [x] SDK — programmatic access to kbot's agent loop
- [x] Middleware pipeline — hook into the request/response cycle
- [x] Lazy loading — tools load on demand for faster startup
- [x] Structured streaming — typed events for SDK consumers

### Tools & Capabilities
- [x] 560+ tools — all free, all open source
- [x] 35 agents (26 specialists + 9 presets)
- [x] 20 AI providers (cloud + 4 local options)
- [x] Game dev tools (16): scaffold, config, shaders, meshes, physics, particles, levels, tilemaps, navmesh, audio, netcode, builds, tests, ECS — 8 engines supported
- [x] Deploy tools: Vercel, Netlify, Cloudflare, Fly.io, Railway
- [x] Database tools: Postgres, MySQL, SQLite, Prisma, ER diagrams, seed data
- [x] MCP marketplace: search, install, uninstall, list, update from official registry
- [x] Research tools: arXiv, Semantic Scholar, HuggingFace, PyPI, CRAN, Cargo, NASA
- [x] VFX tools: GLSL shaders, Houdini VEX, FFmpeg, ImageMagick, Blender, procedural textures
- [x] Document tools: CSV read/query/write, data transform, reports, invoices
- [x] `kbot audit` — 6-category scored repo audit with sharing
- [x] `kbot contribute` — find and submit open source contributions
- [x] `kbot share` — branded GitHub Gists
- [x] `kbot pair` — file watcher with auto-analysis
- [x] `kbot team` — multi-agent TCP collaboration
- [x] `kbot record` — terminal session recording (SVG, GIF, asciicast)
- [x] Plugin SDK — extend kbot with custom tools and hooks
- [x] Zero-config first run — embedded llama.cpp, no API key required (v3.2.0)
- [x] Social tools — kbot posts as itself on X, LinkedIn, Bluesky, Mastodon (v3.3.0)
- [x] 560+ tools — all free, all open source (v3.6.0)

### Community & Ecosystem
- [x] Discord server (20 channels, 6 roles, webhooks)
- [x] Discord bot with slash commands and AI conversation
- [x] Discord channel agents — automated content for 11 channels
- [x] GitHub Discussions enabled
- [x] Issue templates and PR templates
- [x] CODE_OF_CONDUCT, SECURITY, GOVERNANCE, CONTRIBUTING docs
- [x] GitHub Actions for Discord notifications
- [x] `install.sh` — one-line installer with Node.js auto-detection

### Security
- [x] Full security audit — 0 P0, 0 P1 remaining
- [x] 87 game dev tests, path traversal guards, code injection sanitization
- [x] AES-256-CBC encrypted API keys at rest
- [x] Destructive command blocking, tool execution timeouts

## Next: v3.4.0 (Q2 2026)

### Bootstrap & Self-Improvement
- [x] Bootstrap agent — recursive self-improvement loop measurement
- [ ] `kbot metrics` — track development velocity, tool growth, loop efficiency
- [ ] Self-testing — kbot validates its own tools on every build
- [ ] Learning engine v2 — faster pattern extraction, cross-session optimization

### CLI Improvements
- [ ] `kbot bench` — run benchmarks (SWE-bench, HumanEval, polyglot)
- [ ] `kbot oss <repo>` — open source presence tracker
- [ ] `kbot upgrade` — plan management from terminal
- [ ] Richer TUI mode — split panes, tool output, progress bars

### Integration
- [ ] GitHub App (install-and-forget distribution)
- [ ] VS Code extension marketplace
- [ ] JetBrains plugin marketplace
- [ ] Homebrew formula (`brew install kbot`)

### Community
- [ ] `good-first-issue` labels on 20+ issues
- [ ] awesome-kbot community tools list
- [ ] Plugin marketplace (community-contributed tools)
- [ ] Contributor spotlight program

## Future: v4.0 (2026)

### Mobile
- [ ] iOS app via Capacitor (PWA wrapper)
- [ ] Android app via Capacitor
- [ ] Biometric auth (Face ID / fingerprint)
- [ ] Deep linking (kernel.chat URLs → native app)

### Platform
- [ ] Team workspaces (shared memory, shared agents)
- [ ] Custom agent marketplace
- [ ] Webhook integrations (Slack, email, custom)
- [ ] Real-time collaboration (multiple users, one kbot)

### Intelligence
- [ ] Multi-modal reasoning (images, audio, video natively)
- [ ] Long-term project memory (weeks → months of context)
- [ ] Cross-project learning (patterns from one repo help another)
- [ ] Autonomous background agents (monitor, alert, fix without prompting)
- [ ] Bootstrap loop at escape velocity — kbot proposes and assists its own improvements

## How to Influence the Roadmap

1. **Vote on issues** — thumbs-up (👍) issues you care about
2. **Open a discussion** — propose features in GitHub Discussions
3. **Contribute** — PRs that align with the roadmap get priority review
4. **Join Discord** — https://discord.gg/kdMauM9abG

## Principles

- **Local-first**: Everything that can run locally, does
- **Zero lock-in**: BYOK, 20 providers, export everything
- **Developer experience**: Fast, simple, no boilerplate
- **Open source**: MIT licensed, community-driven
- **Compound growth**: Each version makes the next one faster to build

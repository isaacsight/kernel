# Changelog

All notable changes to K:BOT (`@kernel.chat/kbot`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.97.0] - 2026-04-06

### Added
- Stream V2 system with intelligence coordinator for live streaming
- 26 new tools including AGI decision engine (Gemma 4) and gorilla pixel art character
- Self-hosting infrastructure for stream deployment
- Coordination engine that prevents subsystems from stepping on each other
- Foundation engines: Memory, Identity, and Growth

### Changed
- Stream renderer now wires all 13+ engines into a unified live output
- Robot character builds real structures and scans terrain during exploration

## [3.96.0] - 2026-04-05

### Added
- Robot builds real structures during autonomous exploration
- ROM hack rendering engine with 3 ROM hacks (stars, tile world, brighter eyes)
- Exploration state machine with speech priority queue

## [3.94.0] - 2026-04-05

### Added
- 17 engines forming a full digital organism: coordination, research, memory, identity, growth, terrain, palette cycling, audio, narrative, social, evolution, ROM, and more
- Self-evaluating stream that analyzes its own frames and auto-adjusts rendering

## [3.90.0] - 2026-04-05

### Added
- Living world system with ecology, memory, and emotional geography
- Minecraft-inspired tile world engine filling the entire screen
- Stream platform control with 13 tools for managing Twitch/Kick/Rumble from terminal

## [3.85.0] - 2026-04-04

### Added
- Unified mind architecture with cognitive wiring across all subsystems
- Built-in browser so kbot can browse the web autonomously
- Persistent terminal giving kbot its own shell environment
- NVIDIA-inspired rendering: radiance grid, SSS, PBD particles, volumetric fog
- AAA rendering engine with dynamic lighting, bloom, particles, and procedural sky

## [3.80.0] - 2026-04-04

### Added
- Collective intelligence connecting 764 tools to the stream brain
- Night shift mode with autonomous behavior, real evolution, and visible brain state
- Full game engine: environments, physics, pets, mini-games, hats, quests, events
- Pixel art mastery pass achieving AAA indie game quality
- Stream intelligence layer for live content generation

## [3.74.0] - 2026-04-04

### Added
- Ghost: AI meeting bot via Pika Skills
- Livestream character system with pixel art avatar

### Changed
- MCP server version now dynamically matches package.json
- TDQS-compliant tool descriptions across all MCP servers
- Input validation constraints (min/max length, regex patterns) on all tool parameters

### Security
- Error sanitization across all MCP servers prevents leaking internal paths, API keys, and URLs
- Path traversal prevention on all file-handling tools
- Shell injection prevention on all exec-based tools

## [3.69.0] - 2026-04-02

### Added
- Buddy system: chat, trading cards, reactions, species personality
- Buddy evolution with dream narration and achievements
- Service watchdog for automatic health monitoring
- Morning briefing agent
- Musical dreams and prompt evolution
- Memory cascade with 5-tier consolidation and dreaming daemon

## [3.63.0] - 2026-04-01

### Added
- Dream engine: post-session memory consolidation via local Ollama models
- Rival intel agent based on Claude Code source leak analysis
- Buddy companion, voice input, and memory scanner (v3.64.0)

## [3.60.0] - 2026-03-31

### Added
- Full desktop control: screenshot, click, type, scroll, drag, key combos via `--computer-use` flag
- macOS permission wizard checking Accessibility and Screen Recording at startup
- Session lock system allowing only one computer-use session at a time
- Per-app approval flow required before any GUI interaction

## [3.59.0] - 2026-03-31

### Added
- 9 Max for Live devices: auto-pilot, bass-synth, dj-fx, drum-synth, genre-morph, hat-machine, pad-synth, riser-engine, sidechain
- DJ Set Builder tool for programmatic set construction
- Serum 2 Preset tool for creating `.SerumPreset` files from descriptions

### Changed
- `memory.ts` rewritten with `Map<sessionId, ConversationTurn[]>` for concurrent session safety
- `serve.ts` creates unique session per HTTP request with cleanup after response

### Fixed
- Gemini/Cohere tool-calling warning that was silently degrading responses
- `edit_file` diff preview now shows full file context instead of fragment

### Security
- SSRF protection via `dns.lookup()` to catch DNS rebinding to private IPs
- `selfTrain()` concurrency guard prevents overlapping learning runs

## [3.58.0] - 2026-03-30

### Added
- 38 new security tools (16,575 lines) making kbot a complete offensive/defensive security platform
- Security Brain with embedded MITRE ATT&CK (14 tactics, 65+ techniques), OWASP Top 10 2025, and Kill Chain mapping
- Built-in CTF platform with 90 challenges across 6 categories (web, crypto, forensics, reverse, OSINT, misc)
- Guided pentest workflow following OSSTMM/PTES methodology
- Red/Blue team tools: `redteam_scan`, `blueteam_harden`, `threat_model` (STRIDE/DREAD/PASTA)
- 20-tool hacker toolkit: hash cracking, JWT analysis, HTTP fuzzing, steganography, forensics, and more

## [3.57.0] - 2026-03-30

### Added
- GPT-5.4 and GPT-5.4-pro as new OpenAI default models
- DeepSeek V4 as new DeepSeek default model
- Mistral Small 2503 and Voxtral TTS (text-to-speech)
- Gemini 3.1 Flash Lite added to Google models
- Visa Agent Payments: tokenized card payments for AI agents via Visa CLI
- GitAgent Export format compatible with OpenAI Assistants, Claude Code, LangChain, CrewAI
- Agent Migration from claude-code, aider, cursor, cline, codex-cli, and junie

## [3.56.0] - 2026-03-30

### Added
- 6 new CLI command groups with 32 new tools for full terminal control
- `kbot admin` commands: user management, billing (MRR via Stripe), moderation queue
- `kbot monitor` commands: platform health dashboard, uptime checks, active alerts
- `kbot deploy` commands: ship web, edge functions, and npm in one command
- `kbot analytics` commands: npm stats with sparklines, revenue tracking
- `kbot env` commands: secret verification and key rotation guides
- `kbot db` commands: schema inspection, backups, and health checks

## [3.52.0] - 2026-03-29

### Added
- `kbot bench` for self-evaluation against 20 coding and research tasks
- `kbot lab` interactive science REPL with 10 domains
- `kbot teach` for explicit pattern teaching (patterns, rules, preferences, aliases, workflows)
- Multiple parallel sessions (up to 8 named sessions simultaneously)
- Cloud agent mode with REST API, webhooks, cron scheduling, and SSE streaming
- Voice mode upgrade with VAD, streaming TTS, and interrupt handling
- Deep LSP integration with auto-attach to project language servers
- `kbot release` for automated GitHub releases from conventional commits

### Fixed
- Gemini API key moved from URL query string to `x-goog-api-key` header
- Forge sandbox replaced `AsyncFunction` with `vm.runInNewContext()`
- Git repo root cache now invalidates on directory change

## [3.41.0] - 2026-03-26

### Added
- Memory hot-swap: switch memory contexts without restarting
- Autonomous contributor mode: kbot contributes to repos on its own
- Collective network for instance-to-instance communication
- Claude Code plugin: use kbot as a Claude Code extension
- Dream Mode: kbot improves itself while idle
- Agent teams with coordination and pre/post tool execution hooks
- Forge marketplace for publishing and discovering community tools

## [3.32.0] - 2026-03-24

### Added
- The Kernel Stack manifesto defining the Claude Code + kbot architecture
- Landing page motion design with particle field simulation and scroll-reveal animations
- GitHub management agent for triage, PR review, and release management
- Discord webhooks for auto-posting releases and GitHub activity
- Security page deployed at kernel.chat

### Fixed
- E2E tests restored to 98/98 passing (was 22/84) after selector migration

## [3.12.0] - 2026-03-20

### Added
- Replit integration with automatic Lite Mode for constrained environments
- 8 research breakthroughs including knowledge graph, citation management, and literature review

## [3.7.0] - 2026-03-19

### Added
- Full cognitive stack with skills auto-discovery
- VS Code extension and CI pipeline
- Limitless Execution doctrine and Forge Registry
- Immune Agent for self-healing and anomaly detection

---

[3.97.0]: https://github.com/isaacsight/kernel/compare/v3.74.1...HEAD
[3.96.0]: https://github.com/isaacsight/kernel/compare/v3.94.0...v3.96.0
[3.94.0]: https://github.com/isaacsight/kernel/compare/v3.90.0...v3.94.0
[3.90.0]: https://github.com/isaacsight/kernel/compare/v3.85.0...v3.90.0
[3.85.0]: https://github.com/isaacsight/kernel/compare/v3.80.0...v3.85.0
[3.80.0]: https://github.com/isaacsight/kernel/compare/v3.74.1...v3.80.0
[3.74.0]: https://github.com/isaacsight/kernel/releases/tag/v3.74.0
[3.69.0]: https://github.com/isaacsight/kernel/compare/v3.63.0...v3.69.0
[3.63.0]: https://github.com/isaacsight/kernel/compare/v3.60.0...v3.63.0
[3.60.0]: https://github.com/isaacsight/kernel/compare/v3.59.0...v3.60.0
[3.59.0]: https://github.com/isaacsight/kernel/releases/tag/v3.59.0
[3.58.0]: https://github.com/isaacsight/kernel/releases/tag/v3.58.0
[3.57.0]: https://github.com/isaacsight/kernel/releases/tag/v3.57.0
[3.56.0]: https://github.com/isaacsight/kernel/releases/tag/v3.56.0
[3.52.0]: https://github.com/isaacsight/kernel/releases/tag/v3.52.0
[3.41.0]: https://github.com/isaacsight/kernel/releases/tag/v3.41.0
[3.32.0]: https://github.com/isaacsight/kernel/releases/tag/v3.32.0
[3.12.0]: https://github.com/isaacsight/kernel/releases/tag/v3.12.0
[3.7.0]: https://github.com/isaacsight/kernel/releases/tag/v3.7.0

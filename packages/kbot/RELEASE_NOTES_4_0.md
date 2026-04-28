# kbot v4.0 — Evidence-Driven Curation

**Release date:** 2026-04-28
**Headline:** 670+ tools → ~100 specialist skills, every kept skill backed by telemetry, agent reference, or test coverage.

---

## tl;dr

kbot 4.0 is honest about what it's good at. The previous releases shipped 670+ registered tools — many of which had never been called by anyone. v4.0 ships the curated working surface plus a deprecation runway for the rest. Source files stay on disk; only the tool registry is trimmed. **Nothing breaks for users on autoupdate.**

The cuts were driven by data, not opinion. Five discovery agents analyzed:
- 90-day call telemetry from `~/.kbot/telemetry/`, daemon reports, and Claude Code session transcripts
- Test references across 49 test files
- Daemon dependency graph (kbot-daemon, discovery, social, dream)
- External public-API surface (SDK, MCP, ACP, `.claude/agents/*.md`, specialists' allowedTools)
- Forge-tool readiness for the 180 candidates the original plan proposed to migrate

Findings:
- 754 of 793 tools had **0 calls** in the last 90 days
- 738 of 794 tools had **0 test references**
- **0 daemons** depend on the tool registry (they hand-roll their own Ollama / gh / npm calls)
- The active surface is overwhelmingly `ableton_*` (62% of all kbot tool calls) plus a thin slice of file/search primitives

The decision tree (per tool):
- **KEEP** — protected (Ableton, music production), in keep-52, kbot-local-MCP namespace, MCP hard-contract handler, OR has active 90-day telemetry
- **DEPRECATE** — has test refs, agent references, or specialist allowedTools entry but 0 telemetry. Marked `@deprecated v4.0`, runtime warns once per process when invoked. Scheduled for removal in 4.1.
- **CUT-NOW** — zero everything (no calls, no tests, no daemons, no agent refs, no specialist refs, not in any keep list). File stays on disk; module is removed from `LAZY_MODULE_IMPORTS` so it never registers.

## Counts

| Decision | Tools | % |
|---|---|---|
| KEEP | 105 | 13.2% |
| DEPRECATE | 61 | 7.7% |
| CUT-NOW | 630 | 79.1% |
| **Total surveyed** | **796** | 100% |

## Architectural

- **`forge_tool` load-path bug fixed.** v3.99.31 and earlier persisted forged tools to `~/.kbot/plugins/forged/` but the loader only scanned the top level. Forged tools didn't survive restart. v4.0 scans `forged/` recursively. Existing forged tools auto-load on first launch after upgrade.
- **Plugin integrity** is now enforced in both `plugins.ts` (3.99.33) AND `plugin-sdk.ts` (4.0). Manifest at `~/.kbot/plugins.json`; fail-closed unless `KBOT_PLUGIN_INTEGRITY=off`.
- **Vocabulary refresh.** User-facing copy now uses "skills" where the OpenAI/Claude Code framing is more accurate. Internal identifiers (registry name `tools`, function `registerTool`, etc.) unchanged for back-compat.

## What's new beyond the cut

This release also includes the integrations from 3.99.32 through 3.99.35:
- **`image_thoughtful`** — OpenAI Images 2.0 with plan/refine reasoning loop
- **Channels family** — Slack (full), Office (full via Microsoft Graph), WhatsApp/Telegram/Signal/Matrix/Teams (stubs)
- **`local_image_thoughtful`** — local image gen via LLaDA2.0-Uni (no OpenAI key required)
- **Workspace Agents** — long-running named agents with scopes + permissions; optional Anthropic Managed Agents backend (`managed-agents-2026-04-01` beta header)
- **File Library** — content-addressed file store at `~/.kbot/files/`, name + content search, parity with ChatGPT's File Library
- **Parallel computer-use Coordinator** — multiple agents driving the Mac at once (per-app sub-locks)
- **Security Agent** — 17 static rules, `scan` / `scan-and-fix` / `report-only` modes, wired into guardian + hacker
- **`--architect` defaults to Claude Opus 4.7**
- **`kbot setup-claude-code` / `setup-cursor` / `setup-zed`** — one-command wiring of MCP server config + Claude Code skill that pre-authorizes the integration

## Migration

**For users on autoupdate**: nothing breaks. Cut tools are no longer registered, but if your workflow used one, you'll see a clear "tool not found" message. Deprecated tools still work but log a warning.

**Restoring a cut tool** (4.0 → 4.1 will permanently remove these — do this in 4.0 if you depend on one):
1. Find the tool's source file under `packages/kbot/src/tools/`
2. Copy its `registerTool` block into a new file at `~/.kbot/plugins/<name>.js`
3. The file will load on next kbot start (subject to plugin integrity manifest if you have one)

**Deprecation timeline**:
- v4.0.0 (2026-04-28): cuts complete, deprecation marks land
- v4.1.0 (~2026-05-15): remove `lab-*` deprecated bucket
- v4.2.0 (~2026-06-01): remove `stream-*` deprecated bucket
- v4.3.0 (~2026-06-15): remove `engine-*` deprecated bucket
- v4.4.0 (~2026-07-01): remove misc/wrapper deprecated bucket
- v4.5.0 (~2026-07-15): forge_tool migration completes for the 180 tools earmarked for runtime creation (after forge_tool gains secrets-bridge + runBinary capabilities)

Each removal is its own PR + commit + test cycle. Users on autoupdate see deprecation warnings throughout, no surprise breakage.

## Audit trail

Every cut decision is in `packages/kbot/CURATION_DISCOVERY/CURATION_DECISION.csv` with columns: tool name, decision, 30/90-day telemetry, test refs, external surface refs, reason. Anyone can ask "why was X cut?" and get a one-line answer from the data.

## Acknowledgements

This release was built and shipped in a single overnight session driven by 23 parallel specialist agents:
- 7 wave-1 agents (OpenClaw + ChatGPT/Codex parity)
- 6 wave-2 agents (wiring + Office + Anthropic Managed Agents)
- 3 wave-3 agents (Claude Code integration + safety-clear MCP)
- 1 LLaDA2.0-Uni provider agent
- 5 discovery agents (Phase A — telemetry, tests, daemons, surface, forge readiness)
- 3 Phase B execution agents (cut + deprecate, plugin-sdk integrity, vocab refresh)

A tip of the hat to Harrison McCormick — Pro user — whose iMessage on 4/27 ("Claude is refusing to help me use the agent it had me build, citing academic dishonesty") forced the Claude Code / kbot integration work in wave 3.

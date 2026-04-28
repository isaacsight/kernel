# kbot 4.0 Curation — Cut Report

**Generated**: 2026-04-25

## Summary

- Files removed from `LAZY_MODULE_IMPORTS`: **80**
- Files kept in `LAZY_MODULE_IMPORTS` (protected, MIXED, or all-keep/deprecate): **57** (137 before, 57 after)
- DEPRECATE tools marked with `deprecated: true`: **61**
- Protected files that would have been cut by telemetry but stayed (moat): **1**

## Tool count change (estimate)

- **Before**: ~770 tools registered across core + lazy modules
- **After**:  ~301 tools registered (mixed-bucket files keep their CUT tools registered until 4.1.0)
- **Difference**: ~469 tools no longer registered (ALL_CUT files)

## Files removed from LAZY_MODULE_IMPORTS

| Lazy import path | Source file |
|---|---|
| `../behaviour.js` | `src/behaviour.ts` |
| `../confidence.js` | `src/confidence.ts` |
| `../coordinator.js` | `src/coordinator.ts` |
| `../graph-memory.js` | `src/graph-memory.ts` |
| `../marketplace.js` | `src/marketplace.ts` |
| `../mcp-apps.js` | `src/mcp-apps.ts` |
| `../mcp-plugins.js` | `src/mcp-plugins.ts` |
| `../reasoning.js` | `src/reasoning.ts` |
| `../team.js` | `src/team.ts` |
| `../workflows.js` | `src/workflows.ts` |
| `./a2a.js` | `src/tools/a2a.ts` |
| `./admin.js` | `src/tools/admin.ts` |
| `./ai-analysis.js` | `src/tools/ai-analysis.ts` |
| `./behavior-tools.js` | `src/tools/behavior-tools.ts` |
| `./bootstrapper.js` | `src/tools/bootstrapper.ts` |
| `./buddy-tools.js` | `src/tools/buddy-tools.ts` |
| `./build-matrix.js` | `src/tools/build-matrix.ts` |
| `./collective-dream-tools.js` | `src/tools/collective-dream-tools.ts` |
| `./comfyui-plugin.js` | `src/tools/comfyui-plugin.ts` |
| `./composio.js` | `src/tools/composio.ts` |
| `./content-engine.js` | `src/tools/content-engine.ts` |
| `./contribute.js` | `src/tools/contribute.ts` |
| `./coordination-engine.js` | `src/tools/coordination-engine.ts` |
| `./ctf.js` | `src/tools/ctf.ts` |
| `./db-admin.js` | `src/tools/db-admin.ts` |
| `./deploy-all.js` | `src/tools/deploy-all.ts` |
| `./documents.js` | `src/tools/documents.ts` |
| `./e2b-sandbox.js` | `src/tools/e2b-sandbox.ts` |
| `./env-manager.js` | `src/tools/env-manager.ts` |
| `./evolution-engine.js` | `src/tools/evolution-engine.ts` |
| `./finance.js` | `src/tools/finance.ts` |
| `./financial-analysis.js` | `src/tools/financial-analysis.ts` |
| `./ghost.js` | `src/tools/ghost.ts` |
| `./iphone.js` | `src/tools/iphone.ts` |
| `./kbot-local.js` | `src/tools/kbot-local.ts` |
| `./lab-bio.js` | `src/tools/lab-bio.ts` |
| `./lab-chem.js` | `src/tools/lab-chem.ts` |
| `./lab-core.js` | `src/tools/lab-core.ts` |
| `./lab-data.js` | `src/tools/lab-data.ts` |
| `./lab-earth.js` | `src/tools/lab-earth.ts` |
| `./lab-frontier.js` | `src/tools/lab-frontier.ts` |
| `./lab-health.js` | `src/tools/lab-health.ts` |
| `./lab-humanities.js` | `src/tools/lab-humanities.ts` |
| `./lab-math.js` | `src/tools/lab-math.ts` |
| `./lab-neuro.js` | `src/tools/lab-neuro.ts` |
| `./lab-physics.js` | `src/tools/lab-physics.ts` |
| `./lab-social.js` | `src/tools/lab-social.ts` |
| `./lsp-tools.js` | `src/tools/lsp-tools.ts` |
| `./machine-tools.js` | `src/tools/machine-tools.ts` |
| `./memory-scanner-tools.js` | `src/tools/memory-scanner-tools.ts` |
| `./mobile-automation.js` | `src/tools/mobile-automation.ts` |
| `./monitor.js` | `src/tools/monitor.ts` |
| `./music-gen.js` | `src/tools/music-gen.ts` |
| `./narrative-engine.js` | `src/tools/narrative-engine.ts` |
| `./notebook.js` | `src/tools/notebook.ts` |
| `./pentest.js` | `src/tools/pentest.ts` |
| `./research-engine.js` | `src/tools/research-engine.ts` |
| `./research-notebook.js` | `src/tools/research-notebook.ts` |
| `./research-pipeline.js` | `src/tools/research-pipeline.ts` |
| `./research.js` | `src/tools/research.ts` |
| `./science-graph.js` | `src/tools/science-graph.ts` |
| `./sentiment.js` | `src/tools/sentiment.ts` |
| `./social-engine.js` | `src/tools/social-engine.ts` |
| `./stocks.js` | `src/tools/stocks.ts` |
| `./stream-character.js` | `src/tools/stream-character.ts` |
| `./stream-chat-ai.js` | `src/tools/stream-chat-ai.ts` |
| `./stream-commands.js` | `src/tools/stream-commands.ts` |
| `./stream-control.js` | `src/tools/stream-control.ts` |
| `./stream-overlay.js` | `src/tools/stream-overlay.ts` |
| `./stream-renderer.js` | `src/tools/stream-renderer.ts` |
| `./stream-self-eval.js` | `src/tools/stream-self-eval.ts` |
| `./stream-vod.js` | `src/tools/stream-vod.ts` |
| `./stream-weather.js` | `src/tools/stream-weather.ts` |
| `./streaming.js` | `src/tools/streaming.ts` |
| `./tile-world.js` | `src/tools/tile-world.ts` |
| `./training.js` | `src/tools/training.ts` |
| `./visa-payments.js` | `src/tools/visa-payments.ts` |
| `./voice-input-tools.js` | `src/tools/voice-input-tools.ts` |
| `./wallet.js` | `src/tools/wallet.ts` |
| `./watchdog.js` | `src/tools/watchdog.ts` |

## Protected files retained (excluded from cut despite ALL_CUT verdict)

- `./arrangement-engine.js` (src/tools/arrangement-engine.ts) — protected: Ableton/audio moat

## DEPRECATE tools marked

Each tool below has been flagged with `deprecated: true` in its `registerTool({...})` definition. When invoked, `executeTool` emits a chalk.yellow warn-once message and continues to execute the tool normally. Scheduled for removal in v4.1.0.

### `src/agent-protocol.ts` (5 tools)

- `agent_handoff`
- `agent_propose`
- `agent_trust`
- `blackboard_read`
- `blackboard_write`

### `src/tools/browser.ts` (1 tool)

- `browser_snapshot`

### `src/tools/computer.ts` (6 tools)

- `app_approve`
- `computer_check`
- `computer_release`
- `mouse_click`
- `window_move`
- `window_resize`

### `src/tools/containers.ts` (1 tool)

- `license_check`

### `src/tools/creative.ts` (5 tools)

- `evolve_design`
- `generate_art`
- `generate_music_pattern`
- `generate_shader`
- `generate_svg`

### `src/tools/deploy.ts` (1 tool)

- `deploy`

### `src/tools/emergent.ts` (1 tool)

- `question`

### `src/tools/gamedev.ts` (16 tools)

- `ecs_generate`
- `game_audio`
- `game_build`
- `game_config`
- `game_test`
- `level_generate`
- `material_graph`
- `mesh_generate`
- `navmesh_config`
- `netcode_scaffold`
- `particle_system`
- `physics_setup`
- `scaffold_game`
- `shader_debug`
- `sprite_pack`
- `tilemap_generate`

### `src/tools/hacker-toolkit.ts` (6 tools)

- `cors_check`
- `exploit_search`
- `forensics_analyze`
- `jwt_analyze`
- `security_headers_generate`
- `ssl_analyze`

### `src/tools/kbot-browser.ts` (1 tool)

- `kbot_read`

### `src/tools/quality.ts` (1 tool)

- `deps_audit`

### `src/tools/redblue.ts` (4 tools)

- `blueteam_checklist`
- `blueteam_harden`
- `redteam_report`
- `threat_model`

### `src/tools/security-brain.ts` (3 tools)

- `attack_lookup`
- `killchain_analyze`
- `security_brain`

### `src/tools/security-hunt.ts` (1 tool)

- `security_hunt`

### `src/tools/security.ts` (6 tools)

- `cve_lookup`
- `dep_audit`
- `headers_check`
- `owasp_check`
- `secret_scan`
- `ssl_check`

### `src/tools/test-runner.ts` (1 tool)

- `run_tests`

### `src/tools/threat-intel.ts` (2 tools)

- `incident_response`
- `threat_feed`

## Verification

- `npx tsc --noEmit` — clean (exit 0)
- `npx vitest run` — 965/965 tests passing

## CHANGELOG entry (draft)

> **kbot v4.0: tool curation pass** — Removed 80 dead-weight modules from the lazy-load registry, cutting ~469 tools that had zero recorded calls in the last 90 days across telemetry, claude-code transcripts, observer logs, and saved sessions. Marked 61 low-traffic tools `deprecated: true` (warn-once on invocation, scheduled for removal in 4.1.0). Protected the Ableton/audio production moat regardless of telemetry. Conservative cut — source files stay on disk; mixed-bucket files defer per-tool surgery to 4.1.0+.

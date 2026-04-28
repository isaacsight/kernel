# Tool Telemetry Summary — 4.0 Curation Discovery

**Generated**: 2026-04-25  
**Master tool count**: 793  
**Total CSV rows**: 795  
**Tools with >=1 call (90d)**: 41  
**Tools with 0 calls (90d)**: 754  
**Total invocations (90d)**: 1293  
**Total invocations (30d)**: 1153  

## Data-source coverage

| Source | Calls captured |
|---|---|
| claude-code | 1028 |
| telemetry | 177 |
| sessions | 49 |
| observer | 39 |

Notes:
- `~/.kbot/sessions/` directory is empty — no saved sessions on disk.
- `~/.kbot/checkpoints/*.json` provided some `toolSequenceLog` data (counted under `sessions`).
- `~/.kbot/observer/session.jsonl` logs Claude-Code-side tool names (Read/Edit/Bash/etc), not kbot tool names. Only kbot-name overlaps (e.g. `web_search`) were counted.
- `tools/daemon-reports/daemon.log` is unstructured text and `state.json` has no per-tool counters; no per-tool data extracted from this source.
- Claude-Code transcripts are by far the biggest signal: `mcp__kbot__*` and `mcp__kbot-local__*` tool_use blocks across 47 session files.
- `parallel_execute` calls were unrolled to count their inner tool invocations from telemetry.

## Top 20 most-called tools (30-day)

| # | Tool | 30d | 90d | Last called | Sources |
|---|---|---|---|---|---|
| 1 | `ableton_device` | 407 | 407 | 2026-04-08T06:09:45 | claude-code |
| 2 | `ableton_track` | 158 | 158 | 2026-04-08T05:58:00 | claude-code |
| 3 | `ableton_clip` | 143 | 143 | 2026-04-08T06:11:01 | claude-code |
| 4 | `ableton_midi` | 99 | 99 | 2026-04-08T06:00:16 | claude-code |
| 5 | `read_file` | 74 | 146 | 2026-04-23T05:17:31 | observer|sessions|telemetry |
| 6 | `ableton_transport` | 46 | 46 | 2026-04-06T02:46:48 | claude-code |
| 7 | `ableton_session_info` | 42 | 42 | 2026-04-06T02:46:17 | claude-code |
| 8 | `terminal_exec` | 39 | 39 | 2026-04-08T19:13:11 | claude-code |
| 9 | `ableton_create_track` | 36 | 36 | 2026-04-08T06:10:23 | claude-code |
| 10 | `web_search` | 29 | 33 | 2026-04-19T16:53:41 | observer|sessions|telemetry |
| 11 | `ableton_browse` | 13 | 13 | 2026-04-08T06:08:06 | claude-code |
| 12 | `kbot_chat` | 13 | 13 | 2026-04-24T22:56:03 | claude-code |
| 13 | `bash` | 7 | 20 | 2026-04-20T18:03:05 | observer|sessions|telemetry |
| 14 | `skill_manage` | 6 | 6 | 2026-04-24T05:11:22 | observer|sessions|telemetry |
| 15 | `ableton_knowledge` | 4 | 4 | 2026-04-06T00:51:54 | claude-code |
| 16 | `ableton_load_effect` | 4 | 4 | 2026-04-08T06:05:59 | claude-code |
| 17 | `ableton_load_plugin` | 4 | 4 | 2026-04-08T06:02:22 | claude-code |
| 18 | `ableton_effect_chain` | 3 | 3 | 2026-04-08T06:05:42 | claude-code |
| 19 | `git_log` | 3 | 3 | 2026-04-18T08:16:11 | observer|sessions|telemetry |
| 20 | `grep` | 3 | 3 | 2026-04-20T18:04:10 | observer|sessions|telemetry |

## Zero-call tools (long tail)

**754 of 793 master tools have zero recorded calls in the last 90 days.** This is consistent with the CURATION_PLAN's claim that ~400 tools are dead weight.

Notable zero-call categories (sampled):
- **lab-bio**: `gene_lookup`
- **lab-chem**: `reaction_lookup`
- **lab-physics**: `beam_analysis`
- **hacker**: `hash_crack`
- **ctf**: `ctf_hint`, `ctf_list`, `ctf_score`, `ctf_start`, `ctf_submit`
- **stream-overlay**: `overlay_alert`, `overlay_goal`, `overlay_highlight`, `overlay_ticker`
- **buddy**: `buddy_achievements`, `buddy_card`, `buddy_leaderboard`, `buddy_personality`, `buddy_rename`, `buddy_share`
- **dream**: `dream_journal`, `dream_now`, `dream_reinforce`, `dream_search`, `dream_status`
- **ghost**: `ghost_avatar`, `ghost_install`, `ghost_join`, `ghost_leave`, `ghost_skills`, `ghost_status`
- **mobile**: `mobile_app_list`, `mobile_back`, `mobile_connect`, `mobile_disconnect`, `mobile_elements`, `mobile_home`
- **phone**: `phone_airdrop`, `phone_call`, `phone_clipboard`, `phone_find`, `phone_focus`, `phone_message`
- **wallet**: `wallet_balance`, `wallet_history`, `wallet_list`, `wallet_send`, `wallet_setup`, `wallet_switch`
- **a2a**: `a2a_card`, `a2a_discover`, `a2a_list`, `a2a_remove`, `a2a_send`, `a2a_status`
- **composio**: `composio_connect`, `composio_execute`, `composio_list_apps`, `composio_search`
- **comfyui**: `comfyui_generate`, `comfyui_img2img`, `comfyui_list_models`, `comfyui_queue`, `comfyui_status`
- **notebook**: `notebook_cite`, `notebook_create`, `notebook_delete`, `notebook_edit`, `notebook_export`, `notebook_insert`
- **graph-memory**: `graph_add`, `graph_add_entity`, `graph_add_relation`, `graph_connect`, `graph_context`, `graph_cross_domain`
- **train**: `train_cost`, `train_deploy`, `train_evaluate`, `train_export`, `train_prepare`, `train_start`

## Surprises — tools CURATION_PLAN said CUT but show usage

These tools are flagged for deletion but have real call counts. Re-examine before tonight's cut:

| Tool | 30d | 90d | Last called | Sources |
|---|---|---|---|---|
| `skill_manage` | 6 | 6 | 2026-04-24T05:11:22 | observer|sessions|telemetry |
| `social_post` | 2 | 2 | 2026-04-03T00:39:26 | claude-code |
| `repo_audit` | 0 | 2 | 2026-03-19T06:38:30 | telemetry |
| `email_send` | 1 | 1 | 2026-04-06T19:22:56 | claude-code |
| `social_thread` | 1 | 1 | 2026-04-03T00:39:24 | claude-code |
| `analytics_npm` | 1 | 1 | 2026-04-08T19:14:19 | claude-code |

## Surprises — tools CURATION_PLAN said FORGE but show usage

_No FORGE-flagged tools have non-zero usage._

## Surprises — tools CURATION_PLAN said KEEP but never called

Sanity-check: KEEP tools with zero recorded calls. Either they're newly-introduced or used via aliases:

- `audio_mood`
- `background_run`
- `checkpoint_create`
- `checkpoint_revert`
- `create_agent`
- `dj_set_build`
- `docker_run`
- `forge_search`
- `forge_tool`
- `generate_music_pattern`
- `git_branch`
- `git_commit`
- `git_diff`
- `git_push`
- `git_status`
- `github_issues`
- `github_read_file`
- `github_repo_info`
- `github_search`
- `kbot_control`
- `kbot_local_ask`
- `lint_check`
- `mcp_call`
- `mcp_connect`
- `mcp_install`
- `mcp_list`
- `mcp_search`
- `memory_recall`
- `multi_file_write`
- `pattern_match`
- `produce_track`
- `regex_extract`
- `run_tests`
- `sandbox_run`
- `serum2_preset`
- `spawn_agent`
- `task_create`
- `type_check`
- `worktree_create`
- `worktree_list`
- `worktree_merge`
- `worktree_remove`
- `worktree_switch`

## Top 5 most-called

1. `ableton_device` — 407 calls (30d) / 407 (90d)
1. `ableton_track` — 158 calls (30d) / 158 (90d)
1. `ableton_clip` — 143 calls (30d) / 143 (90d)
1. `ableton_midi` — 99 calls (30d) / 99 (90d)
1. `read_file` — 74 calls (30d) / 146 (90d)

## 5 most-surprising 0-call tools

Tools the plan KEEPs or where the file name suggests heavy use, but no calls recorded:
- `regex_extract` (KEEP-flagged, 0 calls in 90d)
- `pattern_match` (KEEP-flagged, 0 calls in 90d)
- `task_create` (KEEP-flagged, 0 calls in 90d)
- `task_list` (KEEP-flagged, 0 calls in 90d)
- `task_update` (KEEP-flagged, 0 calls in 90d)

## Methodology notes

- **Master tool list** built from `grep -A2 'registerTool({' packages/kbot/src/tools/*.ts packages/kbot/src/*.ts` then extracting `name: '...'` literals. 793 unique names captured.
- **Telemetry**: `tool_call_start` events from `~/.kbot/telemetry/*.ndjson` (22 daily files). `parallel_execute` payloads were unrolled to count fan-out children.
- **Checkpoints**: `~/.kbot/checkpoints/*.json` `toolSequenceLog` arrays + `messages[].content[].tool_use` blocks.
- **Observer**: `~/.kbot/observer/session.jsonl` (26100 lines). Tool names there are Claude-Code primitives (Read, Edit, Bash); only entries that match a kbot tool name are counted.
- **Claude-Code transcripts**: 47 JSONL files in `~/.claude/projects/-Users-isaachernandez-blog-design/`. `tool_use` blocks with `mcp__kbot__<name>` or `mcp__kbot-local__<name>` were stripped of prefix and counted.
- **Cutoffs**: 30d = 2026-03-26, 90d = 2026-01-25.
- **Data quality**: 2 tool names appeared in transcripts but were not in the master list — likely renamed or registered dynamically. Most events have valid timestamps; no malformed records dropped.
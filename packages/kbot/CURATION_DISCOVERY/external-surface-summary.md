# External Surface Audit — Summary

Generated: 2026-04-28T20:08:05.785Z

## Headline Numbers

- **Total tools audited**: 741
- **Every tool is reachable via the SDK / MCP / ACP** through generic dispatch
  (`tools.execute(name, args)`, MCP dynamic-append, `tools/execute`).
  So those three columns are 1 for every registered tool.
- **Tools with zero "extra" external refs** (no kbot_local mirror, no
  Claude agent .md mention, no specialist allowedTools entry): **704**
  — these are easier to cut without breaking documented contracts.
- **Tools with at least one extra external ref**: **37**

## Per-Surface Counts

| Surface | Tools exposed | Notes |
|---|---|---|
| sdk.ts | 741 | `tools.list()` returns `getAllTools()`; `tools.execute(name, args)` accepts any registered name. Every tool is on the SDK contract. |
| MCP server (mcp-server.ts) | 741 | `ListToolsRequestSchema` handler dynamically appends every registered tool not already in the static `kbot_*` list. |
| ACP server (acp-server.ts) | 741 | `tools/list` calls `getToolList()`; `tools/execute` dispatches by tool name to `executeCommand`. |
| kbot-local MCP | 21 | `local_*` tool names: local_ask, local_commit_message, local_convert, local_diagram, local_diff, local_docs, local_embeddings, local_explain, local_generate, local_kbot, local_kbot_agents, local_models, local_refactor, local_regex, local_review, local_shell_explain, local_sql, local_summarize, local_test_gen, local_translate, local_vision |
| Claude agents (.md files) | 8 (with at least one ref) | 52 agent files scanned. |
| specialists.ts allowedTools | 35 (distinct) | Only the `guardian` specialist has an explicit allowedTools whitelist. Others inherit the global tool set. |

## Top 20 Most Publicly-Exposed Tools (by total_external_refs)

| Rank | Tool | sdk | mcp | acp | kbot_local | claude_agents | specialists | total |
|---|---|---|---|---|---|---|---|---|
| 1 | `forge_tool` | 1 | 1 | 1 | 0 | 3 | 0 | 6 |
| 2 | `browser_navigate` | 1 | 1 | 1 | 0 | 2 | 0 | 5 |
| 3 | `browser_snapshot` | 1 | 1 | 1 | 0 | 2 | 0 | 5 |
| 4 | `grep` | 1 | 1 | 1 | 0 | 1 | 1 | 5 |
| 5 | `mcp_search` | 1 | 1 | 1 | 0 | 2 | 0 | 5 |
| 6 | `attack_lookup` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 7 | `blueteam_checklist` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 8 | `blueteam_harden` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 9 | `cors_check` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 10 | `cve_lookup` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 11 | `dep_audit` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 12 | `deploy` | 1 | 1 | 1 | 0 | 1 | 0 | 4 |
| 13 | `deps_audit` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 14 | `exploit_search` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 15 | `forensics_analyze` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 16 | `glob` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 17 | `headers_check` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 18 | `incident_response` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 19 | `jwt_analyze` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |
| 20 | `killchain_analyze` | 1 | 1 | 1 | 0 | 0 | 1 | 4 |

## Surprises — CURATION_PLAN cut/drop candidates that have external refs

- `forge_tool` — kbot_local=0, claude_agents=3, specialists=0

## Surface Notes & Ambiguities

1. **SDK / MCP / ACP "exposure" is universal.** All three surfaces dispatch by
   tool name into the global registry. So strictly speaking, every registered
   tool is part of those contracts — cutting any tool *could* break a third-party
   caller who happened to invoke it by name. The truly load-bearing column is
   "is the tool individually documented or named" — captured by:
     - `kbot_local` (explicit `local_*` mirror)
     - `claude_agents` (named in any `.claude/agents/*.md` file)
     - `specialists` (in an `allowedTools` array in specialists.ts)
2. **Static MCP `kbot_*` tools** wrap a small set of underlying tools:
   `edit_file`, `write_file`, `read_file`, `bash`, `web_search`, `github_search`, `glob`, `grep`.
   Cutting any of those is a hard breaking change for the IDE MCP contract —
   the kbot_edit_file / kbot_write_file / kbot_read_file / kbot_bash / kbot_search /
   kbot_github / kbot_glob / kbot_grep handlers all dispatch into `executeCommand`
   with these names.
3. **ACP code-action handlers** explicitly call `executeCommand('edit_file' | 'write_file' | 'read_file')`. Cutting those breaks JetBrains/IntelliJ ACP integration.
4. **Specialist allowedTools** — only `guardian` has a non-empty
   `allowedTools` array. Every name in that array is on the Guardian agent's
   contract.
5. **Agent .md scan** uses tool-call signal matching (backticks, parens,
   bullets, quoted strings) to suppress prose false positives. A match
   means the tool name appears in a tool-reference context in at least one
   `.claude/agents/*.md` file.
6. **kbot_local column is universally 0** in the master tool table because
   the `local_*` tools in `tools/kbot-local-mcp.ts` are an independent
   namespace (Ollama-backed) and do not mirror kbot's 741 registered tools
   by name. Cutting any kbot tool does not affect the kbot-local MCP
   contract, and vice versa. The 21 `local_*` names are tracked separately
   in the per-surface table above.

## Hard-line Public Contract (cuts that definitely break clients)

Anything in **kbot_local** `local_*` names ⇒ direct user-facing tool.
Anything reachable via the static `kbot_*` MCP handlers (read_file, write_file,
edit_file, bash, web_search, github_search, glob, grep) ⇒ IDE contract.
`edit_file`, `write_file`, `read_file` ⇒ ACP IDE contract.
Every entry in guardian.allowedTools ⇒ Guardian specialist contract.

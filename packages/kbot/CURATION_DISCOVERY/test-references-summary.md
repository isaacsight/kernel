# Test References Summary

- **Total tools processed**: 794
- **Total test files scanned**: 49
- **Tools with 0 test references**: 738 (safe to cut without test changes)
- **Tools with 1+ test references**: 56
- **Tools whose only ref is in their own test file**: 9
- **Tools with cross-cutting test risk (refs in non-own test files)**: 47
- **Tools referenced in 5+ test files (high cross-cutting risk)**: 0

## Top 10 Most-Tested Tools

| Tool | Test Files |
|---|---|
| `bash` | 4 |
| `grep` | 4 |
| `read_file` | 4 |
| `web_search` | 4 |
| `glob` | 2 |
| `research` | 2 |
| `url_fetch` | 2 |
| `write_file` | 2 |
| `agent_handoff` | 1 |
| `agent_propose` | 1 |

## Tools Referenced in 5+ Test Files (Cross-Cutting Risk)

_None_

## Tools Whose Only Reference Is Their Own Test File

_(9 tools — cuts here only require deleting the matching test file.)_

<details><summary>Show list</summary>

- `computer_check` -> `packages/kbot/src/tools/computer.test.ts`
- `computer_release` -> `packages/kbot/src/tools/computer.test.ts`
- `forge_tool` -> `packages/kbot/src/tools/forge.test.ts`
- `git_branch` -> `packages/kbot/src/tools/git.test.ts`
- `git_commit` -> `packages/kbot/src/tools/git.test.ts`
- `git_diff` -> `packages/kbot/src/tools/git.test.ts`
- `git_log` -> `packages/kbot/src/tools/git.test.ts`
- `git_push` -> `packages/kbot/src/tools/git.test.ts`
- `git_status` -> `packages/kbot/src/tools/git.test.ts`

</details>

## Tools With Cross-Cutting Test References

_(47 tools — cuts here may break tests in other modules.)_

<details><summary>Show list (sorted by ref count)</summary>

- `bash` (4): `critic-gate.test.ts`, `growth.test.ts`, `forge.test.ts`, `bash.test.ts`
- `grep` (4): `critic-taxonomy.test.ts`, `critic-gate.test.ts`, `files.test.ts`, `specialists-security-wiring.test.ts`
- `read_file` (4): `workspace-agents.test.ts`, `learning.test.ts`, `files.test.ts`, `specialists-security-wiring.test.ts`
- `web_search` (4): `workspace-agents.test.ts`, `managed-agents-anthropic.test.ts`, `critic-gate.test.ts`, `search.test.ts`
- `glob` (2): `critic-gate.test.ts`, `files.test.ts`
- `research` (2): `agent-protocol.test.ts`, `search.test.ts`
- `url_fetch` (2): `search.test.ts`, `fetch.test.ts`
- `write_file` (2): `learning.test.ts`, `files.test.ts`
- `agent_handoff` (1): `agent-protocol.test.ts`
- `agent_propose` (1): `agent-protocol.test.ts`
- `agent_trust` (1): `agent-protocol.test.ts`
- `app_approve` (1): `computer.test.ts`
- `blackboard_read` (1): `agent-protocol.test.ts`
- `blackboard_write` (1): `agent-protocol.test.ts`
- `cve_lookup` (1): `specialists-security-wiring.test.ts`
- `dep_audit` (1): `specialists-security-wiring.test.ts`
- `deploy` (1): `learning.test.ts`
- `ecs_generate` (1): `gamedev.test.ts`
- `edit_file` (1): `files.test.ts`
- `evolve_design` (1): `creative.test.ts`
- `game_audio` (1): `gamedev.test.ts`
- `game_build` (1): `gamedev.test.ts`
- `game_config` (1): `gamedev.test.ts`
- `game_test` (1): `gamedev.test.ts`
- `generate_art` (1): `creative.test.ts`
- `generate_music_pattern` (1): `creative.test.ts`
- `generate_shader` (1): `creative.test.ts`
- `generate_svg` (1): `creative.test.ts`
- `kbot_read` (1): `critic-gate.test.ts`
- `level_generate` (1): `gamedev.test.ts`
- `list_directory` (1): `files.test.ts`
- `material_graph` (1): `gamedev.test.ts`
- `mesh_generate` (1): `gamedev.test.ts`
- `mouse_click` (1): `computer.test.ts`
- `multi_file_write` (1): `files.test.ts`
- `navmesh_config` (1): `gamedev.test.ts`
- `netcode_scaffold` (1): `gamedev.test.ts`
- `particle_system` (1): `gamedev.test.ts`
- `physics_setup` (1): `gamedev.test.ts`
- `question` (1): `agent-protocol.test.ts`
- `run_tests` (1): `init.test.ts`
- `scaffold_game` (1): `gamedev.test.ts`
- `shader_debug` (1): `gamedev.test.ts`
- `sprite_pack` (1): `gamedev.test.ts`
- `tilemap_generate` (1): `gamedev.test.ts`
- `window_move` (1): `computer.test.ts`
- `window_resize` (1): `computer.test.ts`

</details>

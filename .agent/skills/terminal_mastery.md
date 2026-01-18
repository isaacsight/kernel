---
name: terminal_mastery
description: Advanced shell interaction and system control inspired by Claude Code.
---

# Terminal Mastery Skill

This skill provides advanced directives for interacting with the terminal, managing long-running processes, and executing complex shell pipelines.

## Capabilities
- **Pipeline Orchestration**: Building complex `grep`, `sed`, `awk`, and `find` chains.
- **Process Management**: Monitoring background tasks and managing lifecycle.
- **Environment Discovery**: mapping system capabilities, installed tools, and network state.

## Instructions
1. **Always use absolute paths** for reliability.
2. **Prefer non-interactive flags** (e.g., `-y`, `-B`) to avoid blocking the agent.
3. **Capture and analyze stderr** separately from stdout to detect silent failures.
4. **Use `command_status`** to monitor long-running builds or tests.

## Tools Integrated
- `run_command`
- `command_status`
- `send_command_input`
- `read_terminal`

---
name: context_architect
description: Intelligent context management and memory residue generation inspired by Gemini CLI.
---

# Context Architect Skill

This skill optimizes the agent's interaction with million-token context windows, ensuring high-fidelity reasoning across massive codebases.

## Capabilities
- **Residue Generation**: Every conversation must leave behind a structured artifact (residue) to preserve state.
- **Context Optimization**: Identifying "dead weight" in the current context and suggesting manual clearing or pruning.
- **Codebase Indexing**: Strategic use of `view_file_outline` and `grep_search` to map dependencies without loading the entire file content prematurely.

## Instructions
1. **Compounding Conversations**: Always reference previous artifacts in `<appDataDir>/brain/`.
2. **Token Economy**: Use `view_content_chunk` for massive log files or documentation.
3. **System Documentation**: Ensure `AGENTS.md` and `CLAUDE.md` (the Constitution) are updated after major architectural shifts.

## Tools Integrated
- `view_file_outline`
- `grep_search`
- `view_content_chunk`
- `task_boundary`

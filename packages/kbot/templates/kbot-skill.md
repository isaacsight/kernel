# kbot — Claude Code Skill

This file is a copy of the kbot skill, installed by `kbot setup-claude-code`.

## What this is

A pointer skill that tells Claude Code how to delegate work to the local
`kbot` MCP server (full 670+ tool suite) and the `kbot-local` MCP server
(local Ollama, $0 cost, sandboxed to localhost).

## When to use kbot

- File / git / shell operations: prefer `mcp__kbot__kbot_*` tools — they
  run locally, $0 cost, no round-trip to a remote model.
- Research, multi-step planning, web search, GitHub queries: route through
  `mcp__kbot__research`, `mcp__kbot__web_search`, `mcp__kbot__github_*`.
- Cheap reasoning, summarization, code review: prefer `mcp__kbot-local__*`
  tools (Ollama). Use only for tasks where a 7B–14B local model is enough.
- Ableton / music production: `mcp__kbot__ableton_*` and `mcp__kbot__kbot_control`.

## Where the canonical skill lives

The full source for this skill is maintained at `.claude/skills/kbot.md`
inside the kbot repo (https://github.com/isaacsight/kernel). When the
canonical skill is updated, re-run `kbot setup-claude-code --force` to
pull the latest copy into this project.

## Installation footprint

`kbot setup-claude-code` did three things:

1. Wired the `kbot` MCP server into `~/.claude/settings.json` (full tool suite).
2. Wired the `kbot-local` MCP server into `~/.claude/settings.json` (local Ollama).
3. Copied this file to `<project>/.claude/skills/kbot.md`.

To remove: delete the `mcpServers.kbot` and `mcpServers["kbot-local"]`
entries from `~/.claude/settings.json` and delete this file.

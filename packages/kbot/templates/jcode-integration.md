# Using kbot with jcode

`jcode` is a fast meta-harness. `kbot` is a deep specialty agent. They compose: jcode wraps your existing Claude / Codex subscription for fast multi-session work, and kbot adds the verticals jcode will never ship — music production, computer-use coordinator, local-first AI, channels (Slack/Office/+), security agent, dream engine.

## Install

```bash
npm install -g @kernel.chat/kbot
```

Then drop the MCP snippet from `templates/jcode-mcp-snippet.json` into your jcode MCP config. After saving, jcode sees the full kbot tool surface as `mcp__kbot__*`.

## Two example prompts that work great

**Music production from inside jcode:**

> "kbot, fire up an Ableton trap drum pattern at 140 BPM and load Serum 2 on track 1 with the Mark1 Stage preset"

jcode routes this to `mcp__kbot__ableton_*` and `mcp__kbot__serum2_preset`. kbot drives Ableton via the kbot-control TCP bridge. jcode never has to know what Ableton is.

**Security audit from inside jcode:**

> "kbot, scan this directory for hardcoded secrets, eval calls, and dangerouslySetInnerHTML"

jcode routes to `mcp__kbot__security_agent_scan`. kbot's security agent runs 17 static rules in `report-only` mode, returns a structured report with severity and recommendations. jcode displays it.

## Why this composition matters

- **jcode wins** on cold start, multi-session memory efficiency, and managing your existing AI subscription's session state.
- **kbot wins** on vertical depth, BYOK + local-first cost, and the specialty surfaces nobody else builds.

You don't have to pick. Layer them.

## Optional: kbot-local for $0 tasks

Add the `kbot-local` server entry too. It exposes 21 `mcp__kbot-local__*` tools that route to your local Ollama install. Good for code review, summarization, commit message drafting, file translation — anything you don't need a frontier model for. $0 per call.

## Reverse direction: drive jcode from kbot

If you also want kbot to call jcode (e.g., as one of kbot's "specialist sessions"), kbot v4.1 will ship a `kbot import-session --from jcode` command. The reverse flow ships in v4.1.0. Until then, keep them parallel — kbot direct for verticals, jcode-with-kbot-MCP for general harness work.

## Update path

`npm i -g @kernel.chat/kbot` whenever a new release ships. Latest version: see [@kernel.chat/kbot on npm](https://www.npmjs.com/package/@kernel.chat/kbot).

# K:BOT Launch Drafts

Ready-to-post content for each channel. Edit as needed, then post.

---

## 1. Hacker News — Show HN

**Title** (80 chars max):
```
Show HN: K:BOT – Open-source terminal AI agent, 37 specialists, 100+ tools, runs offline
```

**Body** (post as a comment on your own submission):
```
Hi HN, I built K:BOT — an open-source terminal AI agent that routes your
requests to the right specialist automatically.

What makes it different from Claude Code / Aider / OpenCode:

- 37 specialist agents (coder, researcher, debugger, physicist, economist, etc.)
  that auto-route based on intent classification
- Learning engine that remembers what worked and adapts to your coding style
- 19 AI providers (Claude, GPT, Gemini, Grok, DeepSeek, etc.) or fully offline
  with Ollama ($0)
- Aider-style repo map for automatic codebase context
- Self-evaluation: responses get quality-scored, auto-retried if low
- Provider fallback: if one API is down, auto-switches to another
- Built-in MCP server — plug it into VS Code, Cursor, or any MCP-compatible IDE
- 119 tools including web search, Docker sandbox, browser automation, sub-agents

It's MIT licensed, runs on Node 20+, and installs in one line:

    npm i -g @kernel.chat/kbot

Local-first: simple ops (file reads, git, grep) never hit an API. Complex tasks
go through a plan→execute→verify→learn loop with up to 75 tool iterations.

v2.7.0 just shipped with repo maps (Aider-style context), provider fallback
(19 providers deep), self-evaluation, and a Magentic-One-style task ledger.

Also has a web companion at kernel.chat with the same agents.

GitHub: https://github.com/isaacsight/kernel
npm: https://www.npmjs.com/package/@kernel.chat/kbot
```

**When to post**: 12-17 UTC (catches US morning + EU afternoon)

---

## 2. Reddit — r/commandline

**Title**:
```
K:BOT — open-source terminal AI agent with 37 specialists, 14 providers, runs offline with Ollama
```

**Body**:
```
Been building K:BOT for a few weeks. It's a terminal AI agent that picks the
right specialist for your task (coder, researcher, debugger, etc.) and has a
learning engine that remembers what worked.

What I think is cool about it:
- 19 AI providers or fully offline with Ollama ($0, no data leaves your machine)
- 119 tools (file ops, bash, git, GitHub, web search, Docker sandbox, browser)
- Pipe mode: `kbot -p "generate a migration" > migration.sql`
- MCP server built in — use it inside VS Code, Cursor, or Zed
- Learning engine caches patterns and adapts to your style over time

Install: `npm i -g @kernel.chat/kbot`

MIT licensed. GitHub: https://github.com/isaacsight/kernel

Would love feedback from folks who live in the terminal.
```

**Also post to**: r/LocalLLaMA (emphasize Ollama/offline), r/artificial, r/programming

---

## 3. Reddit — r/LocalLLaMA

**Title**:
```
Built an open-source terminal AI agent that runs fully offline with Ollama — 37 specialists, 119 tools, $0
```

**Body**:
```
K:BOT is a terminal AI agent that works 100% locally with Ollama. No API keys,
no cloud, no cost.

`kbot ollama` auto-detects your models and picks the best one. It also has an
OpenClaw gateway integration for local model tools (explain, review, refactor,
test gen, etc.).

The agent loop is the same whether you're using Claude Sonnet or llama3.1:8b —
37 specialist agents, 119 tools, learning engine, autonomous planner, sessions.

Currently tested with: llama3.1:8b, gemma3:12b, qwen2.5-coder:14b, deepseek-r1:14b,
phi4:14b, mistral:7b

Install: `npm i -g @kernel.chat/kbot && kbot ollama`

MIT: https://github.com/isaacsight/kernel
```

---

## 4. Dev.to Article

**Title**: "I built an open-source terminal AI agent with 37 specialists and a learning engine"

**Tags**: #opensource #ai #cli #terminal

**Body outline**:
1. Problem: Claude Code locks you in, Aider doesn't learn, OpenCode has no agents
2. Solution: K:BOT — BYOK, 37 specialists, learning engine, offline mode
3. Demo: show one-shot, interactive, pipe mode, MCP
4. Architecture: local-first check → complexity detection → agent routing → tool loop → learning
5. Comparison table (same as README)
6. How to try it: `npx @kernel.chat/kbot`
7. What's next: OpenClaw skills registry, more specialists, voice mode

---

## 5. Twitter/X Thread

```
🧵 I built K:BOT — an open-source terminal AI agent.

37 specialist agents. 119 tools. 19 AI providers. Runs offline with Ollama.

npm i -g @kernel.chat/kbot

Here's what makes it different from Claude Code and Aider: ↓
```

```
1/ SPECIALIST ROUTING

You say "fix this bug" → kbot picks the Coder agent.
You say "research React vs Svelte" → kbot picks the Researcher.
You say "review this PR for security issues" → kbot picks the Guardian.

37 specialists, auto-routed by intent.
```

```
2/ LEARNING ENGINE

K:BOT remembers what worked. Patterns, solutions, your preferences.

It literally gets faster and smarter the more you use it.
No other terminal agent does this.
```

```
3/ $0 OFFLINE MODE

kbot ollama

Auto-detects local models. Same 37 agents, same 119 tools. Zero API cost.
Your code never leaves your machine.
```

```
4/ MCP SERVER

Add one line to your IDE config and kbot becomes a tool provider inside
Claude Code, Cursor, VS Code, Zed, or Neovim.

14 tools exposed: chat, plan, bash, read, edit, write, search, grep...
```

```
5/ SELF-HEALING

Response quality too low? K:BOT scores its own output and auto-retries.

Provider goes down? Auto-switches to the next one — 19 providers deep.

Repo map injects codebase context automatically. No manual @-file tagging.
```

```
6/ PIPE MODE

kbot -p "generate a user roles migration" > migration.sql
kbot -p "write tests for auth.ts" > auth.test.ts

Composable with any Unix pipeline.
```

```
MIT licensed. One install. Zero config.

GitHub: github.com/isaacsight/kernel
npm: npmjs.com/package/@kernel.chat/kbot
Web: kernel.chat

Star it if it's useful ⭐
```

---

## 6. GitHub Discussion (Announcements)

**Title**: K:BOT v2.7.0 — 37 Specialists, MCP Server, Learning Engine

**Body**:
```
K:BOT is now at v2.7.0 with 37 specialist agents, full MCP server integration,
and a learning engine that adapts to your workflow.

New in v2.7.0:
- 37 specialist agents (was 17) covering code, research, science, math, ethics, and more
- Aider-style repo map — auto-indexes your codebase for smarter context
- LiteLLM-style provider fallback — auto-failover across 19 providers
- Self-evaluation — responses get quality-scored and auto-retried if low
- Active memory tools — the agent can save/search/update its own knowledge
- Task ledger — Magentic-One-style planning with auto-replan on failure
- Improved Ollama support — auto-detects models, skips tool defs for local models
- 119 tools (was 60+), 19 providers (was 14)
- MIT license, MCP server, HTTP server mode

Try it: `npm i -g @kernel.chat/kbot`

We'd love your feedback. What agents would you add? What tools are missing?
```

---

## Posting Schedule

| Day | Channel | Time (UTC) |
|-----|---------|------------|
| Day 1 (Thu) | Twitter/X thread | 14:00 |
| Day 1 (Thu) | GitHub Discussion | 14:00 |
| Day 2 (Fri) | Show HN | 14:00 |
| Day 2 (Fri) | r/commandline | 15:00 |
| Day 3 (Sat) | r/LocalLLaMA | 15:00 |
| Day 4 (Mon) | Dev.to article | 14:00 |
| Day 5 (Tue) | r/programming | 14:00 |
| Day 5 (Tue) | r/artificial | 15:00 |

Spread across days to avoid looking spammy and to catch different audiences.

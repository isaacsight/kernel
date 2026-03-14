# K:BOT Launch Drafts — v2.11.0

Ready-to-post content for each channel. Copy-paste and go.

---

## 1. Hacker News — Show HN

**Title** (80 chars max):
```
Show HN: K:BOT – Open-source terminal AI agent with 39 specialists, runs offline
```

**Body** (post as a comment on your own submission):
```
Hi HN, I built K:BOT — an open-source terminal AI agent that routes your
requests to the right specialist automatically.

What makes it different from Claude Code / Aider / Codex CLI:

- 39 specialist agents (coder, researcher, creative, debugger, physicist, etc.)
  that auto-route based on intent classification
- Learning engine that remembers what worked and adapts to your coding style
- 19 AI providers (Claude, GPT, Gemini, Grok, DeepSeek, etc.) or fully offline
  with Ollama ($0)
- 158 tools including web search, Docker sandbox, browser automation, sub-agents,
  generative art, shader generation, music patterns
- MCP server built in — plug it into VS Code, Cursor, Zed, or any MCP IDE
- Self-evaluation: responses get quality-scored, auto-retried if low
- Provider fallback: if one API is down, auto-switches to another
- Aider-style repo map for automatic codebase context
- Creative intelligence tools — generate p5.js sketches, GLSL shaders, SVG art,
  Sonic Pi music, and evolve designs with genetic mutations

MIT licensed. Node 20+. One line install:

    npm i -g @kernel.chat/kbot

Local-first: file reads, git, grep never hit an API. Complex tasks go through
a plan→execute→verify→learn loop.

Also has a web companion at kernel.chat (free, 20 msgs/day).

GitHub: https://github.com/isaacsight/kernel
npm: https://www.npmjs.com/package/@kernel.chat/kbot
```

**When to post**: 12-17 UTC (catches US morning + EU afternoon)

---

## 2. Reddit — r/commandline

**Title**:
```
K:BOT — open-source terminal AI agent with 39 specialists, 19 providers, runs offline with Ollama
```

**Body**:
```
Been building K:BOT for a few weeks. It's a terminal AI agent that picks the
right specialist for your task (coder, researcher, creative, debugger, etc.) and
has a learning engine that remembers what worked.

What I think is cool about it:
- 19 AI providers or fully offline with Ollama ($0, no data leaves your machine)
- 158 tools (file ops, bash, git, GitHub, web search, Docker sandbox, browser,
  generative art, shader gen, music patterns)
- Pipe mode: `kbot -p "generate a migration" > migration.sql`
- MCP server built in — use it inside VS Code, Cursor, or Zed
- Learning engine caches patterns and adapts to your style over time
- Creative tools: generate p5.js sketches, GLSL shaders, SVG art from the terminal

Install: `npm i -g @kernel.chat/kbot`

MIT licensed. GitHub: https://github.com/isaacsight/kernel

Would love feedback from folks who live in the terminal.
```

**Also post to**: r/LocalLLaMA (emphasize Ollama/offline), r/artificial, r/programming

---

## 3. Reddit — r/LocalLLaMA

**Title**:
```
Built an open-source terminal AI agent that runs fully offline with Ollama — 39 specialists, 158 tools, $0
```

**Body**:
```
K:BOT is a terminal AI agent that works 100% locally with Ollama, LM Studio,
or Jan. No API keys, no cloud, no cost.

`kbot local` auto-detects your models and picks the best one. It also supports
OpenClaw for local model tools (explain, review, refactor, test gen, etc.).

The agent loop is the same whether you're using Claude Sonnet or llama3.1:8b —
39 specialist agents, 158 tools, learning engine, autonomous planner, sessions.

Currently tested with: llama3.1:8b, gemma3:12b, qwen2.5-coder:14b,
deepseek-r1:14b, phi4:14b, mistral:7b

Install: `npm i -g @kernel.chat/kbot && kbot local`

MIT: https://github.com/isaacsight/kernel
```

---

## 4. Dev.to Article

**Title**: "I built an open-source terminal AI agent with 39 specialists and creative intelligence tools"

**Tags**: #opensource #ai #cli #terminal

**Body outline**:
1. Problem: Claude Code locks you in, Aider doesn't learn, Codex CLI is OpenAI-only
2. Solution: K:BOT — BYOK, 39 specialists, learning engine, offline mode
3. Demo: show one-shot, interactive, pipe mode, MCP, creative tools
4. Architecture: local-first check → complexity detection → agent routing → tool loop → learning
5. Creative intelligence: generate art, shaders, music, SVGs from the terminal
6. v2.11.0 highlights: creative agent, developer agent, 5 creative tools, quality-diversity
7. Comparison table (same as README)
8. How to try it: `npx @kernel.chat/kbot`
9. What's next: marketplace plugins, MAP-Elites in learning engine, kernel.chat creative workspace

---

## 5. Twitter/X Thread

```
I built K:BOT — an open-source terminal AI agent.

39 specialist agents. 158 tools. 19 AI providers. Runs offline.

npm i -g @kernel.chat/kbot

Here's what makes it different from Claude Code and Aider:
```

```
1/ SPECIALIST ROUTING

You say "fix this bug" — kbot picks the Coder.
You say "research React vs Svelte" — kbot picks the Researcher.
You say "generate a shader" — kbot picks the Creative agent.

39 specialists, auto-routed by intent.
```

```
2/ LEARNING ENGINE

K:BOT remembers what worked. Patterns, solutions, your preferences.

It gets faster and smarter the more you use it.
No other terminal agent does this.
```

```
3/ $0 OFFLINE MODE

kbot local

Auto-detects Ollama, LM Studio, or Jan models. Same 39 agents, same 158 tools.
Your code never leaves your machine.
```

```
4/ CREATIVE INTELLIGENCE

kbot --agent creative "generate a flow field sketch"

Generates working p5.js sketches, GLSL shaders, Sonic Pi music, SVG art.

Plus an evolve_design tool that mutates any design with genetic variations.
```

```
5/ MCP SERVER

Add one line to your IDE config and kbot becomes a tool provider inside
Claude Code, Cursor, VS Code, Zed, or Neovim.

14 tools exposed: chat, plan, bash, read, edit, write, search, grep...
```

```
6/ SELF-HEALING

Response quality too low? K:BOT scores its own output and auto-retries.

Provider down? Auto-switches — 19 providers deep.

Repo map injects codebase context automatically. No manual file tagging.
```

```
7/ PIPE MODE

kbot -p "generate a user roles migration" > migration.sql
kbot -p "write tests for auth.ts" > auth.test.ts

Composable with any Unix pipeline.
```

```
MIT licensed. One install. Zero config.

GitHub: github.com/isaacsight/kernel
npm: npmjs.com/package/@kernel.chat/kbot
Web: kernel.chat

Star it if it's useful
```

---

## 6. GitHub Discussion (Announcements)

**Title**: K:BOT v2.11.0 — 39 Specialists, Creative Intelligence, Developer Agent

**Body**:
```
K:BOT v2.11.0 is out with creative intelligence tools and a self-improving
developer agent.

New in v2.11.0:
- Creative specialist agent — generative art, shaders, music, procedural gen
- Developer specialist agent — helps build and improve kbot itself
- 5 creative tools: generate_art, generate_shader, generate_music_pattern,
  generate_svg, evolve_design
- Awesome Creative Intelligence — curated list of 80+ creative coding resources
- 39 specialists (was 37), 158 tools (was 153)

Previous highlights:
- 19 AI providers with auto-failover
- Fully offline with Ollama/LM Studio/Jan (`kbot local`)
- Learning engine, graph memory, confidence calibration
- Aider-style repo map, architect mode, task ledger
- MCP server for IDE integration
- LSP bridge, E2B cloud sandbox, MCP-native plugins

Try it: `npm i -g @kernel.chat/kbot`

What agents would you add? What tools are missing?
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

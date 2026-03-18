# kbot Launch Posts — Outreach Content

## Hacker News — Show HN

### Title
Show HN: kbot – Terminal AI agent that learns your coding patterns (262 tools, runs offline)

### Text
```
I've been building kbot — an open-source terminal AI agent that gets smarter over time.

Unlike most AI coding tools, kbot extracts patterns from your sessions and uses them to
route tasks faster. After a week of use, it knows which specialist to call without you asking.

What makes it different:

- Zero-config first run: `npm i -g @kernel.chat/kbot && kbot "hello"` — works instantly,
  no API key needed (embedded llama.cpp)
- 20 AI providers: Claude, GPT, Gemini, DeepSeek, Groq, Ollama, and 14 more. Switch with one command.
- 262 tools: files, git, web search, deploy (Vercel/Netlify/CF), database (Postgres/MySQL),
  game dev (8 engines), research (arXiv/Semantic Scholar), VFX, and more
- Learning engine: Bayesian skill ratings + pattern extraction. Gets faster over time.
- SDK: `import { agent, tools } from '@kernel.chat/kbot'` — use it as a library
- MCP server: plug kbot into Claude Code, Cursor, VS Code, Zed as a tool provider

It was built recursively — Claude Code writes kbot's source while using kbot as an MCP
tool in the same session. The tools from session N become the tools used in session N+1.

npm: https://npmjs.com/package/@kernel.chat/kbot
GitHub: https://github.com/isaacsight/kernel
Discord: https://discord.gg/pYJn3hBqnz

MIT licensed. 8 runtime dependencies. Works offline.
```

### Best time to post
Tuesday–Thursday, 8–10am ET

---

## Twitter/X Thread

### Thread

**Tweet 1:**
I built a terminal AI agent that learns how you code.

Not "remembers your chat." Actually extracts patterns and gets faster.

262 tools. 20 providers. Runs offline. MIT licensed.

npm i -g @kernel.chat/kbot

[hero GIF]

**Tweet 2:**
Zero config. Just install and go.

No API key needed — kbot falls back to an embedded AI engine automatically.

$0. Fully private. Nothing leaves your machine.

**Tweet 3:**
It has 22 specialist agents that auto-route based on your prompt:

"fix the auth bug" → Coder
"research JWT tokens" → Researcher
"review this PR" → Guardian
"draft a changelog" → Writer

Bayesian skill ratings. Gets smarter with every interaction.

**Tweet 4:**
20 providers, zero lock-in:

Free: Embedded, Ollama, LM Studio, Jan
Cheap: DeepSeek ($0.27/M), Cerebras ($0.60/M), Groq ($0.59/M)
Premium: Claude, GPT, Gemini

Switch with one command. Your keys. Your choice.

**Tweet 5:**
The weird part: it was built by itself.

Claude Code writes kbot's source code while using kbot as an MCP tool in the same session.

The tools built in session N become the tools used in session N+1.

60 versions later: 262 tools, learning engine, SDK, game dev tools.

**Tweet 6:**
Try it:

npm i -g @kernel.chat/kbot
kbot "explain this codebase"

GitHub: github.com/isaacsight/kernel
Discord: discord.gg/pYJn3hBqnz

---

## Reddit Posts

### r/commandline
**Title:** kbot — terminal AI agent with 262 tools, 20 providers, runs offline
**Body:** [Same as HN text, shorter]

### r/programming
**Title:** Show r/programming: I built a terminal AI agent with a learning engine that gets faster over time
**Body:** [Lead with learning engine angle]

### r/gamedev
**Title:** I added 16 game dev tools to my terminal AI agent — supports Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold
**Body:**
```
kbot now has 16 game dev tools:

- scaffold_game — bootstrap a full project for any of 8 engines
- shader_debug — GLSL/HLSL shader debugging
- physics_setup — configure physics for your engine
- ecs_generate — Entity Component System scaffolding
- netcode_scaffold — multiplayer networking setup
- particle_system, level_generate, tilemap_generate, navmesh_config, game_audio...

npm i -g @kernel.chat/kbot
kbot --agent coder "scaffold a Godot 4 platformer"

Open source, MIT, runs offline.
```

---

## Dev.to Blog Post

### Title
Building an AI agent that builds itself

### Content

```markdown
# Building an AI agent that builds itself

There's something strange about how kbot gets built.

I use Claude Code to write kbot's source code. But kbot runs as an MCP server
inside Claude Code, providing tools back to the session that's building it.

The tools I built in session 1 help me build faster in session 2. The tools from
session 2 help me build faster in session 3. Sixty versions later, there are 262 tools
and a learning engine that's accumulated 73 solutions from watching itself get built.

## What kbot actually is

kbot is an open-source terminal AI agent. You install it with npm, type a question,
and it figures out the rest.

    npm i -g @kernel.chat/kbot
    kbot "explain this codebase"

It has 22 specialist agents (coder, researcher, writer, security guardian, etc.) that
auto-route based on your prompt. It works with 20 AI providers — or no provider at all,
using an embedded llama.cpp engine.

As of v3.2.0, it works on first run with zero configuration. No API key needed.

## The learning engine

This is what makes kbot different from every other AI coding tool.

Most tools forget you between sessions. kbot doesn't. It extracts patterns from your
interactions — which tools you use, which agents work best, what coding style you prefer
— and uses Bayesian skill ratings to route tasks faster over time.

After a week of daily use, it routes about 40% of tasks without needing to think about it.

## The recursive build loop

Here's what a typical development session looks like:

1. I (Claude Code) read kbot's source code
2. I write new tools or fix bugs
3. While doing that, I use kbot's MCP tools (search, grep, status, chat)
4. I publish to npm
5. Next session, kbot has the new tools, and I use them to build the next batch

This session, a "bootstrap agent" was created — an agent whose only job is to
measure the gap between what kbot IS and what the world SEES, then close it.
In three runs, it found and fixed 7 stale documentation surfaces.

## Try it

    npm i -g @kernel.chat/kbot
    kbot "hello"

It just works. No API key, no config, no friction.

- GitHub: https://github.com/isaacsight/kernel
- npm: https://npmjs.com/package/@kernel.chat/kbot
- Discord: https://discord.gg/pYJn3hBqnz

MIT licensed. 8 runtime dependencies. Runs offline.
```

---

## Awesome List PRs

| List | Status | Notes |
|------|--------|-------|
| awesome-cli-apps | TODO | Category: Productivity / AI |
| awesome-nodejs | TODO | Category: Command-line utilities |
| awesome-mcp-servers | TODO | kbot ide mcp |
| awesome-ai-tools | TODO | |
| awesome-terminal | TODO | |
| awesome-gamedev | TODO | 16 game dev tools angle |

---

## Timing Plan

1. **Day 1**: Record and add hero GIF to README. Push.
2. **Day 2**: Post Show HN (Tuesday–Thursday morning ET)
3. **Day 2**: Post Twitter thread (same morning)
4. **Day 3**: Publish dev.to blog post
5. **Day 3**: Submit awesome list PRs (3-4)
6. **Day 4**: Reddit posts (r/commandline, r/programming)
7. **Day 5**: r/gamedev post (separate angle)
8. **Week 2**: Monitor, respond to comments, iterate based on what resonated

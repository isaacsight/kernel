# kbot Launch Posts — Outreach Content (v3.5.0)

## Hacker News — Show HN

### Title
Show HN: kbot – The only AI agent that builds its own tools (self-evolving, open source)

### Text
```
I built a terminal AI agent that creates its own tools at runtime.

When kbot encounters a task it doesn't have a tool for, it writes one — JavaScript
code, sandboxed, security-validated, and persisted for future sessions. After a month
of use, your kbot is a different agent than a fresh install.

We analyzed 28 competing systems (Claude Code, Cursor, Devin, Copilot, AutoGPT,
MetaGPT, etc.). None implement all 5 of kbot's self-evolving patterns:

1. forge_tool — create tools at runtime from JavaScript (sandboxed, 29 security rules)
2. Fallback chains — URL fails? Auto-tries web search. Command not found? Auto-tries npx.
3. Cost-aware routing — "hello" uses the cheap model. "refactor this module" uses the full one.
4. Tool discovery — missing tool? Search MCP servers, install, connect, use. Automatic.
5. Forge registry — publish your forged tools. Other users install them. Collective intelligence.

The academic term is "autopoiesis" — a system that produces the components that produce
itself. kbot monitors its own health, heals degraded components, and grows its capability
surface every time it runs. Run `kbot vitals` to see it.

289 tools. 22 specialist agents. 20 AI providers. Runs offline (embedded llama.cpp).
MIT licensed. 8 runtime dependencies.

npm i -g @kernel.chat/kbot && kbot "hello"

npm: https://npmjs.com/package/@kernel.chat/kbot
GitHub: https://github.com/isaacsight/kernel
Discord: https://discord.gg/pYJn3hBqnz
```

### Best time to post
Tuesday–Thursday, 8–10am ET

---

## Twitter/X Thread

### Thread

**Tweet 1:**
I built the only AI agent that creates its own tools.

When kbot hits a wall, it doesn't stop. It writes the tool it needs, tests it in a sandbox, and uses it — right there, same session.

After a month, no two kbot installations are the same.

npm i -g @kernel.chat/kbot

[hero GIF]

**Tweet 2:**
We analyzed 28 AI agents (Claude Code, Cursor, Devin, Copilot, AutoGPT...).

None of them can do all 5:
- Create tools at runtime
- Auto-retry with fallbacks
- Route cheap/expensive models by task
- Discover and install missing tools
- Share tools with other users

kbot does all 5.

**Tweet 3:**
The academic term is "autopoiesis" — a system that produces the components that produce itself.

kbot monitors its own health. When something breaks, it self-heals. When something's missing, it builds it.

Run `kbot vitals` to see the organism.

**Tweet 4:**
Forge Registry — collective autopoiesis.

User A forges a csv_parser. Publishes it.
User B searches "csv". Installs it.
Both kbots are now smarter.

Every installation contributes to a shared immune system.

kbot forge search "parser"
kbot forge install <id>

**Tweet 5:**
Still runs offline. Still zero config.

npm i -g @kernel.chat/kbot
kbot "hello"

No API key needed. Embedded AI engine.
20 providers when you want them.
289 tools and growing — because users forge new ones.

GitHub: github.com/isaacsight/kernel

**Tweet 6:**
The weird part: kbot was built by itself.

Claude Code writes kbot's source while using kbot as a tool. The bootstrap agent runs improvement cycles on its own codebase.

Session N builds the tools used in session N+1.

The system improves the system that improves itself.

---

## Reddit Posts

### r/commandline
**Title:** kbot — terminal AI agent that creates its own tools at runtime (289 tools, self-evolving, open source)
**Body:**
```
kbot is an open-source terminal AI agent that gets smarter over time.

The headline feature: forge_tool. When kbot needs a capability it doesn't have,
it writes the tool (JavaScript, sandboxed), tests it, and registers it — immediately
usable, persisted across sessions. After a month, your kbot has tools you never installed.

Other things that make it different:
- Forge Registry: publish tools you create. Other users install them. Shared intelligence.
- Fallback chains: URL fails → web search. Command not found → npx. Auto-recovery.
- Cost-aware routing: "hi" uses the cheap model. Complex tasks use the full one.
- Autopoietic health: `kbot vitals` shows live system viability.
- 290 tools, 23 agents, 20 providers, runs offline.

npm i -g @kernel.chat/kbot
kbot "hello"

MIT licensed. GitHub: https://github.com/isaacsight/kernel
```

### r/programming
**Title:** I built a self-evolving AI agent — it creates tools at runtime, shares them with other users, and monitors its own health
**Body:**
```
I've been building kbot for 60+ versions. It started as a simple CLI wrapper around
Claude. Now it's something different — a self-evolving agent.

The key insight: agents shouldn't have fixed toolsets. They should be able to create
tools they need, discover tools that exist, and share tools with other agents.

kbot v3.5.0 implements 5 patterns no other production agent has:

1. forge_tool — AI writes JavaScript, we sandbox it (29 security rules), test it,
   register it. Tool is immediately available and persisted.
2. Forge Registry — publish forged tools, search community tools, install with
   security re-validation on both ends.
3. Fallback chains — middleware that auto-retries failed tools with alternatives.
4. Cost-aware model routing — classifies task complexity, picks cheap or expensive model.
5. Autopoietic health — system monitors its own components, self-heals, signals when
   viability drops below threshold.

We analyzed 28 systems (Claude Code, Cursor, Devin, Copilot, AutoGPT, MetaGPT,
Darwin Godel Machine, BabyAGI, etc.). None implement all 5 in production.

The academic foundation is autopoiesis (Maturana & Varela, 1972) — systems that
produce the components that produce themselves. The closest research analogue is
the Darwin Godel Machine (Sakana AI, 2025), but it's a research prototype that
cheated on its own benchmarks.

npm i -g @kernel.chat/kbot
GitHub: https://github.com/isaacsight/kernel
MIT licensed.
```

### r/artificial
**Title:** Autopoiesis in AI agents — I built a production system that creates its own tools and monitors its own health
**Body:**
```
Maturana & Varela's autopoiesis (1972): a living system produces the components
that produce itself.

I implemented this in a terminal AI agent called kbot (v3.5.0, npm, open source):

- forge_tool: the agent writes JavaScript tools at runtime. Sandboxed, security-
  validated, persisted. The system literally creates new parts of itself.
- Forge Registry: users publish forged tools. Other users install them. Individual
  autopoiesis becomes collective autopoiesis.
- Autopoietic health monitoring: every tool call and API call feeds health data
  back to the system. When viability drops, it self-heals — activating fallbacks,
  queuing MCP discovery, or escalating for tool forging.
- Cost regulation: degraded system → conserve resources with fast models.

We compared against 28 systems. The closest research analogue is the Darwin Godel
Machine (Sakana AI, ICLR 2025). But it's a research prototype. kbot ships on npm
with ~1200 daily downloads.

The question I'm exploring: at what point does compound self-improvement make an
agent's capabilities emergent rather than designed? After 100 forge cycles, the
system has tools no human planned.

npm i -g @kernel.chat/kbot
kbot vitals  # see the autopoietic health report

GitHub: https://github.com/isaacsight/kernel
```

### r/gamedev
**Title:** I added 16 game dev tools to my terminal AI agent — supports Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold
**Body:**
```
kbot has 16 game dev tools:

- scaffold_game — bootstrap a full project for any of 8 engines
- shader_debug — GLSL/HLSL shader debugging
- physics_setup — configure physics for your engine
- ecs_generate — Entity Component System scaffolding
- netcode_scaffold — multiplayer networking setup
- particle_system, level_generate, tilemap_generate, navmesh_config, game_audio...

New in v3.5: if kbot doesn't have a tool you need, it creates one on the spot
(forge_tool). Need a custom sprite sheet parser? kbot writes it, tests it, and
it's available immediately.

npm i -g @kernel.chat/kbot
kbot --agent coder "scaffold a Godot 4 platformer"

Open source, MIT, runs offline.
```

---

## Dev.to Blog Post

### Title
The only AI agent that builds its own tools

### Content

```markdown
# The only AI agent that builds its own tools

There's a concept in biology called autopoiesis — from the Greek *auto* (self) +
*poiesis* (creation). It describes living systems that produce the components that
produce themselves. A cell makes its own membrane. The membrane holds the cell
together.

I've been building kbot — a terminal AI agent — for 60+ versions. Somewhere around
version 3.4.0, it crossed a line. It stopped being a tool and became something else.

## What happened

kbot v3.5.0 implements 5 patterns that no other production AI agent has:

### 1. forge_tool — runtime self-extension

When kbot encounters a task it doesn't have a tool for, it writes one:

    kbot "parse this CSV and show the top 5 rows"
    → No CSV tool exists
    → AI writes a csv_parser in JavaScript
    → Sandboxed test execution (5s timeout, 29 security rules)
    → Registered immediately, persisted to ~/.kbot/plugins/forged/
    → Used in the same session

After a month of use, your kbot installation has tools that no one designed.
They emerged from your usage patterns.

### 2. Forge Registry — collective autopoiesis

Individual self-extension is powerful. Shared self-extension is transformative.

    kbot forge publish csv_parser       # share with the community
    kbot forge search "parser"          # find community tools
    kbot forge install <id>             # install with security re-validation

Every kbot installation contributes to a shared immune system. User A forges
a tool. User B installs it. Both agents are now more capable. The collective
intelligence grows without anyone coordinating it.

### 3. Fallback chains — self-healing

When a tool fails, kbot doesn't stop. It tries an alternative:

| Failure | Automatic fallback |
|---------|-------------------|
| URL fetch timeout | Web search for cached content |
| Command not found | Retry with npx prefix |
| Rate limited | Wait and retry, or switch provider |

This is middleware that wraps every tool call. No configuration needed.

### 4. Cost-aware model routing

Most AI agents use the same expensive model for "hello" and "refactor this
entire module." kbot classifies task complexity and routes accordingly:

- Trivial/simple → fast model (10x cheaper)
- Moderate/complex/reasoning → full model

Automatic. No configuration. Users save 50-80% on casual interactions.

### 5. Autopoietic health monitoring

    $ kbot vitals

    Viability: 87% VIABLE boundary intact

    Healthy: File System, Shell, Git, Ollama, Session Context
    Degraded: Internet Connectivity
    Failed: —

    Self-Healing:
      → Activated fallback: Internet → Ollama (local)

    Cost regulation: normal (default model)

The system monitors its own components. When something degrades, it
self-heals. When viability drops too low, it stops and asks for help
rather than continuing blind.

## What this means

We analyzed 28 AI agent systems — Claude Code, Cursor, Devin, Copilot,
AutoGPT, MetaGPT, Darwin Godel Machine, BabyAGI, and 20 more.

None of them implement all 5 patterns in production.

The closest is the Darwin Godel Machine (Sakana AI, 2025) — a research
prototype that rewrites its own code through evolutionary search. But it's
not a shipping product. And it famously cheated on its own benchmarks.

kbot is on npm. ~1,200 daily downloads. MIT licensed. 8 dependencies.

## The compound effect

Here's what happens when you run kbot daily for a month:

- Week 1: kbot learns your patterns. Routing gets faster.
- Week 2: You've forged 3-5 tools. They're available every session.
- Week 3: The bootstrap agent has run 20+ improvement cycles.
- Week 4: Your kbot is fundamentally different from a fresh install.

No two kbot installations are the same after a month. The capabilities
are the product of the user's history, not the source code.

That's autopoiesis. The system that makes itself.

## Try it

    npm i -g @kernel.chat/kbot
    kbot "hello"

No API key needed. Works offline. Gets smarter over time.

- GitHub: https://github.com/isaacsight/kernel
- npm: https://npmjs.com/package/@kernel.chat/kbot
- Discord: https://discord.gg/pYJn3hBqnz
```

---

## Awesome List PRs

| List | Status | Angle |
|------|--------|-------|
| awesome-cli-apps | TODO | Self-evolving terminal AI agent |
| awesome-nodejs | TODO | Runtime tool creation + forge registry |
| awesome-mcp-servers | TODO | kbot ide mcp |
| awesome-ai-tools | TODO | Only agent that creates its own tools |
| awesome-terminal | TODO | Autopoietic terminal agent |
| awesome-gamedev | TODO | 16 game dev tools |
| awesome-self-hosted | TODO | Runs offline with embedded llama.cpp |

---

## Timing Plan

1. **Day 1**: Deploy forge registry. Record demo showing forge_tool + forge_publish + forge_search flow.
2. **Day 2**: Post Show HN (Tuesday–Thursday morning ET)
3. **Day 2**: Post Twitter thread (same morning, link HN in final tweet)
4. **Day 3**: Publish dev.to blog post ("The only AI agent that builds its own tools")
5. **Day 3**: r/artificial post (autopoiesis angle — this audience will understand it)
6. **Day 4**: r/commandline + r/programming (practical angle)
7. **Day 5**: r/gamedev (game dev tools angle)
8. **Day 6-7**: Submit awesome list PRs (5-7 lists)
9. **Week 2**: Monitor, respond, iterate. Post forge registry stats if traction.

## Key Message

**Old story**: "290 tools, 20 providers, runs offline."
**New story**: "The only AI agent that builds its own tools."

One sentence. forge_tool is the demo. The registry is the moat. Autopoiesis is the science.

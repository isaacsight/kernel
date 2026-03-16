# K:BOT Launch Drafts — v2.22.0

Ready-to-post content for each channel. Updated 2026-03-15.

---

## 1. Hacker News — Show HN

**Title** (80 chars max):
```
Show HN: kbot – Terminal AI agent that learns your patterns. 22 specialists, runs offline
```

**Body** (post as first comment on your own submission):
```
Hi HN. I built kbot — an open-source terminal AI agent. MIT licensed, one
install: npm i -g @kernel.chat/kbot

I've been using Claude Code and Aider for months and kept hitting the same
walls: vendor lock-in, no memory between sessions, can't run offline, and
no way to bring my own API keys. So I built what I wanted.

What's different:

1. LEARNS YOUR PATTERNS — kbot extracts patterns from every conversation and
   routes future queries based on what worked. It gets better the more you
   use it. No other terminal agent does persistent cross-session learning.

2. 20 PROVIDERS, BRING YOUR OWN KEY — Claude, GPT, Gemini, Grok, DeepSeek,
   Groq, Mistral, Cohere, NVIDIA NIM, and 11 more. Swap providers without
   changing your workflow. Or run fully offline with embedded llama.cpp —
   no Ollama install needed.

3. 22 SPECIALIST AGENTS — auto-routed by intent. Say "fix the auth bug" and
   it picks the coder. Say "research quantum error correction" and it picks
   the researcher. Specialists: coder, researcher, writer, analyst, guardian
   (security), infrastructure (devops), quant, investigator, and more.

4. SELF-EVALUATING — responses get quality-scored on faithfulness and
   relevancy. Low score? Auto-retries with feedback. It also tracks its own
   confidence calibration and knows its skill boundaries (what it's good at
   vs. what it's bad at).

5. SELF-EVOLVING — kbot can diagnose weaknesses in its own source code,
   propose patches, validate with typecheck + tests, and apply or rollback.
   Protected files prevent self-destruction. Git stash for instant recovery.

6. ACADEMIC GROUNDING — the cognition layer implements 10 peer-reviewed
   frameworks: Friston's Free Energy Principle (explore vs exploit), Tononi's
   Integrated Information Theory (multi-agent synthesis quality), Clark's
   Predictive Processing (anticipates your next action), Hofstadter's Strange
   Loops (meta-cognition depth), Maturana & Varela's Autopoiesis
   (self-healing components). These aren't metaphors — they're running code.

7. IDE INTEGRATION — built-in MCP server (VS Code, Cursor, Zed, Neovim),
   ACP server (JetBrains), LSP bridge for self-correcting edits, and HTTP
   REST API for any client. Not terminal-only.

223 tools. Persistent memory. Sessions. Autonomous planner.
Audit any GitHub repo. Contribute to open source.
Pipe mode: kbot -p "generate migration" > migration.sql

3,500+ downloads and accelerating. Built solo.

GitHub: https://github.com/isaacsight/kernel
npm: https://www.npmjs.com/package/@kernel.chat/kbot
Web companion: https://kernel.chat
```

**When to post**: Tuesday 14:00-15:00 UTC (10am ET — highest Show HN engagement)

**Follow-up comment** (post 10 min after, for the technical crowd):
```
Technical deep-dive on the cognition layer, since I know HN appreciates
the details:

The agent loop isn't just "send message, get response." There are 10
always-on modules monitoring the agent's behavior:

- Free Energy (Friston, 2010): Computes surprise vs entropy to decide
  explore (reduce uncertainty) vs exploit (act on beliefs). Formula:
  F = avgSurprise * 0.7 + entropy * 0.3

- Integrated Information (Tononi, 2004): When multiple agents synthesize
  a response, Φ (phi) measures how much emergent information the whole
  produces beyond its parts. Low Φ = agents are just concatenating.
  High Φ = genuine synthesis.

- Predictive Processing (Clark, 2013): Predicts what you'll ask next
  based on 6 conversation patterns (iterative_refinement, drill_down,
  verification, topic_switch, follow_up, meta_question). Pre-loads
  context for predicted tools. Measures prediction error to find blind
  spots.

- Autopoiesis (Maturana & Varela, 1972): 11 registered components
  (providers, tools, memory, connections) each with criticality scores
  and fallback chains. If viability drops below 0.4, the agent signals
  for help instead of continuing degraded.

- Strange Loops (Hofstadter, 1979): Tracks meta-cognitive depth (0=task,
  1=reasoning, 2=meta-reasoning, 3=self-model). If stuck in self-reference
  spirals, injects a grounding prompt to return to concrete action.

All of these are in the source:
- packages/kbot/src/free-energy.ts
- packages/kbot/src/integrated-information.ts
- packages/kbot/src/predictive-processing.ts
- packages/kbot/src/autopoiesis.ts
- packages/kbot/src/strange-loops.ts

Happy to answer questions about any of these.
```

---

## 2. Reddit — r/commandline

**Title**:
```
kbot — open-source terminal AI agent that learns your patterns. 22 specialists, 20 providers, runs offline with embedded llama.cpp
```

**Body**:
```
Been building kbot for a while. It's a terminal AI agent that picks the
right specialist for your task and has a learning engine that remembers
what worked.

What I think r/commandline would appreciate:

- Pipe mode: `kbot -p "generate a user roles migration" > migration.sql`
- Composable with any Unix pipeline
- NO_COLOR support, stdout for content, stderr for status (follows clig.dev)
- One-shot: `kbot "fix the auth bug"` — runs and exits
- Interactive REPL with readline, history, slash commands
- 20 providers or fully offline with embedded llama.cpp (no Ollama needed)
- Sessions: save, resume, export to markdown
- Audit any repo: `kbot audit owner/repo` — 6-category scored report

Install: `npm i -g @kernel.chat/kbot`

MIT licensed. GitHub: https://github.com/isaacsight/kernel

Would love feedback from people who live in the terminal.
```

---

## 3. Reddit — r/LocalLLaMA

**Title**:
```
Built a terminal AI agent with embedded llama.cpp — no Ollama needed, 22 specialists, 223 tools, $0
```

**Body**:
```
kbot is a terminal AI agent that bundles node-llama-cpp and runs GGUF
models directly. No Ollama install, no LM Studio, no external dependencies.

`kbot local` auto-detects your models. The agent loop is the same whether
you're running Claude Sonnet or llama3.1:8b — 22 specialist agents, 223
tools, learning engine, autonomous planner.

It also supports Ollama and LM Studio if you prefer those.

What's unique for the local crowd:
- Embedded inference: node-llama-cpp, runs GGUF directly
- Hybrid routing: simple tasks → local ($0), complex → cloud (if configured)
- Learning engine works offline — patterns stored in ~/.kbot/memory/
- Self-evaluation scores responses locally, retries if low quality
- Provider fallback chain: embedded → Ollama → LM Studio → cloud APIs

Tested with: llama3.1:8b, gemma3:12b, qwen2.5-coder:14b,
deepseek-r1:14b, phi4:14b, mistral:7b

Install: `npm i -g @kernel.chat/kbot && kbot local`

MIT: https://github.com/isaacsight/kernel
```

---

## 4. Reddit — r/programming

**Title**:
```
I built a terminal AI agent grounded in 10 peer-reviewed cognitive science papers — here's what I learned
```

**Body**:
```
kbot is an open-source terminal AI agent (MIT, npm i -g @kernel.chat/kbot).
The interesting part isn't the chat — it's the cognition layer.

Instead of "send prompt, get response," kbot runs 10 always-on modules
based on actual academic research:

1. Free Energy Principle (Friston, 2010) — decides explore vs exploit
2. Integrated Information Theory (Tononi, 2004) — measures multi-agent
   synthesis quality (Φ)
3. Predictive Processing (Clark, 2013) — anticipates your next action
4. Autopoiesis (Maturana & Varela, 1972) — self-healing component monitoring
5. Strange Loops (Hofstadter, 1979) — meta-cognition depth tracking
6. Error Correction (Gates, 2023) — reality-checking outputs
7. Entropy Context (Vopson, 2022) — information decay detection
8. Gödel Limits (Gödel/UBC) — knows what it can't know
9. Simulation (Wolpert, 2008) — self-simulation boundaries
10. Emergent Swarm (Project Sid, 2024) — collective intelligence

Each one is a TypeScript module with the paper citation in the header.
They're not metaphors — they produce real signals that affect routing,
retry decisions, and tool selection.

The self-evolution module is the wildest part: kbot can diagnose weaknesses
in its own source code, propose patches, validate with typecheck + tests,
and apply or rollback automatically.

Interested in the architecture? All source is at:
https://github.com/isaacsight/kernel/tree/main/packages/kbot/src

GitHub: https://github.com/isaacsight/kernel
```

---

## 5. Dev.to Article

**Title**: "I built a self-evolving terminal AI agent grounded in cognitive science — here's the architecture"

**Tags**: #opensource #ai #cli #cognitiveScience

**Outline**:
1. Problem: every AI agent is a chatbot wrapper (send prompt, get text)
2. What if we treated the agent as a cognitive system?
3. The 10 academic modules — what they are and what they do in code
4. Self-evaluation: faithfulness × relevancy scoring
5. Self-evolution: diagnose → propose → validate → apply → rollback
6. 22 specialists with learned routing
7. Demo: terminal recording showing learning in action
8. Comparison: what Claude Code/Cursor/Aider don't do
9. 3,500+ downloads, MIT, solo dev
10. Try it: `npm i -g @kernel.chat/kbot`

---

## 6. Twitter/X Thread

```
I built kbot — a terminal AI agent that learns your patterns.

22 specialists. 223 tools. 20 providers. Runs offline.

npm i -g @kernel.chat/kbot

Here's what makes it different 🧵
```

```
1/ IT LEARNS

kbot extracts patterns from every conversation.

Next time you ask something similar, it routes faster, picks better tools,
and skips mistakes it made before.

No other terminal agent does cross-session learning.
```

```
2/ 20 PROVIDERS, YOUR KEYS

Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, NVIDIA NIM...

Or fully offline with embedded llama.cpp. No Ollama install.

Switch providers without changing your workflow.
```

```
3/ COGNITIVE ARCHITECTURE

10 always-on modules based on peer-reviewed papers:

- Friston's Free Energy → explore vs exploit
- Tononi's IIT → multi-agent synthesis quality
- Clark's Predictive Processing → anticipates your next action
- Hofstadter's Strange Loops → meta-cognition depth

Not metaphors. Running code with paper citations.
```

```
4/ SELF-EVOLVING

kbot can:
- Diagnose weaknesses in its own source
- Propose patches
- Validate with typecheck + tests
- Apply or rollback

Protected files prevent self-destruction. Git stash for recovery.
```

```
5/ SELF-EVALUATING

Every response scored on faithfulness + relevancy.

Low score? Auto-retries with feedback injection.

Tracks its own confidence calibration — knows what it's good at
and what it's bad at.
```

```
6/ IDE INTEGRATION

MCP server → VS Code, Cursor, Zed, Neovim
ACP server → JetBrains
LSP bridge → self-correcting type errors
HTTP REST → any client

Not terminal-only.
```

```
3,500+ downloads. MIT licensed. Built solo.

GitHub: github.com/isaacsight/kernel
npm: npmjs.com/package/@kernel.chat/kbot
Web: kernel.chat
Discord: discord.gg/pYJn3hBqnz

Try it: npx @kernel.chat/kbot
```

---

## Posting Schedule

| Day | Channel | Time (UTC) | Why |
|-----|---------|------------|-----|
| Tue | Show HN | 14:00 | Highest HN engagement window |
| Tue | Twitter/X thread | 14:30 | Cross-promote with HN |
| Tue | GitHub Discussion | 14:00 | Announcement for stargazers |
| Wed | r/commandline | 15:00 | CLI-focused audience |
| Wed | r/LocalLLaMA | 16:00 | Local-first crowd |
| Thu | r/programming | 14:00 | Architecture/academic angle |
| Fri | Dev.to article | 14:00 | Long-form for SEO |
| Fri | r/artificial | 15:00 | AI audience |

Spread across days to avoid looking spammy and to catch different audiences.

---

## Key Lessons from HN Research (March 2026)

What works on Show HN:
- **Lead with the demo, not features** — terminal recording > bullet list
- **Honest numbers** — "3,500 downloads" beats "growing fast"
- **Solo dev narrative** — HN loves one-person projects
- **Technical depth in comments** — post the architecture comment 10 min after
- **Don't compare directly** — "what's different" > "better than X"

What to avoid:
- No "revolutionary" or "game-changing"
- Don't lead with agent/tool count (reads as marketing)
- Don't post on weekends
- Don't use emojis in HN title

What HN developers want (from research):
- Hybrid local/cloud without friction ← kbot has this
- No vendor lock-in ← kbot has 20 providers
- Session memory ← kbot has learning engine
- Self-hosting ← kbot is fully local, MIT
- Mid-tier pricing ← kbot is $0 (BYOK)

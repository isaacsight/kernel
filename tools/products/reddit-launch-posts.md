# Reddit Launch Posts — Ready to Paste

All 6 posts ready to submit. Wait 24-48 hours between posts to avoid spam filters.

---

## Post 1: r/commandline

**Title:** I built a terminal AI agent with 17 specialists that runs on Ollama

**Body:**

I've been working on K:BOT, a CLI tool that gives you 17 specialist AI agents directly in your terminal. Each agent has a tuned system prompt for its domain — coding, research, writing, analysis, security, etc.

The idea: instead of copy-pasting prompts into a web UI, you work where you already are.

```
npx kbot                          # interactive mode
kbot "explain this error" --agent coder  # one-shot
kbot --agent researcher "compare REST vs GraphQL"
```

What makes it different from just piping to an API:

- Agent routing picks the right specialist based on your question
- It reads your project context (git, package.json, directory structure) and injects it into prompts
- Session persistence — save/resume conversations
- Runs fully local on Ollama (13 providers total if you want cloud)
- Custom agent creation for domain-specific tasks

MIT licensed, built with TypeScript + Commander. Would love feedback from the command-line crowd — what would make this actually useful in your daily workflow?

Repo: github.com/isaacsight/kernel/tree/main/packages/kbot

---

## Post 2: r/opensource

**Title:** K:BOT — open source terminal AI with 17 specialist agents (MIT license)

**Body:**

Sharing a project I've been building: K:BOT is a terminal AI agent that routes your questions to the right specialist — researcher, coder, writer, analyst, and 13 more.

It's fully open source under the MIT license. The core idea is that different tasks need different system prompts and model configurations, and a single "assistant" prompt doesn't cut it.

Key technical decisions:

- TypeScript + Commander for the CLI
- MCP server support (works as a VS Code/Cursor/JetBrains extension too)
- 13 LLM provider backends including Ollama for fully local inference
- Plugin system for community extensions
- Permission system for destructive operations (inspired by Claude Code)

Install: `npx kbot`
Repo: github.com/isaacsight/kernel

Part of the larger Kernel ecosystem (kernel.chat) but the CLI is standalone and works independently.

I'm particularly interested in what the open-source community thinks about the agent architecture. Is the 17-specialist approach useful, or would fewer, more general agents be better? What would you want from a tool like this?

---

## Post 3: r/LocalLLaMA

**Title:** Built a CLI agent that auto-routes between your Ollama models based on task type

**Body:**

I got tired of manually switching between models depending on what I needed. So I built K:BOT — a terminal agent that auto-detects your installed Ollama models and picks the right one per task:

- Coding questions → qwen2.5-coder
- Reasoning/math → phi4
- General → llama3.1
- Vision → llava

Setup:

```
npx kbot
/ollama
```

That's it. It scans your models and configures itself.

Beyond model routing, it has 17 specialist agents with tuned system prompts, session persistence, custom agent creation, and a learning system that caches patterns to reduce token usage over time.

It also supports 12 other providers (Anthropic, OpenAI, Gemini, Mistral, etc.) so you can mix local and cloud. But the local-first path is a first-class citizen.

MIT licensed: github.com/isaacsight/kernel

Currently using it as my daily driver for coding tasks. The combo of qwen2.5-coder:32b + the coder agent system prompt is surprisingly competitive with cloud models for most tasks.

Anyone else building agent layers on top of Ollama? Curious what approaches others are taking.

---

## Post 4: r/ChatGPT

**Title:** Open source alternative: 17 AI agents in your terminal, runs locally for free

**Body:**

I built K:BOT as an alternative for developers who want more control over their AI workflow.

The main differences from ChatGPT:

1. Runs in your terminal — no browser, no web UI needed
2. 17 specialist agents, each with domain-specific expertise
3. Can run fully local on Ollama (Llama, Qwen, Mistral, etc.) — zero cost
4. Reads your project context automatically
5. Session save/resume
6. MIT open source — you own the code

It also connects to Claude, GPT-4, Gemini, and 10 other providers if you want cloud models. But the point is choice — use the best model for each task, don't be locked into one provider.

Install: `npx kbot`
Docs: kernel.chat

Fair comparison: ChatGPT is better for general conversation and has a polish K:BOT doesn't. K:BOT is better if you're a developer who wants to work in the terminal, needs privacy, or doesn't want to pay monthly for coding assistance.

What would make you actually switch from ChatGPT for coding tasks? Genuinely curious what the dealbreakers are.

---

## Post 5: r/SideProject

**Title:** 6 months building an open-source terminal AI agent — here's what I learned

**Body:**

Started K:BOT as a weekend project to scratch my own itch: I wanted AI agents in my terminal, not a browser tab.

6 months later:

- 17 specialist agents with domain-specific system prompts
- 13 LLM provider backends (including fully local via Ollama)
- MCP server for IDE integration
- Plugin system for community extensions
- Session persistence, custom agents, learning system
- MIT licensed, open source

What I got right:
- Building for myself first. I use K:BOT daily for actual work.
- Agent routing > single assistant. Different tasks genuinely benefit from different system prompts.
- Local-first is a real differentiator. People care about privacy more than I expected.

What I got wrong:
- Scope. Started with 5 agents, now at 17. Feature creep is real.
- Spent too long on architecture before shipping. Should have put it out earlier and iterated.

Part of the larger Kernel platform (kernel.chat) which has a web UI and Pro tier, but K:BOT itself is free and standalone.

Install: `npx kbot`
Repo: github.com/isaacsight/kernel

For other side project builders — how do you decide when to stop adding features and start marketing?

---

## Post 6: r/artificial

**Title:** Designing a 17-agent specialist system for terminal AI — architecture and lessons

**Body:**

I've been working on K:BOT, an open-source terminal AI with a multi-agent architecture. Wanted to share the design decisions and hear from others building agent systems.

The architecture:

1. AgentRouter (Haiku-based) classifies user intent and routes to the right specialist
2. 17 agents, each with a tuned system prompt: kernel, researcher, coder, writer, analyst, aesthete, guardian, curator, strategist, and 8 more
3. When confidence is high (>0.7), routes directly. When lower, can trigger a swarm of 2-4 agents working in parallel.
4. Matrix system lets users create custom agents on the fly
5. Learning engine caches patterns and solutions to reduce token usage over time
6. Supports 13 LLM backends, including fully local inference via Ollama

Key design decisions:
- Specialist prompts over general prompts: a 500-word coding system prompt consistently outperforms "you are a helpful assistant" for code tasks
- Routing overhead is worth it: Haiku classification adds ~200ms but significantly improves response quality
- Local-first: privacy and cost matter more than marginal quality differences for most tasks

MIT licensed: github.com/isaacsight/kernel

For others working on agent architectures — do you find specialist routing worth the complexity? And how do you handle the balance between agent count and maintenance burden?

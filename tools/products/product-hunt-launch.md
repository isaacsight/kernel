# Product Hunt Launch Plan — K:BOT

## Listing Copy

**Tagline (60 chars):**
17 AI agents in your terminal. Open source. Runs locally.

**Short Description (260 chars):**
K:BOT is an open-source terminal AI with 17 specialist agents. Connects to Claude, GPT, Gemini, Mistral, or runs fully local on Ollama. Auto-routes to the right specialist. Reads your project context. MIT licensed.

**Full Description:**

K:BOT puts 17 specialist AI agents in your terminal.

Instead of one generic AI assistant, K:BOT routes your questions to domain-specific specialists — a coder agent for programming, a researcher agent for analysis, a writer for content, an analyst for strategy, and 13 more. Each agent has a carefully tuned system prompt for its domain.

It connects to 13 LLM providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA NIM, and Ollama for fully local inference. Use cloud when you need it, local when you don't. Your choice.

What makes K:BOT different:

Context-aware. It reads your project structure, git history, and package configuration. Every prompt is enriched with relevant context before hitting the model.

Agent routing. A lightweight classifier analyzes your question and picks the right specialist. Coding question? Coder agent. Research request? Researcher agent. It adds ~200ms but significantly improves response quality.

Local-first. Run `npx kbot` then `/ollama`. K:BOT auto-detects your installed models and picks the best one per task type. Zero cost. Zero data leaving your machine.

Extensible. Create custom agents with `/matrix create`. Install community plugins from `~/.kbot/plugins/`. Connect to external MCP servers for databases, APIs, and more.

Built by kernel.chat group. Part of the Kernel ecosystem (kernel.chat). MIT licensed.

**3 Key Features:**

1. **17 Specialist Agents** — Coder, researcher, writer, analyst, and 13 more. Each with domain-tuned prompts. Auto-routing picks the right specialist for each question.

2. **13 LLM Providers + Local** — Claude, GPT, Gemini, Mistral, Ollama, and 8 more. Mix local and cloud models. Switch providers in one command.

3. **Context-Aware + Extensible** — Reads your project structure automatically. Custom agents, plugins, MCP server support, IDE integration (VS Code, JetBrains, Neovim).

**Maker Comment (first comment):**

I built K:BOT because I was tired of context-switching between my terminal and a browser tab for AI. Different tasks need different prompts, and a single "helpful assistant" system prompt doesn't cut it.

The routing system was the key insight: a lightweight classifier that picks the right specialist adds ~200ms but measurably improves output quality. The coder agent with a 500-word system prompt consistently outperforms the same model with a generic prompt.

The local-first path is a first-class citizen. `npx kbot` + `/ollama` gives you 17 agents running on your own hardware. Zero API cost, full privacy.

I use K:BOT daily for actual engineering work. It's the primary way I interact with AI for coding, research, and writing.

Would love to hear what the PH community thinks — especially around the agent routing approach. Is 17 agents the right number, or would fewer be better? What would make you switch from your current AI workflow?

---

## Launch Strategy

**Best day:** Tuesday or Wednesday
**Best time:** 12:01 AM PT (Product Hunt resets daily at midnight Pacific)
**Prep:** Have 10-15 people ready to upvote and comment genuinely in the first 2 hours

**Pre-launch checklist:**
- [ ] Product Hunt listing fully complete (all fields, description, features)
- [ ] 3 screenshots/GIFs uploaded (see below)
- [ ] Maker profile complete with headshot and bio
- [ ] README on GitHub polished with GIF demo at top
- [ ] kernel.chat landing page updated with PH badge
- [ ] Social posts drafted for launch day
- [ ] Email list notified (The AI Signal newsletter)
- [ ] 10-15 supporters briefed (friends, community members)

**Gallery — 3 screenshots/GIFs to prepare:**

1. **Hero GIF:** Terminal recording showing: kbot starts → banner appears → user asks a coding question → coder agent responds with quality code → user switches to researcher agent → different specialist responds. 15-20 seconds, smooth, no typos.

2. **Agent Overview:** Clean screenshot of K:BOT's agent list or the `/help` output showing all 17 agents with their icons and descriptions.

3. **Ollama Integration:** Terminal recording showing: `/ollama` → K:BOT detects models → user asks a question → response from local model. Show the "provider: ollama, model: qwen2.5-coder" badge to emphasize it's fully local.

---

## Launch Day Notifications

**X (Twitter):**
```
K:BOT is live on Product Hunt.

17 AI agents in your terminal. 13 providers. Runs locally on Ollama.

Open source, MIT licensed.

[Product Hunt link]
```

**Reddit r/opensource:**
```
K:BOT is now on Product Hunt — open source terminal AI with 17 specialist agents. Would appreciate your feedback. [PH link]
```

**Discord servers (AI/dev communities):**
```
Launched K:BOT on Product Hunt today — it's an open-source terminal AI with 17 specialist agents and local-first support via Ollama. MIT licensed. Would love feedback from this community. [PH link]
```

**The AI Signal newsletter:**
```
Special edition: K:BOT just launched on Product Hunt. If you've been using it (or curious about it), your upvote and honest feedback would mean a lot. Here's the link: [PH link]
```

**Hacker News:**
```
Show HN: K:BOT — 17 AI agents in your terminal, runs locally on Ollama (MIT)
```
Post link to GitHub repo, not Product Hunt. HN prefers source code over marketing pages.

# The Local AI Setup Guide

**Run AI on Your Own Machine. No Cloud. No API Keys. No Monthly Bills.**

*By K:BOT / kernel.chat*

---

## Chapter 1: Why Local AI?

The cloud AI model is simple: you send your data to someone else's server, they process it, you pay monthly. Local AI flips that. The model runs on your hardware. Your prompts never leave your machine.

**Privacy.** Every prompt you send to ChatGPT or Claude is processed on their servers. That includes your code, your company's proprietary logic, your half-baked ideas. Local models run entirely on your machine. Nothing leaves.

**Cost.** ChatGPT Plus is $20/month. Claude Pro is $20/month. Copilot is $19/month. That's $700+/year for one person. Local AI costs $0/month after the initial hardware you already own.

**Speed.** No network round-trip. A 7B model on Apple Silicon generates tokens in ~30ms. That's faster than most cloud API responses.

**Offline.** Airplane, coffee shop with bad wifi, underground bunker — doesn't matter. Your AI works everywhere your laptop goes.

**Control.** No content filters you didn't choose. No usage limits. No API rate limits. No surprise pricing changes. Your models, your rules.

---

## Chapter 2: Hardware — What Can You Actually Run?

The main constraint is RAM. Models need to fit in memory. Here's the real-world breakdown:

| Model Size | RAM Needed | Example Hardware | Quality Level |
|-----------|-----------|-----------------|--------------|
| 1-3B | 4-6 GB | Any modern laptop | Basic — autocomplete, simple Q&A |
| 7-8B | 8-10 GB | MacBook Air M1 16GB, any 16GB laptop | Good — coding, writing, analysis |
| 13-14B | 16-20 GB | MacBook Pro M2 32GB, PC with 32GB | Great — approaching GPT-3.5 quality |
| 32-34B | 24-36 GB | MacBook Pro M3 36GB, PC with RTX 4090 | Excellent — competitive with GPT-4 |
| 70B | 48-64 GB | Mac Studio M2 Ultra 64GB, dual GPU PC | Outstanding — near frontier quality |

**Apple Silicon is the sweet spot.** M1/M2/M3 chips use unified memory — the same RAM serves both CPU and GPU. A $1,300 MacBook Air M2 with 24GB RAM comfortably runs 13B models. Nothing else in that price range comes close for local AI.

**NVIDIA GPUs** excel at throughput. An RTX 4090 (24GB VRAM) runs 13B models at ~80 tokens/sec. But you need a desktop.

**CPU-only** works for 7B models. Slower (~10-15 tokens/sec) but functional. Any laptop made after 2020 can do it.

**The honest take:** If you have a Mac with 16GB+ RAM or a PC with an NVIDIA GPU, you're set. If you have 8GB RAM, stick to 1-3B models — they're still useful for code completion and simple tasks.

---

## Chapter 3: Installing Ollama

Ollama is the runtime. It downloads, manages, and serves models with one command. Think of it as Docker for AI models.

### macOS

```bash
# Option 1: Homebrew
brew install ollama

# Option 2: Direct download
# Visit ollama.com and download the .dmg
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows

Download the installer from [ollama.com](https://ollama.com). Run it. Done.

### Verify It Works

```bash
ollama --version
# Expected: ollama version 0.x.x
```

### Pull Your First Model

```bash
# This downloads ~4.7GB — takes a few minutes on fast internet
ollama pull llama3.1

# Run it
ollama run llama3.1
```

You're now chatting with a local AI. Type a message, get a response. No account, no API key, no credit card.

To exit: type `/bye` or Ctrl+C.

---

## Chapter 4: The Model Guide

Not all models are equal. Here's what actually matters:

### General Purpose (Best All-Rounders)

| Model | Size | Pull Command | Best For |
|-------|------|-------------|----------|
| `llama3.1:8b` | 4.7 GB | `ollama pull llama3.1` | General chat, writing, analysis |
| `llama3.1:70b` | 40 GB | `ollama pull llama3.1:70b` | Near-frontier quality everything |
| `gemma2:9b` | 5.4 GB | `ollama pull gemma2:9b` | Fast, good at following instructions |
| `phi4` | 8.4 GB | `ollama pull phi4` | Reasoning, math, logic |
| `mistral:7b` | 4.1 GB | `ollama pull mistral` | Fast general purpose |

### Coding Models

| Model | Size | Pull Command | Best For |
|-------|------|-------------|----------|
| `qwen2.5-coder:7b` | 4.7 GB | `ollama pull qwen2.5-coder` | Code generation, debugging |
| `qwen2.5-coder:32b` | 20 GB | `ollama pull qwen2.5-coder:32b` | Best local coding model |
| `deepseek-coder-v2` | 8.9 GB | `ollama pull deepseek-coder-v2` | Code + reasoning |
| `codellama:13b` | 7.4 GB | `ollama pull codellama:13b` | Code completion |

### Specialized

| Model | Size | Pull Command | Best For |
|-------|------|-------------|----------|
| `llava:13b` | 8.0 GB | `ollama pull llava:13b` | Vision — describe images, read screenshots |
| `nomic-embed-text` | 274 MB | `ollama pull nomic-embed-text` | Text embeddings for search/RAG |
| `dolphin-mixtral` | 26 GB | `ollama pull dolphin-mixtral` | Uncensored general purpose |

### The Cheat Sheet

- **Just starting out?** Pull `llama3.1` and `qwen2.5-coder`. That covers 90% of use cases.
- **Writing code?** `qwen2.5-coder:7b` is the best bang for RAM.
- **Need quality?** Go as large as your RAM allows. 32B models are a significant jump over 7B.
- **Building RAG?** You need `nomic-embed-text` for embeddings plus a chat model.

---

## Chapter 5: K:BOT — 17 AI Agents in Your Terminal

K:BOT wraps your local models (and cloud models if you want) in a powerful agent system.

### Install

```bash
npx kbot
```

### Connect to Ollama

```bash
# Inside K:BOT:
/ollama

# K:BOT auto-detects your installed models and picks the best one per task
```

### Use Specialist Agents

```bash
# One-shot mode
kbot "explain this error" --agent coder
kbot "research quantum computing" --agent researcher
kbot "write a blog post about local AI" --agent writer

# Interactive mode — just run kbot and chat
kbot
```

K:BOT has 17 agents: kernel (general), researcher, coder, writer, analyst, aesthete, guardian, curator, strategist, and 8 more. Each has a specialized system prompt tuned for its domain.

### Create Custom Agents

```bash
# Inside K:BOT:
/matrix create security-auditor "You are a security expert who reviews code for vulnerabilities"
```

### Save & Resume Sessions

```bash
/save my-project-debug
# ... come back later ...
/resume my-project-debug
```

### Why K:BOT + Ollama?

Ollama gives you the model. K:BOT gives you the brain on top — agent routing, memory, context gathering, tool use, session persistence. It reads your project structure, understands your git history, and injects relevant context into every prompt.

**Cost of this entire setup: $0.**

---

## Chapter 6: Open WebUI — A Visual Interface

If you prefer a ChatGPT-like UI over the terminal:

```bash
docker run -d -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v open-webui:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

Open `http://localhost:3000`. It auto-detects your Ollama models. You get conversation history, model switching, file uploads, and a clean interface.

---

## Chapter 7: Using Local AI in Your Code

Ollama exposes a REST API at `http://localhost:11434`. You can hit it from any language.

### Python

```python
import requests

response = requests.post("http://localhost:11434/api/generate", json={
    "model": "llama3.1",
    "prompt": "Write a Python function to check if a string is a palindrome",
    "stream": False
})

print(response.json()["response"])
```

### TypeScript / Node.js

```typescript
const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder",
    prompt: "Write a TypeScript function to debounce any function",
    stream: false,
  }),
})

const data = await response.json()
console.log(data.response)
```

### Chat API (Multi-Turn)

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.1",
  "messages": [
    {"role": "system", "content": "You are a senior TypeScript developer."},
    {"role": "user", "content": "Review this code for bugs: ..."}
  ],
  "stream": false
}'
```

### IDE Integration

- **VS Code:** Install the "Continue" extension. Point it at `http://localhost:11434`. Free Copilot alternative.
- **Cursor / Windsurf:** Both support Ollama as a custom provider in settings.
- **Neovim:** Use `ollama.nvim` or configure through K:BOT's MCP server.
- **JetBrains:** K:BOT has an ACP server for IntelliJ, WebStorm, PyCharm, and GoLand.

---

## Chapter 8: Advanced Setup

### Running Multiple Models

Ollama serves multiple models simultaneously. Just call different model names:

```bash
# Terminal 1: chatting with llama
ollama run llama3.1

# Terminal 2: coding with qwen (Ollama handles both)
ollama run qwen2.5-coder
```

### Custom Modelfiles

Bake a system prompt into a model:

```dockerfile
# Save as Modelfile
FROM llama3.1
SYSTEM "You are a senior security engineer. Review all code for OWASP Top 10 vulnerabilities. Be thorough and specific."
PARAMETER temperature 0.3
```

```bash
ollama create security-reviewer -f Modelfile
ollama run security-reviewer
```

### RAG with Local Embeddings

```bash
# Pull the embedding model
ollama pull nomic-embed-text

# Generate embeddings via API
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "Your text to embed"
}'
```

Store vectors in SQLite (via `sqlite-vss`), Chroma, or Qdrant. Query with cosine similarity. Feed top results into your chat model as context. Full RAG pipeline, entirely local.

---

## Chapter 9: The $0 AI Stack

Here's the complete setup. Total cost: your existing hardware.

| Layer | Tool | Cost | Purpose |
|-------|------|------|---------|
| Runtime | Ollama | Free | Download and serve models |
| Terminal Agent | K:BOT | Free | 17 specialist agents, memory, tools |
| Visual UI | Open WebUI | Free | ChatGPT-like interface |
| IDE Integration | Continue (VS Code) | Free | Code completion and chat |
| Embeddings | nomic-embed-text | Free | Semantic search / RAG |
| Code Model | qwen2.5-coder | Free | Best local coding model |
| General Model | llama3.1 | Free | All-purpose chat and analysis |

### vs. Paid Alternatives

| Feature | $0 Local Stack | ChatGPT Plus ($20/mo) | Claude Pro ($20/mo) |
|---------|---------------|----------------------|-------------------|
| Monthly cost | $0 | $240/year | $240/year |
| Privacy | Complete | Data on OpenAI servers | Data on Anthropic servers |
| Offline | Yes | No | No |
| Rate limits | None | Yes | Yes |
| Custom models | Yes | No | No |
| Code quality | Good (32B) to Great (70B) | Great | Great |
| General quality | Good (7B) to Excellent (70B) | Excellent | Excellent |

**The honest comparison:** Cloud models (GPT-4, Claude Sonnet) are still better than 7-13B local models for complex reasoning. But 32B+ local models are competitive for most daily tasks. And for coding, `qwen2.5-coder:32b` is remarkably close to cloud models.

The real advantage isn't quality — it's ownership. No vendor lock-in, no surprise price hikes, no content policies you didn't agree to. Your AI, your rules, forever.

---

*Built with K:BOT. Try it: `npx kbot`*
*More at kernel.chat*

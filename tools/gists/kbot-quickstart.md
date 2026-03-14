# K:BOT Quick Start

> Open-source terminal AI agent. 39 specialists, 167 tools, 19 providers.
> Self-evolving, learns your patterns, runs offline with Ollama.

**GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel) |
**Web**: [kernel.chat](https://kernel.chat) |
**npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)

---

## Install

```bash
npm install -g @kernel.chat/kbot
```

Or use the one-line installer:

```bash
curl -fsSL https://kernel.chat/install.sh | sh
```

Requires **Node.js 20+**. Verify your install:

```bash
kbot doctor
```

## Configure

Add your API key (supports Anthropic, OpenAI, Google, Mistral, and 15 more):

```bash
kbot auth
```

Or run fully local with Ollama -- no API key, $0 cost, fully private:

```bash
kbot local
```

## Usage

### Interactive mode (REPL)

```bash
kbot
```

Start a conversation. K:BOT remembers context, learns your patterns, and picks
the right specialist automatically.

### One-shot mode

```bash
kbot "fix the auth bug in src/auth.ts"
```

Give it a task and get a result. Pipe-friendly with `--pipe`:

```bash
kbot --pipe "explain this error" < error.log
```

### Specialist agents

Force a specific agent when you know what you need:

```bash
# Deep research with citations
kbot --agent researcher "compare React vs Svelte for a new project"

# Code generation and review
kbot --agent coder "write a rate limiter middleware in Express"

# Security audit
kbot --agent guardian "audit this repo for vulnerabilities"

# Content creation
kbot --agent writer "draft release notes for v2.13"

# Data analysis
kbot --agent analyst "analyze the performance regression in our CI data"
```

See all 39 specialists:

```bash
kbot agents
```

### Extended thinking

See the AI's reasoning process:

```bash
kbot --thinking "design a migration strategy for our Postgres schema"
```

Control the thinking budget:

```bash
kbot --thinking --thinking-budget 20000 "architect a distributed queue system"
```

### Architect mode

Dual-agent plan-then-implement workflow:

```bash
kbot --architect "refactor the payment module to support subscriptions"
```

### Sessions

Save and resume conversations:

```bash
# Resume last session
kbot --resume

# Resume a specific session
kbot --resume my-project

# Export a session
kbot export my-project --format md --output notes.md
```

### HTTP server mode

Expose all 167 tools as an HTTP API:

```bash
kbot serve --port 7437 --token my-secret
```

### Self-evolution

K:BOT can diagnose its own weaknesses and improve its source code:

```bash
# In the REPL, type:
/evolve diagnose
/evolve
```

### Pipe and scripting

```bash
# JSON output for scripting
kbot --json "list all TODO comments in this repo"

# Pipe mode -- raw text, no banners
kbot --pipe "summarize this file" < README.md

# Skip confirmations in CI
kbot --yes "run the test suite and fix any failures"

# Quiet mode
kbot --quiet "lint and format src/"
```

### IDE integration

Use K:BOT as an MCP server in VS Code, Cursor, Windsurf, or Zed:

```bash
kbot ide mcp
```

Or as an ACP server for JetBrains IDEs:

```bash
kbot ide acp
```

---

## All commands

| Command | Description |
|---------|-------------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot mode |
| `kbot auth` | Configure API keys |
| `kbot local` | Use local models (Ollama) |
| `kbot doctor` | Diagnose setup |
| `kbot agents` | List all specialists |
| `kbot serve` | HTTP server mode |
| `kbot ide mcp` | MCP server for editors |
| `kbot ide acp` | ACP server for JetBrains |
| `kbot update` | Self-update |
| `kbot watch` | Watch files for changes |
| `kbot voice` | Voice mode with TTS |
| `kbot export` | Export session |
| `kbot plugins` | Manage plugins |
| `kbot changelog` | Generate changelog |
| `kbot cloud` | Cloud sync settings |

## All flags

| Flag | Short | Description |
|------|-------|-------------|
| `--agent <name>` | `-a` | Force a specific specialist agent |
| `--model <model>` | `-m` | Override AI model (auto, sonnet, haiku) |
| `--stream` | `-s` | Stream the response |
| `--pipe` | `-p` | Raw text output for scripting |
| `--json` | | JSON output for scripting |
| `--yes` | `-y` | Skip all confirmation prompts |
| `--quiet` | `-q` | Minimal output |
| `--resume [session]` | | Resume a saved session |
| `--thinking` | `-t` | Show AI reasoning steps |
| `--thinking-budget <n>` | | Thinking token budget (default: 10000) |
| `--self-eval` | | Self-evaluation loop |
| `--architect` | | Dual-agent plan-review-implement |
| `--computer-use` | | Enable computer use tools |
| `--safe` | | Confirm destructive operations |
| `--strict` | | Confirm ALL operations |

---

MIT License -- [kernel.chat group](https://kernel.chat)

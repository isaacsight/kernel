<p align="center">
  <strong>kbot</strong><br>
  The AI agent that builds its own tools and defends itself. 41 agents, 384+ tools, 20 providers. Finance, cybersecurity, and self-defense stack. Always-on daemon. Runs offline.
</p>

<p align="center">
  <img src="tools/video-assets/demo.gif" alt="kbot demo" width="700">
</p>

<p align="center">
  <a href="https://github.com/isaacsight/kernel/actions/workflows/ci.yml"><img src="https://github.com/isaacsight/kernel/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://kernel.chat"><img src="https://img.shields.io/badge/web-kernel.chat-6B5B95" alt="kernel.chat"></a>
  <a href="https://discord.gg/kdMauM9abG"><img src="https://img.shields.io/badge/discord-join-6B5B95?logo=discord&logoColor=white" alt="Discord"></a>
</p>

```bash
npm install -g @kernel.chat/kbot
```

## Why kbot?

Most terminal AI agents lock you into one provider, one model, one way of working. kbot doesn't.

- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, SambaNova, Cerebras, OpenRouter, and more. Switch with one command.
- **Runs fully offline** — Embedded llama.cpp, Ollama, LM Studio, or Jan. $0, fully private.
- **Learns your patterns** — Bayesian skill ratings + pattern extraction. Gets faster over time.
- **41 specialist agents** — auto-routes your request to the right expert (coder, researcher, guardian, finance, and 37 more).
- **384+ tools** — files, bash, git, GitHub, web search, deploy, database, game dev, VFX, research, MCP, and more.
- **Programmatic SDK** — use kbot as a library in your own apps.
- **MCP server built in** — plug kbot into Claude Code, Cursor, VS Code, Zed, or Neovim as a tool provider.

### How it compares

| | kbot | Claude Code | Aider | OpenCode |
|---|---|---|---|---|
| AI providers | 20 | 1 | 6 | 75+ |
| Specialist agents | 41 | 0 | 0 | 0 |
| Built-in tools | 384+ | ~15 | ~10 | ~10 |
| Learning engine | Yes | No | No | No |
| Offline mode | Embedded + Ollama | No | Ollama | Ollama |
| SDK | Yes | No | No | No |
| MCP server | Yes | N/A | No | No |
| Web companion | kernel.chat | No | No | No |
| Open source | MIT | Source available | Apache 2.0 | MIT |
| Cost | BYOK / $0 local | $20+/mo | BYOK | BYOK |

## Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Or run directly (no install)
npx @kernel.chat/kbot

# Or use the install script (auto-installs Node.js if needed)
curl -fsSL https://kernel.chat/install.sh | bash
```

```bash
# Interactive mode
kbot

# One-shot
kbot "explain this codebase"
kbot "fix the auth bug in src/auth.ts"
kbot "cr"
```

## Contributing

We welcome contributions of all kinds! Whether it's adding new tools, improving agents, or fixing bugs:
1. Fork the repo and clone it locally.
2. Install dependencies: `npm install`.
3. Create a branch: `git checkout -b feat/your-feature`.
4. Submit a Pull Request. Check out our [Discord](https://discord.gg/kdMauM9abG) for roadmap discussions.
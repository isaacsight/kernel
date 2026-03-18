#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Discord Channel Agents — Automated content for every channel
//  Run: npx tsx tools/discord-agents.ts [--channel <name>] [--all] [--dry-run]
//
//  Posts agent-curated content to specific Discord channels using
//  the Discord REST API. No gateway/discord.js needed.
//
//  Channels covered:
//    announcements, releases, roadmap, tips-and-tricks, tutorials,
//    tools, agents, providers, local-models, showcase, general
// ─────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID
const PROJECT_ROOT = resolve(__dirname, '..')

if (!TOKEN || !GUILD_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env')
  process.exit(1)
}

// ─── Discord API ────────────────────────────────────────────

const API = 'https://discord.com/api/v10'
const headers = {
  Authorization: `Bot ${TOKEN}`,
  'Content-Type': 'application/json',
}

async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') || 5)
    console.log(`  ⏳ Rate limited, waiting ${retryAfter}s...`)
    await new Promise(r => setTimeout(r, retryAfter * 1000))
    return api(path, method, body)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord ${method} ${path}: ${res.status} ${text}`)
  }
  return res.json()
}

let channelCache: Record<string, string> | null = null

async function getChannelId(name: string): Promise<string | null> {
  if (!channelCache) {
    const channels: any[] = await api(`/guilds/${GUILD_ID}/channels`)
    channelCache = {}
    for (const ch of channels) {
      if (ch.type === 0 || ch.type === 15) {
        channelCache[ch.name] = ch.id
      }
    }
  }
  return channelCache[name] || null
}

async function postEmbed(channelName: string, embed: DiscordEmbed, dryRun = false): Promise<boolean> {
  const channelId = await getChannelId(channelName)
  if (!channelId) {
    console.log(`  ⚠ Channel #${channelName} not found`)
    return false
  }
  if (dryRun) {
    console.log(`  [DRY RUN] Would post to #${channelName}: ${embed.title}`)
    return true
  }
  await api(`/channels/${channelId}/messages`, 'POST', { embeds: [embed] })
  console.log(`  ✅ Posted to #${channelName}: ${embed.title}`)
  return true
}

// ─── State Management ───────────────────────────────────────

const STATE_PATH = resolve(__dirname, 'daemon-reports', 'discord-agents-state.json')

interface AgentState {
  lastPosted: Record<string, string>
  contentHashes: Record<string, string[]>
  rotationIndex: Record<string, number>
  lastVersion: string
  lastRoadmapHash: string
  stats: { totalPosts: number; lastRun: string; errors: number }
}

function loadState(): AgentState {
  if (existsSync(STATE_PATH)) {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
  }
  return {
    lastPosted: {},
    contentHashes: {},
    rotationIndex: {},
    lastVersion: '',
    lastRoadmapHash: '',
    stats: { totalPosts: 0, lastRun: '', errors: 0 },
  }
}

function saveState(state: AgentState) {
  state.stats.lastRun = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function contentHash(channel: string, title: string, desc: string): string {
  return createHash('md5').update(`${channel}:${title}:${desc.slice(0, 100)}`).digest('hex')
}

function isDuplicate(state: AgentState, channel: string, hash: string): boolean {
  const hashes = state.contentHashes[channel] || []
  return hashes.includes(hash)
}

function recordPost(state: AgentState, channel: string, hash: string) {
  if (!state.contentHashes[channel]) state.contentHashes[channel] = []
  state.contentHashes[channel].push(hash)
  if (state.contentHashes[channel].length > 500) {
    state.contentHashes[channel] = state.contentHashes[channel].slice(-500)
  }
  state.lastPosted[channel] = new Date().toISOString()
  state.stats.totalPosts++
}

function nextIndex(state: AgentState, channel: string, bankSize: number): number {
  const idx = state.rotationIndex[channel] || 0
  state.rotationIndex[channel] = (idx + 1) % bankSize
  return idx
}

// ─── Data Extractors ────────────────────────────────────────

function getVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'packages/kbot/package.json'), 'utf-8'))
  return pkg.version
}

function getToolNames(): Array<{ name: string; file: string }> {
  const toolsDir = resolve(PROJECT_ROOT, 'packages/kbot/src/tools')
  const results: Array<{ name: string; file: string }> = []
  for (const f of readdirSync(toolsDir).filter(f => f.endsWith('.ts'))) {
    const content = readFileSync(resolve(toolsDir, f), 'utf-8')
    const matches = content.matchAll(/registerTool\(\{\s*name:\s*'([^']+)'/g)
    for (const m of matches) {
      results.push({ name: m[1], file: f.replace('.ts', '') })
    }
  }
  return results
}

function getRecentChanges(n = 10): string[] {
  try {
    return execSync(`git -C "${PROJECT_ROOT}" log --oneline -${n}`, { encoding: 'utf-8' }).trim().split('\n')
  } catch { return [] }
}

// ─── Embed Types ────────────────────────────────────────────

interface DiscordEmbed {
  title: string
  description: string
  color: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
  url?: string
}

const AMETHYST = 0x6B5B95
const footer = () => ({ text: `kbot v${getVersion()} | kernel.chat` })

// ─── Content Banks ──────────────────────────────────────────

const TIPS = [
  { title: 'Pipe anything into kbot', desc: '```bash\ngit diff | kbot "review this diff"\ncat error.log | kbot "what went wrong?"\ncurl api.example.com | kbot "parse this JSON"\n```\nkbot reads stdin automatically. Pipe any command output for instant analysis.' },
  { title: 'Switch agents mid-conversation', desc: 'Use `--agent` to pick a specialist:\n```bash\nkbot --agent researcher "latest papers on RAG"\nkbot --agent coder "refactor this function"\nkbot --agent writer "draft a changelog"\n```\n17 specialists, each with domain expertise.' },
  { title: 'Save and resume sessions', desc: '```bash\nkbot --session myproject\n# ... work on something ...\n# Come back later:\nkbot --session myproject --resume\n```\nYour full conversation context is restored.' },
  { title: 'Run kbot 100% locally', desc: '```bash\n# Option 1: Ollama\nkbot local\n\n# Option 2: Embedded (no setup)\nkbot local --embedded\n```\nZero API calls. Zero cost. Full privacy.' },
  { title: 'Create custom agents', desc: '```bash\nkbot matrix create myagent\n```\nDefine a system prompt, tools, and personality. Your agent gets saved to `~/.kbot/agents/` and works like any built-in specialist.' },
  { title: 'Audit any GitHub repo', desc: '```bash\nkbot audit facebook/react\nkbot audit rust-lang/rust --share\n```\n6-category scored audit: security, docs, quality, community, devops, health. `--share` creates a branded Gist.' },
  { title: 'Use kbot as an MCP server', desc: '```json\n// In your Claude Code .mcp.json:\n{\n  "kbot": {\n    "command": "npx",\n    "args": ["@kernel.chat/kbot", "mcp"]\n  }\n}\n```\nAll 262 kbot tools become available in Claude Code, Cursor, or any MCP client.' },
  { title: 'BYOK — Bring Your Own Key', desc: '```bash\nkbot auth\n```\nSet up any of 20 providers. Your key, your models, your choice. Keys are AES-256 encrypted at rest in `~/.kbot/config.json`.' },
  { title: 'Background tasks', desc: '```bash\nkbot "monitor my server logs for errors" --background\n```\nLong-running tasks execute in the background. kbot notifies you when they complete or find something interesting.' },
  { title: 'Parallel sub-agents', desc: 'kbot can spawn sub-agents that work in parallel:\n```bash\nkbot "research these 5 competitors simultaneously"\n```\nEach sub-agent gets its own context and reports back to the main agent.' },
  { title: 'Contribute to open source', desc: '```bash\nkbot contribute              # Find good-first-issues globally\nkbot contribute vercel/next  # Find quick wins in a specific repo\n```\nkbot scans for easy contribution opportunities and helps you submit PRs.' },
  { title: 'Web search built in', desc: '```bash\nkbot "what happened in tech news today?"\n```\nkbot has web search on by default — no config needed. It automatically decides when to search based on your question.' },
  { title: 'Game dev scaffolding', desc: '```bash\nkbot --agent coder "scaffold a Godot platformer"\nkbot --agent coder "set up Bevy ECS for a space shooter"\n```\n16 game dev tools supporting 8 engines: Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold.' },
  { title: 'Deploy from terminal', desc: '```bash\nkbot deploy              # Auto-detects your platform\nkbot deploy --status     # Check deployment status\nkbot deploy --rollback   # Roll back to previous version\n```\nSupports Vercel, Netlify, Cloudflare, Fly.io, Railway.' },
  { title: 'Database tools', desc: '```bash\nkbot "show me the schema for my postgres db"\nkbot "generate seed data for the users table"\nkbot "create an ER diagram"\n```\nPostgres, MySQL, SQLite support. Prisma integration. Mermaid ER diagrams.' },
  { title: 'VFX & creative coding', desc: '```bash\nkbot "generate a GLSL water shader"\nkbot "create a Houdini VEX noise effect"\nkbot "process this video with ffmpeg"\n```\n8 creative tools: shaders, VEX, FFmpeg, ImageMagick, Blender, procedural textures, color palettes, audio viz.' },
  { title: 'Mimic coding styles', desc: '```bash\nkbot --mimic claude-code "refactor this file"\nkbot --mimic cursor "add error handling"\n```\nkbot can adopt coding styles from popular tools and frameworks. Useful for matching team conventions.' },
  { title: 'Docker sandbox', desc: '```bash\nkbot "run this untrusted script safely"\n```\nkbot can execute code in a Docker sandbox — isolated, ephemeral, no risk to your system.' },
  { title: 'Share conversations', desc: '```bash\nkbot share\n```\nCreates a branded GitHub Gist of your conversation. If `gh` CLI isn\'t available, copies to clipboard instead.' },
  { title: 'Memory across sessions', desc: 'kbot remembers context across sessions automatically:\n```bash\nkbot "remember that our API uses v3 endpoints"\n# ... days later ...\nkbot "what API version do we use?"\n```\nPersistent memory stored locally at `~/.kbot/memory/`.' },
  { title: 'Install in one line', desc: '```bash\ncurl -fsSL https://kernel.chat/install | sh\n```\nAuto-detects your OS, installs Node.js if needed, and sets up kbot globally. Works on macOS, Linux, and WSL.' },
  { title: 'Checkpointing for long tasks', desc: 'kbot v3.0+ saves progress checkpoints during long tasks. If interrupted, it resumes from the last checkpoint instead of starting over.\n\nNo config needed — it\'s automatic.' },
  { title: 'Structured streaming', desc: 'Using kbot programmatically? The SDK gives you typed streaming events:\n```typescript\nimport { KBot } from \'@kernel.chat/kbot\'\nconst bot = new KBot()\nfor await (const event of bot.stream("hello")) {\n  console.log(event.type, event.data)\n}\n```' },
  { title: 'File analysis', desc: '```bash\nkbot "analyze this CSV" < data.csv\nkbot "summarize this PDF" --file report.pdf\n```\nkbot handles CSVs, PDFs, images, and more. It picks the right tool automatically.' },
  { title: 'Research papers', desc: '```bash\nkbot --agent researcher "latest papers on diffusion models"\n```\nSearches arXiv, Semantic Scholar, Papers With Code, and HuggingFace. Returns structured findings with citations.' },
  { title: 'Plugin system', desc: '```bash\nkbot plugin create my-plugin\nkbot plugin install some-plugin\n```\nExtend kbot with custom tools, hooks, and commands. Plugins live at `~/.kbot/plugins/` and can be published to npm.' },
  { title: 'Pair programming mode', desc: '```bash\nkbot pair\n```\nkbot watches your files for changes and runs 6 analysis checks automatically: types, lint, tests, imports, security, style. Auto-fixes safe operations.' },
  { title: 'Team mode (multi-agent)', desc: '```bash\nkbot team\n```\nSpins up a local TCP server where multiple kbot agents collaborate on tasks with role-based routing. NDJSON protocol on `localhost:7439`.' },
  { title: 'Terminal recording', desc: '```bash\nkbot record\n```\nRecords your terminal session as animated SVG, GIF, or asciicast. 4 themes available. Great for documentation and demos.' },
  { title: 'MCP marketplace', desc: '```bash\nkbot mcp search "database"\nkbot mcp install @modelcontextprotocol/server-postgres\n```\nBrowse and install MCP servers from the official registry. 20 servers bundled, hundreds more available.' },
]

const TUTORIALS = [
  { title: 'Getting Started with kbot', desc: '**Step 1** — Install\n```bash\nnpm install -g @kernel.chat/kbot\n```\n\n**Step 2** — Set up a provider\n```bash\nkbot auth\n# Follow the prompts to add your API key\n```\n\n**Step 3** — Start chatting\n```bash\nkbot "hello, what can you do?"\n```\n\n**Step 4** — Try a specialist\n```bash\nkbot --agent coder "write a fizzbuzz in Rust"\n```\n\nThat\'s it. 262 tools are available from day one.' },
  { title: 'Setting Up Local AI (Zero Cost)', desc: '**Option A: Ollama (recommended)**\n```bash\n# Install Ollama\ncurl -fsSL https://ollama.ai/install.sh | sh\n\n# Pull a model\nollama pull gemma3:12b\n\n# Run kbot locally\nkbot local\n```\n\n**Option B: Embedded (no setup)**\n```bash\nkbot local --embedded\n```\nThis downloads a small model and runs inference directly — no Ollama needed.\n\n**Option C: LM Studio**\n1. Download LM Studio\n2. Load any GGUF model\n3. Start the server\n4. `kbot auth` → select LM Studio' },
  { title: 'Building a Custom Agent', desc: '```bash\n# Create the agent scaffold\nkbot matrix create devops-bot\n```\n\nThis creates `~/.kbot/agents/devops-bot.json`. Edit it:\n```json\n{\n  "name": "DevOps Bot",\n  "icon": "🚀",\n  "color": "#FF6347",\n  "prompt": "You are a DevOps specialist..."\n}\n```\n\nUse it:\n```bash\nkbot --agent devops-bot "deploy to staging"\n```\n\nYour agents have access to all 262 built-in tools.' },
  { title: 'Using kbot as an MCP Server', desc: 'kbot can act as an MCP server, exposing all its tools to Claude Code, Cursor, or any MCP client.\n\n**Claude Code setup:**\nAdd to `.mcp.json`:\n```json\n{\n  "mcpServers": {\n    "kbot": {\n      "command": "npx",\n      "args": ["@kernel.chat/kbot", "mcp"]\n    }\n  }\n}\n```\n\n**What you get:**\n- 262 tools in your editor\n- Web search, git, file ops, database, deploy\n- All running through kbot\'s agent loop' },
  { title: 'Auditing Open Source Repos', desc: '```bash\nkbot audit vercel/next.js\n```\n\n**What it checks:**\n- 🔒 Security (dependencies, secrets, headers)\n- 📄 Documentation (README, contributing, license)\n- ✅ Code quality (linting, types, tests)\n- 👥 Community (issues, PRs, responsiveness)\n- 🚀 DevOps (CI/CD, releases, automation)\n- 💚 Health (activity, bus factor, staleness)\n\n**Each category gets a letter grade** (A-F) and overall score.\n\n**Share it:**\n```bash\nkbot audit vercel/next.js --share\n```\nCreates a branded GitHub Gist with the full report.' },
  { title: 'Multi-Step Research Workflow', desc: '```bash\nkbot --agent researcher "comprehensive analysis of WebAssembly adoption in 2026"\n```\n\n**What happens under the hood:**\n1. Breaks your query into sub-questions\n2. Searches web, arXiv, Semantic Scholar\n3. Cross-references multiple sources\n4. Synthesizes findings into structured report\n5. Flags gaps and uncertainties\n\n**Pro tip:** Pipe the output to a file:\n```bash\nkbot --agent researcher "..." > research.md\n```' },
  { title: 'Game Dev with kbot', desc: '16 game dev tools across 8 engines.\n\n**Scaffold a new game:**\n```bash\nkbot --agent coder "scaffold a Godot 4 platformer with player controller"\n```\n\n**Available tools:**\n`scaffold_game` · `game_config` · `shader_debug` · `material_graph` · `mesh_generate` · `sprite_pack` · `physics_setup` · `particle_system` · `level_generate` · `tilemap_generate` · `navmesh_config` · `game_audio` · `netcode_scaffold` · `game_build` · `game_test` · `ecs_generate`\n\n**Engines:** Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold' },
  { title: 'Database Operations', desc: '```bash\n# Query your database\nkbot "show all users created this week"\n\n# Generate seed data\nkbot "seed the products table with 50 realistic entries"\n\n# Visualize schema\nkbot "create an ER diagram for my database"\n```\n\n**Supported databases:** PostgreSQL, MySQL, SQLite\n**Prisma integration:** introspect, generate, migrate\n**Output formats:** Tables, JSON, Mermaid diagrams' },
  { title: 'Deploy from Terminal', desc: '```bash\n# Auto-detect and deploy\nkbot deploy\n\n# Check status\nkbot deploy --status\n\n# View logs\nkbot deploy --logs\n\n# Rollback\nkbot deploy --rollback\n\n# Manage env vars\nkbot deploy --env set API_KEY=xxx\n```\n\n**Auto-detects:** Vercel (`vercel.json`), Netlify (`netlify.toml`), Cloudflare (`wrangler.toml`), Fly.io (`fly.toml`), Railway (`railway.json`)\n\nNo config needed — kbot reads your project files.' },
  { title: 'Contributing to Open Source', desc: '```bash\n# Find good-first-issues globally\nkbot contribute\n\n# Find opportunities in a specific repo\nkbot contribute facebook/react\n\n# Prepare a contribution\nkbot contribute prepare <issue-url>\n\n# Submit your PR\nkbot contribute submit\n```\n\nkbot scans for:\n- Issues labeled `good-first-issue`\n- Stale PRs that need rebasing\n- Documentation gaps\n- Missing tests\n- Typos and small fixes' },
]

const SHOWCASE_WORKFLOWS = [
  { title: 'Audit → Fix → PR in 60 seconds', desc: '```bash\n# 1. Audit the repo\nkbot audit myorg/myrepo\n\n# 2. Fix the top issue\nkbot --agent coder "fix the critical security finding"\n\n# 3. Submit the PR\nkbot --agent coder "create a PR with these changes"\n```\nFrom audit to merged PR without leaving your terminal.' },
  { title: 'Research → Blog Post → Publish', desc: '```bash\n# 1. Deep research\nkbot --agent researcher "state of WebAssembly in 2026"\n\n# 2. Draft the post\nkbot --agent writer "turn this research into a blog post"\n\n# 3. Review\nkbot --agent analyst "critique this draft for accuracy"\n```\nThree agents, three steps, one polished article.' },
  { title: 'Log analysis pipeline', desc: '```bash\n# Pipe production logs directly\ntail -1000 /var/log/app.log | kbot "find error patterns and suggest fixes"\n```\nkbot identifies recurring errors, groups them by type, and suggests code fixes. Works with any log format.' },
  { title: 'Parallel competitive analysis', desc: '```bash\nkbot --agent analyst "compare Vercel vs Netlify vs Cloudflare Pages: pricing, features, DX, and performance"\n```\nkbot spawns sub-agents that research each platform simultaneously, then synthesizes a comparison table.' },
  { title: 'Codebase onboarding', desc: '```bash\ncd new-project\nkbot "explain this codebase: architecture, key files, patterns, and how to contribute"\n```\nkbot reads the repo structure, key files, README, and recent git history to generate a comprehensive onboarding guide.' },
  { title: 'Security audit + fix loop', desc: '```bash\n# Full security scan\nkbot --agent guardian "security audit this project"\n\n# Auto-fix safe issues\nkbot --agent coder "fix all P2 and below security findings"\n\n# Verify fixes\nkbot --agent guardian "re-audit and confirm fixes"\n```\nGuardian finds issues. Coder fixes them. Guardian verifies. Repeat.' },
  { title: 'Data → Chart → Report', desc: '```bash\ncat sales.csv | kbot "analyze this data: trends, outliers, and create a summary report with charts"\n```\nkbot reads the CSV, runs statistical analysis, generates Mermaid charts, and produces a markdown report.' },
  { title: 'Multi-language translation', desc: '```bash\nkbot --agent adapter "translate this README to Japanese, Korean, and Chinese"\n```\nThe Adapter specialist preserves technical terms, code blocks, and formatting while translating naturally — not word-by-word.' },
  { title: 'Git archaeology', desc: '```bash\nkbot --agent chronist "trace the history of the auth module: when was it created, major changes, and why"\n```\nChronist uses git log, blame, and commit messages to reconstruct the evolution of any part of your codebase.' },
  { title: 'Automated documentation', desc: '```bash\nkbot --agent curator "generate API documentation for all exported functions in src/"\n```\nCurator reads your source code, extracts function signatures, infers behavior, and produces structured docs with examples.' },
]

const GENERAL_PROMPTS = [
  { title: 'What are you building?', desc: 'Drop what you\'re working on in this thread. Always curious what people are using kbot for.' },
  { title: 'Local vs Cloud — what\'s your setup?', desc: 'Do you run kbot with a cloud provider (Anthropic, OpenAI, etc.) or locally with Ollama/embedded? What\'s your model of choice?' },
  { title: 'Feature you didn\'t know existed', desc: 'kbot has 262 tools. What\'s a feature you discovered recently that surprised you?' },
  { title: 'Your daily kbot workflow', desc: 'What does your typical kbot usage look like? One-off questions? Long sessions? Piping output? Pair mode?' },
  { title: 'Tool requests', desc: 'If kbot could do one thing it can\'t today, what would it be? Drop your ideas.' },
  { title: 'Provider showdown', desc: 'What AI provider are you using with kbot? How does it compare to others you\'ve tried? Speed, quality, cost?' },
  { title: 'Terminal setup flex', desc: 'Show off your terminal setup. What shell, theme, font, and tools do you use alongside kbot?' },
  { title: 'Automation wins', desc: 'Share a time kbot saved you serious time on a task. Bonus points for the actual command.' },
  { title: 'Open source contributions', desc: 'Used `kbot contribute` to find and submit a PR? Share the repo and what you fixed.' },
  { title: 'Game dev check-in', desc: 'Anyone using kbot\'s game dev tools? What engine? What are you making?' },
  { title: 'Custom agents', desc: 'Built a custom agent with `kbot matrix create`? Share what it does and your system prompt approach.' },
  { title: 'Bug bounty', desc: 'Found a bug? Describe it here and we\'ll get it triaged. Screenshots and reproduction steps help a lot.' },
  { title: 'Weekend project ideas', desc: 'Need a weekend project? Here are some that work great with kbot:\n- Build a CLI tool and let kbot write the tests\n- Audit 5 repos you use daily\n- Set up a local AI stack with Ollama\n- Create a custom agent for your domain' },
  { title: 'Favorite specialist', desc: 'Which kbot specialist do you use the most? Coder? Researcher? Writer? Something unexpected?' },
  { title: 'One-liner challenge', desc: 'What\'s the most useful thing you\'ve done with a single kbot command? Share your best one-liners.' },
]

const LOCAL_MODEL_TIPS = [
  { title: 'Best models for coding (March 2026)', desc: '**Top picks for local code generation:**\n\n| Model | Size | Speed | Quality |\n|-------|------|-------|--------|\n| `qwen2.5-coder:32b` | 32B | Medium | Excellent |\n| `qwen2.5-coder:14b` | 14B | Fast | Great |\n| `deepseek-coder-v2:16b` | 16B | Fast | Great |\n| `codellama:13b` | 13B | Fast | Good |\n| `qwen2.5-coder:7b` | 7B | Very fast | Good |\n\n```bash\nollama pull qwen2.5-coder:14b\nkbot local\n```' },
  { title: 'Embedded mode — zero setup AI', desc: 'kbot v3.0+ includes an embedded llama.cpp engine. No Ollama, no downloads, no config:\n```bash\nkbot local --embedded\n```\n\nFirst run downloads a small model (~2GB). After that, it\'s instant.\n\n**When to use:**\n- Quick questions that don\'t need GPT-4 quality\n- Offline work (airplanes, no internet)\n- Privacy-sensitive tasks\n- CI/CD pipelines' },
  { title: 'Ollama performance tuning', desc: '**GPU acceleration:**\nOllama uses your GPU by default on macOS (Metal) and Linux (CUDA/ROCm). Check with:\n```bash\nollama ps\n```\n\n**Context window:**\n```bash\nollama run gemma3:12b --num-ctx 8192\n```\nBigger context = more memory. 8K is a good balance.\n\n**Multiple models:**\nOllama keeps models loaded in memory. If you switch often, set:\n```bash\nexport OLLAMA_KEEP_ALIVE=5m\n```' },
  { title: 'LM Studio setup guide', desc: '1. Download LM Studio from lmstudio.ai\n2. Browse and download a GGUF model (try `Qwen2.5-Coder-14B`)\n3. Click "Start Server" (default: `localhost:1234`)\n4. In kbot:\n```bash\nkbot auth\n# Select LM Studio → Enter\n```\n\n**Advantage over Ollama:** GUI model browser, easy quantization selection, visual performance metrics.' },
  { title: 'Model size vs. hardware guide', desc: '**How much RAM/VRAM do you need?**\n\n| Model Size | RAM (CPU) | VRAM (GPU) | Quality |\n|-----------|-----------|------------|--------|\n| 1-3B | 4GB | 3GB | Basic tasks |\n| 7B | 8GB | 6GB | Good for most |\n| 14B | 16GB | 10GB | Great quality |\n| 32B | 32GB | 20GB | Near-cloud |\n| 70B | 64GB | 40GB+ | Excellent |\n\n**Rule of thumb:** Q4 quantization ≈ model_params × 0.5GB VRAM' },
  { title: 'Running DeepSeek R1 locally', desc: '```bash\n# Distilled versions (recommended)\nollama pull deepseek-r1:7b     # 4GB, fast\nollama pull deepseek-r1:14b    # 8GB, better\nollama pull deepseek-r1:32b    # 16GB, great\nollama pull deepseek-r1:70b    # 40GB, excellent\n\nkbot local\n# kbot auto-detects your Ollama models\n```\n\nDeepSeek R1 excels at reasoning and math. The 14B distilled version is the sweet spot for most machines.' },
  { title: 'Privacy-first AI workflow', desc: 'For sensitive codebases, run everything locally:\n```bash\n# 1. Use local models only\nkbot local --embedded\n\n# 2. Disable cloud sync\nkbot config set cloud_sync false\n\n# 3. Check what\'s stored\nls ~/.kbot/\n```\n\n**What stays local:**\n- All conversations\n- Memory and learning data\n- Session history\n- API keys (encrypted)\n\n**What never leaves your machine:** Everything. Zero telemetry.' },
  { title: 'Jan — the friendly local AI', desc: '**Jan** is an open-source desktop app for running AI locally with a chat UI.\n\n1. Download from jan.ai\n2. Import a model (or download from their hub)\n3. Start the API server (Settings → Advanced)\n4. Configure kbot:\n```bash\nkbot auth\n# Select Jan → port 1337\n```\n\n**Good for:** People who want a GUI alongside kbot\'s CLI.' },
]

const PROVIDER_SPOTLIGHTS = [
  { name: 'Anthropic (Claude)', color: 0xD97757, desc: 'The default kbot provider. Claude Sonnet 4.6 for quality, Haiku 4.5 for speed.\n\n**Models:** claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5\n**Pricing:** $3/M input, $15/M output\n**Best for:** Complex reasoning, long context, coding\n**Setup:** `kbot auth` → Anthropic → paste your API key' },
  { name: 'OpenAI', color: 0x10A37F, desc: 'GPT-4.1 and the o3 reasoning model.\n\n**Models:** gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3, o4-mini\n**Pricing:** $2/M input, $8/M output\n**Best for:** General tasks, function calling, broad knowledge\n**Setup:** `kbot auth` → OpenAI → paste your API key' },
  { name: 'Google (Gemini)', color: 0x4285F4, desc: 'Gemini 2.5 Pro with massive context windows.\n\n**Models:** gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash\n**Pricing:** $1.25/M input, $10/M output\n**Best for:** Long documents, multimodal, cost efficiency\n**Setup:** `kbot auth` → Google → paste your API key' },
  { name: 'DeepSeek', color: 0x4D6BFE, desc: 'The price-performance king.\n\n**Models:** deepseek-chat, deepseek-reasoner\n**Pricing:** $0.27/M input, $1.10/M output\n**Best for:** Budget-conscious users who need good quality\n**Setup:** `kbot auth` → DeepSeek → paste your API key\n\n*10x cheaper than Claude/GPT for most tasks.*' },
  { name: 'Groq', color: 0xF55036, desc: 'Fastest inference. Period.\n\n**Models:** llama-3.3-70b, llama-3.1-8b-instant, deepseek-r1-distill-70b\n**Pricing:** $0.59/M input, $0.79/M output\n**Best for:** Speed-critical tasks, interactive coding, rapid iteration\n**Setup:** `kbot auth` → Groq → paste your API key\n\n*Responses in milliseconds, not seconds.*' },
  { name: 'OpenRouter', color: 0x6366F1, desc: 'Access any model through one API key.\n\n**Models:** 100+ from every provider\n**Pricing:** Varies by model (pass-through + small margin)\n**Best for:** Trying different models, fallback routing, flexibility\n**Setup:** `kbot auth` → OpenRouter → paste your API key\n\n*One key to rule them all.*' },
  { name: 'Mistral AI', color: 0xFF7000, desc: 'European AI with strong multilingual and code capabilities.\n\n**Models:** mistral-large, mistral-small, codestral, pixtral-large\n**Pricing:** $2/M input, $6/M output\n**Best for:** European languages, code generation (Codestral), vision tasks\n**Setup:** `kbot auth` → Mistral → paste your API key' },
  { name: 'Together AI', color: 0x23C4ED, desc: 'Open-source models at scale.\n\n**Models:** Llama 3.3 70B, DeepSeek R1, Qwen 2.5 72B, Mixtral\n**Pricing:** $0.88/M input, $0.88/M output\n**Best for:** Open-weight model fans, balanced cost/quality\n**Setup:** `kbot auth` → Together → paste your API key' },
  { name: 'Cerebras', color: 0x0066FF, desc: 'Wafer-scale inference — ultra-fast, ultra-cheap.\n\n**Models:** llama-3.3-70b, llama-3.1-8b, deepseek-r1-distill-70b\n**Pricing:** $0.60/M input, $0.60/M output\n**Best for:** High-throughput tasks, batch processing\n**Setup:** `kbot auth` → Cerebras → paste your API key' },
  { name: 'SambaNova Cloud', color: 0x7B2D8B, desc: 'Custom silicon for blazing inference.\n\n**Models:** Llama 3.3 70B, Llama 3.1 405B, DeepSeek R1, Qwen 2.5 72B\n**Pricing:** $0.50/M input, $1.00/M output\n**Best for:** Large model access (405B) at reasonable cost\n**Setup:** `kbot auth` → SambaNova → paste your API key' },
  { name: 'Ollama (Local)', color: 0xFFFFFF, desc: 'Run models on your own hardware. Zero cost. Full privacy.\n\n**Models:** Thousands of GGUF models\n**Pricing:** Free (your hardware)\n**Best for:** Privacy, offline work, zero cost\n**Setup:**\n```bash\ncurl -fsSL https://ollama.ai/install.sh | sh\nollama pull gemma3:12b\nkbot local\n```' },
]

const AGENT_SPOTLIGHTS = [
  { id: 'kernel', icon: '◉', color: 0x6B5B95, desc: 'The default. Handles anything — conversation, lookups, task coordination. Knows when to hand off to specialists.' },
  { id: 'researcher', icon: '🔍', color: 0x5B8BA0, desc: 'Methodical investigator. Breaks complex questions into sub-questions, cross-references sources, cites evidence. Prioritizes accuracy over speed.' },
  { id: 'coder', icon: '⌨', color: 0x6B8E6B, desc: 'Senior engineer. Reads existing code first, writes minimal focused changes, handles edge cases, tests the work. TypeScript, Python, Rust, Go, and more.' },
  { id: 'writer', icon: '✎', color: 0xB8875C, desc: 'Adapts tone to any medium — blog, docs, email, social. Active voice, clear structure, ruthless editing. Makes technical content scannable.' },
  { id: 'analyst', icon: '📊', color: 0xA0768C, desc: 'Breaks complex situations into actionable insights. SWOT, cost-benefit, risk matrices. Quantifies when possible — numbers beat adjectives.' },
  { id: 'aesthete', icon: '◈', color: 0xDAA520, desc: 'Design & UI/UX expert. Hierarchy, contrast, alignment, accessibility (WCAG 2.1 AA). Mobile-first thinking. CSS mastery.' },
  { id: 'guardian', icon: '🛡', color: 0x228B22, desc: 'Security specialist. OWASP Top 10, auth flows, dependency audits, secret detection. Thinks like an attacker to defend like a guardian.' },
  { id: 'curator', icon: '📚', color: 0x9370DB, desc: 'Knowledge management. Documentation, changelogs, decision records. Structures information for findability. Fills documentation gaps.' },
  { id: 'strategist', icon: '♟', color: 0xC4956A, desc: 'Connects technical decisions to business outcomes. Roadmaps, competitive analysis, stakeholder mapping. Thinks in terms of leverage.' },
  { id: 'infrastructure', icon: '⚙', color: 0x4682B4, desc: 'DevOps & infra. CI/CD, containers, cloud services, monitoring. Automates everything that runs more than twice.' },
  { id: 'quant', icon: '∑', color: 0xDB7093, desc: 'Data scientist. Exploratory analysis, statistical methods, visualizations. Pandas, NumPy, scipy. Communicates results in plain language.' },
  { id: 'investigator', icon: '🔎', color: 0x8B4513, desc: 'Deep research. Follows evidence trails, maps timelines, identifies discrepancies. Called when something doesn\'t add up.' },
  { id: 'oracle', icon: '☉', color: 0xCD853F, desc: 'Predictions & foresight. Trend analysis, scenario planning, confidence levels. Helps teams prepare for what\'s coming.' },
  { id: 'chronist', icon: '◷', color: 0x20B2AA, desc: 'History & timeline specialist. Builds timelines from git history and changelogs. Explains why decisions were made in their original context.' },
  { id: 'sage', icon: '✧', color: 0xDAA520, desc: 'Philosophy & wisdom. Long-term thinking, mental models, cross-disciplinary knowledge. Sometimes the best contribution is a well-placed question.' },
  { id: 'communicator', icon: '📡', color: 0xFF6347, desc: 'Crafts clear messages for any audience. Status updates, incident reports, feature announcements, proposals. Leads with the key takeaway.' },
  { id: 'adapter', icon: '⟳', color: 0x4169E1, desc: 'Translation & format conversion. JSON↔YAML↔TOML, language translation, framework migration. Preserves meaning and intent, not just syntax.' },
]

// ─── Channel Agents ─────────────────────────────────────────

interface ChannelAgent {
  channel: string
  name: string
  generate: (state: AgentState) => { embed: DiscordEmbed; skip?: boolean }
}

const agents: ChannelAgent[] = [
  // ── Announcements (version-triggered) ──
  {
    channel: 'announcements',
    name: 'Release Notes',
    generate(state) {
      const version = getVersion()
      if (version === state.lastVersion) {
        return { embed: {} as DiscordEmbed, skip: true }
      }
      const changes = getRecentChanges(5).map(l => `• ${l}`).join('\n')
      state.lastVersion = version
      return {
        embed: {
          title: `kbot v${version} Released`,
          description: `A new version of kbot is available.\n\n**Recent changes:**\n${changes}\n\n**Install / Update:**\n\`\`\`bash\nnpm i -g @kernel.chat/kbot\n\`\`\``,
          color: AMETHYST,
          footer: footer(),
          timestamp: new Date().toISOString(),
        },
      }
    },
  },

  // ── Releases (version-triggered) ──
  {
    channel: 'releases',
    name: 'Version Notification',
    generate(state) {
      const version = getVersion()
      if (version === state.lastVersion && state.lastPosted['releases']) {
        return { embed: {} as DiscordEmbed, skip: true }
      }
      return {
        embed: {
          title: `📦 @kernel.chat/kbot@${version}`,
          description: `New version published to npm.\n\n\`\`\`bash\nnpm i -g @kernel.chat/kbot@${version}\n\`\`\`\n\n[npm](https://npmjs.com/package/@kernel.chat/kbot) · [GitHub](https://github.com/isaacsight/kernel)`,
          color: 0x2ECC71,
          footer: footer(),
          timestamp: new Date().toISOString(),
        },
      }
    },
  },

  // ── Roadmap (content-change triggered) ──
  {
    channel: 'roadmap',
    name: 'Roadmap Update',
    generate(state) {
      const roadmap = readFileSync(resolve(PROJECT_ROOT, 'ROADMAP.md'), 'utf-8')
      const hash = createHash('md5').update(roadmap).digest('hex')
      if (hash === state.lastRoadmapHash) {
        return { embed: {} as DiscordEmbed, skip: true }
      }
      state.lastRoadmapHash = hash
      // Extract key sections
      const lines = roadmap.split('\n')
      const nextIdx = lines.findIndex(l => l.startsWith('## Next'))
      const futureIdx = lines.findIndex(l => l.startsWith('## Future'))
      const nextSection = nextIdx >= 0 && futureIdx >= 0
        ? lines.slice(nextIdx, futureIdx).join('\n').slice(0, 800)
        : 'Check ROADMAP.md for details.'
      return {
        embed: {
          title: '🗺️ Roadmap Updated',
          description: `The kbot roadmap has been updated.\n\n${nextSection}\n\nFull roadmap: [ROADMAP.md](https://github.com/isaacsight/kernel/blob/main/ROADMAP.md)`,
          color: AMETHYST,
          footer: footer(),
          timestamp: new Date().toISOString(),
        },
      }
    },
  },

  // ── Tips & Tricks (rotation) ──
  {
    channel: 'tips-and-tricks',
    name: 'Power User Tips',
    generate(state) {
      const idx = nextIndex(state, 'tips-and-tricks', TIPS.length)
      const tip = TIPS[idx]
      return {
        embed: {
          title: `💡 Tip #${idx + 1}: ${tip.title}`,
          description: tip.desc,
          color: AMETHYST,
          footer: { text: `Tip ${idx + 1} of ${TIPS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Tutorials (rotation) ──
  {
    channel: 'tutorials',
    name: 'Tutorial Spotlight',
    generate(state) {
      const idx = nextIndex(state, 'tutorials', TUTORIALS.length)
      const tut = TUTORIALS[idx]
      return {
        embed: {
          title: `📘 Tutorial: ${tut.title}`,
          description: tut.desc,
          color: 0x3498DB,
          footer: { text: `Tutorial ${idx + 1} of ${TUTORIALS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Tools (rotation through actual tool list) ──
  {
    channel: 'tools',
    name: 'Tool of the Day',
    generate(state) {
      const tools = getToolNames()
      const idx = nextIndex(state, 'tools', tools.length)
      const tool = tools[idx]
      const category = tool.file.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return {
        embed: {
          title: `🔧 Tool Spotlight: \`${tool.name}\``,
          description: `**Category:** ${category}\n**Module:** \`packages/kbot/src/tools/${tool.file}.ts\`\n\nUse it:\n\`\`\`bash\nkbot "${tool.name.replace(/_/g, ' ')} ..."\n\`\`\`\n\nkbot has **${tools.length} tools** built in. All free, all open source.`,
          color: 0x6B8E6B,
          footer: { text: `Tool ${idx + 1} of ${tools.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Agents (rotation) ──
  {
    channel: 'agents',
    name: 'Agent Spotlight',
    generate(state) {
      const idx = nextIndex(state, 'agents', AGENT_SPOTLIGHTS.length)
      const agent = AGENT_SPOTLIGHTS[idx]
      return {
        embed: {
          title: `${agent.icon} Agent Spotlight: ${agent.id}`,
          description: `${agent.desc}\n\n**Use it:**\n\`\`\`bash\nkbot --agent ${agent.id} "your prompt here"\n\`\`\``,
          color: agent.color,
          footer: { text: `Agent ${idx + 1} of ${AGENT_SPOTLIGHTS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Providers (rotation) ──
  {
    channel: 'providers',
    name: 'Provider Spotlight',
    generate(state) {
      const idx = nextIndex(state, 'providers', PROVIDER_SPOTLIGHTS.length)
      const provider = PROVIDER_SPOTLIGHTS[idx]
      return {
        embed: {
          title: `⚡ Provider Spotlight: ${provider.name}`,
          description: provider.desc,
          color: provider.color,
          footer: { text: `Provider ${idx + 1} of ${PROVIDER_SPOTLIGHTS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Local Models (rotation) ──
  {
    channel: 'local-models',
    name: 'Local AI Tips',
    generate(state) {
      const idx = nextIndex(state, 'local-models', LOCAL_MODEL_TIPS.length)
      const tip = LOCAL_MODEL_TIPS[idx]
      return {
        embed: {
          title: `🏠 ${tip.title}`,
          description: tip.desc,
          color: 0x4682B4,
          footer: { text: `Local AI tip ${idx + 1} of ${LOCAL_MODEL_TIPS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── Showcase (rotation) ──
  {
    channel: 'showcase',
    name: 'Workflow Example',
    generate(state) {
      const idx = nextIndex(state, 'showcase', SHOWCASE_WORKFLOWS.length)
      const wf = SHOWCASE_WORKFLOWS[idx]
      return {
        embed: {
          title: `✨ ${wf.title}`,
          description: wf.desc,
          color: 0xDAA520,
          footer: { text: `Workflow ${idx + 1} of ${SHOWCASE_WORKFLOWS.length} | kbot v${getVersion()}` },
        },
      }
    },
  },

  // ── General (rotation) ──
  {
    channel: 'general',
    name: 'Community Engagement',
    generate(state) {
      const idx = nextIndex(state, 'general', GENERAL_PROMPTS.length)
      const prompt = GENERAL_PROMPTS[idx]
      return {
        embed: {
          title: prompt.title,
          description: prompt.desc,
          color: AMETHYST,
          footer: footer(),
        },
      }
    },
  },
]

// ─── CLI ────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const showStatus = args.includes('--status')
const resetState = args.includes('--reset')
const channelFlag = args.indexOf('--channel')
const targetChannel = channelFlag >= 0 ? args[channelFlag + 1] : null
const runAll = args.includes('--all') || (!targetChannel && !showStatus && !resetState)

async function main() {
  console.log('🤖 kbot Discord Agents')
  console.log('═'.repeat(50))

  const state = loadState()

  if (resetState) {
    writeFileSync(STATE_PATH, JSON.stringify({
      lastPosted: {}, contentHashes: {}, rotationIndex: {},
      lastVersion: '', lastRoadmapHash: '',
      stats: { totalPosts: 0, lastRun: '', errors: 0 },
    }, null, 2))
    console.log('✅ State reset.')
    return
  }

  if (showStatus) {
    console.log(`\nLast run: ${state.stats.lastRun || 'never'}`)
    console.log(`Total posts: ${state.stats.totalPosts}`)
    console.log(`Errors: ${state.stats.errors}`)
    console.log(`Last version posted: ${state.lastVersion || 'none'}`)
    console.log('\nRotation indexes:')
    for (const [ch, idx] of Object.entries(state.rotationIndex)) {
      console.log(`  #${ch}: ${idx}`)
    }
    console.log('\nLast posted:')
    for (const [ch, ts] of Object.entries(state.lastPosted)) {
      console.log(`  #${ch}: ${ts}`)
    }
    return
  }

  if (dryRun) console.log('🧪 DRY RUN — no messages will be sent\n')

  const toRun = runAll
    ? agents
    : agents.filter(a => {
        const name = targetChannel?.toLowerCase().replace(/[^a-z]/g, '')
        const agentName = a.channel.replace(/-/g, '')
        return agentName.includes(name || '') || a.channel === targetChannel
      })

  if (toRun.length === 0) {
    console.log(`No agent found for channel "${targetChannel}"`)
    console.log('Available:', agents.map(a => a.channel).join(', '))
    return
  }

  let posted = 0
  let skipped = 0
  let errors = 0

  for (const agent of toRun) {
    try {
      console.log(`\n📡 ${agent.name} → #${agent.channel}`)
      const { embed, skip } = agent.generate(state)
      if (skip) {
        console.log('  ⏭ Skipped (no changes)')
        skipped++
        continue
      }
      const hash = contentHash(agent.channel, embed.title, embed.description)
      if (isDuplicate(state, agent.channel, hash)) {
        console.log('  ⏭ Skipped (duplicate)')
        skipped++
        continue
      }
      const success = await postEmbed(agent.channel, embed, dryRun)
      if (success) {
        recordPost(state, agent.channel, hash)
        posted++
      }
      // Brief delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000))
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`)
      errors++
      state.stats.errors++
    }
  }

  saveState(state)

  console.log('\n' + '═'.repeat(50))
  console.log(`✅ Done — ${posted} posted, ${skipped} skipped, ${errors} errors`)
}

// ─── Export for MCP / programmatic use ──────────────────────

export async function postToChannel(channel: string, dryRun = false): Promise<string> {
  const state = loadState()
  const agent = agents.find(a => a.channel === channel || a.channel.replace(/-/g, '') === channel.replace(/-/g, ''))
  if (!agent) return `No agent for channel "${channel}"`
  const { embed, skip } = agent.generate(state)
  if (skip) return `Skipped #${channel} (no changes)`
  const hash = contentHash(agent.channel, embed.title, embed.description)
  if (isDuplicate(state, agent.channel, hash)) return `Skipped #${channel} (duplicate)`
  const success = await postEmbed(agent.channel, embed, dryRun)
  if (success) {
    recordPost(state, agent.channel, hash)
    saveState(state)
    return `Posted to #${channel}: ${embed.title}`
  }
  return `Failed to post to #${channel}`
}

export { agents, loadState }

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

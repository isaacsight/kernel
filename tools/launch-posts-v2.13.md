# K:BOT v2.13 Launch Posts — All Platforms

Ready-to-copy-paste posts for every platform.
Generated 2026-03-14. All stats verified against codebase.

---

## 1. Hacker News — Show HN

**Title:** Show HN: K:BOT -- A terminal AI agent that evolves its own source code

**Body:**

```
I built K:BOT, an open-source terminal AI agent in TypeScript that can diagnose its own weaknesses and improve its own source code.

The self-evolution loop works like this: K:BOT reads its performance data (success rates per domain, confidence calibration errors, tool error rates, TODO/FIXME counts in source) to find weaknesses. It then asks the LLM to propose a minimal code change targeting the weakest area. The proposal gets written to disk, validated with `npx tsc --noEmit` and `npx vitest run`, and scored on a delta function that penalizes lost exports, suspicious LOC reduction, and increased complexity. Positive delta = applied. Negative delta = rolled back. Protected files (auth.ts, cli.ts, tests, configs) are never touched. Everything is logged to ~/.kbot/evolution-log.json.

Beyond self-evolution, kbot is a general-purpose terminal agent with 39 specialist agents auto-routed by intent, 167 built-in tools (file ops, git, GitHub, web search, browser automation, Jupyter notebooks, Docker sandbox, sub-agents, MCP), and 19 AI providers including Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, and 4 local runtimes (Ollama, LM Studio, Jan, OpenClaw). Run `kbot local` with Ollama and it works fully offline at $0. It also exposes an MCP server so editors like VS Code, Cursor, and Neovim can use it as a tool provider.

It's early. About 1K downloads in 2 weeks. The evolution engine has only been live for a few cycles, so the feedback loop data is thin. The scoring function is simple — just LOC, complexity, TODO count, and export preservation — and I'm sure there are better ways to measure code quality. Looking for feedback on the approach, the scoring heuristics, and what's missing.

Install: npm install -g @kernel.chat/kbot
GitHub: https://github.com/isaacsight/kernel
MIT licensed. TypeScript. Node.js 20+.
```

---

## 2. Reddit r/programming

**Title:** I built a terminal AI agent that can improve its own source code

**Body:**

```
I've been working on K:BOT, an open-source terminal AI agent that has a self-evolution loop built in. The idea is simple: what if your AI agent could find its own weak spots and fix them?

Here's how it works. K:BOT tracks its performance — success rates per domain, tool error rates, confidence calibration. When you run `kbot evolve`, it reads that data to find weaknesses, asks the LLM to propose a minimal code fix, then validates it with TypeScript's compiler and the test suite. If the change passes and the quality score improves, it's applied. If not, it's rolled back. Auth, CLI entry, tests, and config files are all protected — it can never touch them.

The agent itself is useful beyond the evolution gimmick:

- **39 specialist agents** auto-routed by intent (coder, researcher, writer, analyst, security, infrastructure, and 33 more)
- **167 built-in tools** — file I/O, git, GitHub API, web search, browser automation, Jupyter notebooks, Docker sandbox, parallel sub-agents, MCP client
- **19 AI providers** — Claude, GPT, Gemini, Mistral, Grok, DeepSeek, Groq, and 4 local runtimes (Ollama, LM Studio, Jan, OpenClaw)
- **Runs fully offline** with Ollama — no API keys, no cost
- **MCP server** for IDE integration (VS Code, Cursor, Neovim, Zed)
- **Learns your patterns** across sessions — routing, coding style, common tasks

It's MIT licensed, written in TypeScript, and published on npm.

Install: `npm install -g @kernel.chat/kbot`
GitHub: https://github.com/isaacsight/kernel

Still early (1K downloads in 2 weeks). Feedback welcome.
```

---

## 3. Reddit r/LocalLLaMA

**Title:** Built a CLI AI agent with native Ollama support -- 39 agents, runs fully offline, $0

**Body:**

```
I built K:BOT, an open-source terminal AI agent with first-class local model support. No API keys needed. No data leaves your machine.

Run `kbot local` and it connects to Ollama automatically. It also supports LM Studio, Jan, and OpenClaw as local backends. You can set your preferred model with `kbot auth` or just let it auto-detect what's running on localhost.

What you get with local models:

- **39 specialist agents** — each with a tuned system prompt for its domain (coding, research, writing, security, infrastructure, etc.). Intent-based routing picks the right one automatically.
- **167 built-in tools** — file read/write, grep, glob, git, GitHub, shell execution, Jupyter notebooks, web search, browser automation, Docker sandbox. All tools run locally. Only the AI reasoning goes through the model.
- **Learning engine** — kbot remembers patterns, solutions, and your coding style across sessions. Stored locally in ~/.kbot/.
- **Self-evolution** — kbot can diagnose its own weaknesses and propose code improvements. Changes are validated with `tsc` and `vitest` before being applied.
- **MCP server** — use kbot as a tool provider in VS Code, Cursor, or Neovim.

The local experience is identical to the cloud experience. Same tools, same agents, same features. The only difference is the model running the reasoning.

Performance depends on your hardware and model. I've been testing with llama3.1:8b and codestral on a MacBook Pro — response times are reasonable for most tasks. Larger models obviously give better results for complex reasoning.

Privacy: everything stays on your machine. Config is in ~/.kbot/, learning data is local, conversations are local. The only network call is to Ollama/LM Studio/Jan running on localhost.

Install: `npm install -g @kernel.chat/kbot`
Then: `kbot local` (assumes Ollama is running)
GitHub: https://github.com/isaacsight/kernel
MIT licensed. TypeScript. Free.
```

---

## 4. Reddit r/commandline

**Title:** K:BOT -- terminal AI agent with 39 specialists, shell completions, and self-evolution

**Body:**

```
I built K:BOT, an AI agent designed to live in your terminal. It's not a wrapper around an API — it's a full agent with 167 local tools, session persistence, and a learning engine.

CLI features that might interest this crowd:

- **Shell completions** for bash, zsh, and fish — `kbot completion bash >> ~/.bashrc`
- **Interactive tutorial** — `kbot tutorial` walks you through features step by step
- **Doctor diagnostics** — `kbot doctor` checks your Node version, API keys, local model availability, and system health
- **Session save/resume** — `kbot session save mysession` / `kbot session load mysession`
- **REPL slash commands** — `/agent coder`, `/plan`, `/matrix`, `/tools`, `/memory`, `/evolve`
- **NO_COLOR support** — respects your terminal preferences
- **Rich TUI mode** — `kbot --tui` for a more visual interface
- **Pipe-friendly** — works with stdin/stdout for scripting
- **MCP server** — `kbot mcp` turns it into a tool provider for your editor

Under the hood: 39 specialist agents auto-routed by intent, 19 AI providers (including Ollama for offline use at $0), and a self-evolution loop where kbot can find and fix its own code weaknesses.

Install: `npm install -g @kernel.chat/kbot`
GitHub: https://github.com/isaacsight/kernel
MIT licensed. TypeScript. Node.js 20+.
```

---

## 5. Reddit r/node

**Title:** Open-source terminal AI agent built in TypeScript -- 167 tools, 19 providers, MCP server

**Body:**

```
I built K:BOT, an open-source terminal AI agent published as `@kernel.chat/kbot` on npm. It's written in TypeScript, runs on Node.js 20+, and uses ESM modules throughout.

Some implementation details that might be interesting to Node/TS developers:

- **Tool registry** — flat parameter schema (not OpenAI-style nested objects). Tools register with `{ name, description, parameters, tier, execute }`. All 167 built-in tools load via `Promise.all([import(...)])` for parallel startup.
- **Multi-provider auth** — supports 19 AI providers with a unified interface. API keys are encrypted at rest with AES-256-CBC. Provider detection auto-identifies keys by prefix.
- **Streaming** — dual implementation for Anthropic and OpenAI streaming formats, with exponential backoff retry.
- **Context manager** — automatic token management with priority-based compaction when conversations get long.
- **MCP server** — `kbot mcp` exposes all tools and agents as an MCP server for IDE integration (VS Code, Cursor, Neovim, Zed). Also has an ACP server implementation.
- **Self-evolution engine** — reads performance metrics, asks the LLM to propose code changes, validates with `tsc --noEmit` + `vitest run`, scores on a delta function, applies or rolls back.
- **Plugin system** — drop a `.ts` file in `~/.kbot/plugins/` and it gets loaded at startup.
- **Commander.js** for CLI, **chalk** for terminal colors, **vitest** for testing.

The agent has 39 specialists auto-routed by intent classification (keyword voting + regex patterns). Each specialist has a tuned system prompt for its domain.

Codebase is about 25K lines of TypeScript. No Tailwind, no React in the CLI — just Node.js, TypeScript, and the terminal.

Install: `npm install -g @kernel.chat/kbot`
GitHub: https://github.com/isaacsight/kernel
MIT licensed. PRs welcome.
```

---

## 6. Dev.to Article

**Title:** Building a Self-Evolving AI Agent in TypeScript

**Subtitle:** How K:BOT diagnoses its own weaknesses and improves its source code

**Tags:** ai, typescript, opensource, programming

**Body:**

```markdown
Most AI agents are static. You build them, ship them, and they stay exactly as they were until someone pushes a new release. I wanted to build one that could improve itself.

K:BOT is an open-source terminal AI agent written in TypeScript. It has 39 specialist agents, 167 built-in tools, and supports 19 AI providers (including Ollama for fully offline, $0 operation). But the feature I'm most interested in feedback on is the **self-evolution engine** — a loop where kbot diagnoses its own weaknesses and proposes code changes to fix them.

Here's how it works.

## Step 1: Diagnose

The `diagnose()` function reads kbot's own performance data from `~/.kbot/` — skill profile success rates, confidence calibration errors, tool error rates, and TODO/FIXME counts in the source code.

```typescript
export function diagnose(): Weakness[] {
  const weaknesses: Weakness[] = []

  // Check skill profile for low success rates
  const skillFile = join(KBOT_DIR, 'skill-profile.json')
  if (existsSync(skillFile)) {
    const skills = JSON.parse(readFileSync(skillFile, 'utf-8')).skills || {}

    for (const [domain, data] of Object.entries(skills)) {
      if (data.sampleSize < 3) continue
      const rate = data.successCount / data.sampleSize
      if (rate < 0.5) {
        weaknesses.push({
          area: domain,
          description: `Low success rate in ${domain} tasks (${Math.round(rate * 100)}%)`,
          severity: rate < 0.3 ? 'high' : 'medium',
          evidence: `${data.successCount}/${data.sampleSize} successes`,
        })
      }
    }
  }

  // Check confidence calibration
  // Check tool error rates
  // Scan for TODO/FIXME/HACK markers
  // ...

  return weaknesses.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
  )
}
```

Each weakness gets a severity level (`high`, `medium`, `low`), a description, and evidence. The function also maps weaknesses to target files — if routing is broken, it points to `learned-router.ts`; if streaming is failing, it points to `streaming.ts`.

## Step 2: Propose

For each weakness (max 3 per cycle), kbot reads the target file, builds a prompt with the weakness details and current source code, and asks the LLM for a minimal fix. The prompt is strict: keep all exports, don't change imports, don't add dependencies, match the coding style.

The response must include a complete file in a TypeScript code block. Partial patches are rejected. If the proposed file is less than 50% the size of the original, it's rejected as suspicious.

## Step 3: Validate

The proposed change gets written to disk, and kbot runs two checks:

1. **TypeScript compiler**: `npx tsc --noEmit`
2. **Test suite**: `npx vitest run`

If either fails, the original file is restored immediately.

```typescript
export function validate(proposal: Proposal): { passes: boolean; errors: string } {
  const absPath = join(kbotRoot, proposal.file)
  writeFileSync(absPath, proposal.patch, 'utf-8')

  try {
    execSync('npx tsc --noEmit', { cwd: kbotRoot, timeout: 60_000 })
  } catch (err) {
    writeFileSync(absPath, proposal.original, 'utf-8') // rollback
    return { passes: false, errors: `Typecheck failed` }
  }

  try {
    execSync('npx vitest run', { cwd: kbotRoot, timeout: 120_000 })
  } catch (err) {
    writeFileSync(absPath, proposal.original, 'utf-8') // rollback
    return { passes: false, errors: `Tests failed` }
  }

  return { passes: true, errors: '' }
}
```

## Step 4: Score

Even if the change passes validation, it still has to improve code quality. The `scoreMetrics()` function measures four things:

```typescript
export function scoreMetrics(source: string): Metrics {
  const lines = source.split('\n')
  const loc = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length

  // Cyclomatic complexity: count branches and loops
  const complexity = (source.match(
    /\b(if|else|for|while|switch|catch|case)\b|\?.*:/g
  ) || []).length

  const todoCount = (source.match(/\b(TODO|FIXME|HACK|XXX)\b/g) || []).length

  const exportCount = (source.match(
    /\bexport\s+(function|const|class|interface|type|enum)\b/g
  ) || []).length

  return { loc, complexity, todoCount, exportCount }
}
```

The `computeDelta()` function compares before and after:

```typescript
export function computeDelta(before: Metrics, after: Metrics): number {
  let delta = 0

  // Fewer TODOs is better
  delta += (before.todoCount - after.todoCount) * 0.2

  // Lower complexity is better
  if (before.complexity > 0) {
    const complexityReduction =
      (before.complexity - after.complexity) / before.complexity
    delta += complexityReduction * 0.3
  }

  // Breaking exports is bad — -1.0 penalty per lost export
  if (after.exportCount < before.exportCount) {
    delta -= (before.exportCount - after.exportCount) * 1.0
  }

  // Slight preference for smaller code, but penalize drastic reduction
  if (before.loc > 0) {
    const locChange = (before.loc - after.loc) / before.loc
    if (locChange > 0 && locChange < 0.3) {
      delta += locChange * 0.1
    } else if (locChange > 0.3) {
      delta -= 0.5  // suspicious: lost too much code
    }
  }

  return Math.round(delta * 1000) / 1000
}
```

If the delta is below -0.1, the change is rolled back even though it passed the compiler and tests.

## Step 5: Apply or Rollback

Applied changes stay on disk. Everything is logged to `~/.kbot/evolution-log.json` — the weakness, the proposal, the validation result, and the score delta. You can see the full history with `kbot evolve status`.

## Safety Rails

This is the part I spent the most time on. A self-modifying program is dangerous if you're not careful:

- **Protected files**: `evolution.ts`, `cli.ts`, `auth.ts`, all tests, `package.json`, `tsconfig.json` — never touched.
- **Git stash**: dirty working tree is stashed before a cycle starts.
- **Max 3 changes per cycle**: bounded blast radius.
- **No auto-publish**: changes stay local until you review and commit.
- **Full rollback**: every original file is stored in memory for instant restoration.

## What's next

The scoring function is simple. I want to add runtime performance measurement (response latency, token usage, user satisfaction signals) as scoring inputs. I'm also experimenting with multi-step evolution — where kbot proposes a refactor across multiple files, not just one at a time.

## Try it

```bash
npm install -g @kernel.chat/kbot
kbot                     # start chatting
kbot evolve              # run one evolution cycle
kbot evolve status       # see evolution history
kbot local               # use Ollama (offline, $0)
kbot doctor              # check system health
```

GitHub: [https://github.com/isaacsight/kernel](https://github.com/isaacsight/kernel)
MIT licensed. TypeScript. Node.js 20+. PRs welcome.

---

*K:BOT also has 39 specialist agents (coder, researcher, writer, analyst, security, infrastructure, and 33 more), 167 built-in tools, 19 AI providers, session persistence, a learning engine, and an MCP server for IDE integration. But the evolution engine is the part I'd most like feedback on.*
```

---

## 7. Twitter/X Thread (5 tweets)

**Tweet 1:**

```
I built an AI agent that evolves its own source code.

It reads its performance data, finds weaknesses, proposes code fixes, validates them with the TypeScript compiler + test suite, scores the improvement, and applies or rolls back.

Here's how it works:
```

**Tweet 2:**

```
The problem: AI agents are static.

You build them, ship them, and they stay exactly the same until someone manually pushes a new version. Every weakness persists until a human notices and fixes it.

What if the agent could find and fix its own weak spots?
```

**Tweet 3:**

```
The self-evolution loop:

1. Diagnose — read success rates, error rates, calibration data
2. Propose — ask the LLM for a minimal code fix
3. Validate — run `tsc --noEmit` + `vitest run`
4. Score — measure LOC, complexity, TODO count, export preservation
5. Apply if score improves. Rollback if it doesn't.

Protected files (auth, CLI, tests) are never touched. Max 3 changes per cycle. Git stash before every run. No auto-publish.
```

**Tweet 4:**

```
K:BOT beyond self-evolution:

- 39 specialist agents, auto-routed by intent
- 167 built-in tools (files, git, GitHub, search, browser, notebooks, sandbox)
- 19 AI providers (Claude, GPT, Gemini, Ollama, and 15 more)
- Runs fully offline with Ollama — $0
- MCP server for VS Code, Cursor, Neovim
- Learns your patterns across sessions

MIT licensed. TypeScript. Open source.
```

**Tweet 5:**

```
Try it:

npm install -g @kernel.chat/kbot

GitHub: github.com/isaacsight/kernel

It's early — 1K downloads in 2 weeks. Looking for feedback on the evolution scoring heuristics especially.

What metrics would you use to measure whether an AI agent's code is getting better?
```

---

## 8. Discord Message (Ollama, LangChain, DevTools servers)

**For #showcase / #projects channels:**

```
Hey all — I built K:BOT, an open-source terminal AI agent with native Ollama support.

What it does:
- 39 specialist agents auto-routed by intent (coder, researcher, writer, security, infra, etc.)
- 167 built-in tools — file I/O, git, GitHub, web search, browser, notebooks, Docker sandbox
- 19 AI providers — works with Claude, GPT, Gemini, or fully offline with Ollama ($0)
- Self-evolution loop — diagnoses its own weaknesses and proposes code fixes (validated with tsc + vitest)
- MCP server — use it as a tool provider in VS Code, Cursor, or Neovim
- Learning engine — remembers your patterns across sessions

Install:
```
npm install -g @kernel.chat/kbot
kbot local   # connects to Ollama automatically
```

GitHub: https://github.com/isaacsight/kernel
MIT licensed, TypeScript, free.

Still early (1K downloads). Feedback welcome — especially on the local model experience and agent routing.
```

---

## Appendix: Key Facts (for consistency across posts)

| Fact | Value | Source |
|------|-------|--------|
| Specialist agents | 39 | ui.ts banner, package.json |
| Built-in tools | 167 | ui.ts banner, package.json |
| AI providers | 19 | auth.ts header comment |
| Local runtimes | 4 (Ollama, LM Studio, Jan, OpenClaw) | auth.ts ByokProvider type |
| Language | TypeScript | tsconfig.json |
| Runtime | Node.js 20+ | package.json engines |
| License | MIT | package.json |
| npm package | @kernel.chat/kbot | package.json |
| GitHub | isaacsight/kernel | package.json repository |
| Protected evolution files | evolution.ts, cli.ts, auth.ts, tests, configs | evolution.ts PROTECTED_FILES |
| Max changes per cycle | 3 | evolution.ts runEvolutionCycle |
| Tool timeout | 5 min default | tools/index.ts DEFAULT_TIMEOUT |
| Tool result limit | 50KB default | tools/index.ts DEFAULT_MAX_RESULT |
| API key encryption | AES-256-CBC | auth.ts |
| Evolution log | ~/.kbot/evolution-log.json | evolution.ts LOG_FILE |
| Max log history | 50 cycles | evolution.ts saveLog |

#!/usr/bin/env node
// K:BOT CLI — Terminal entry point
//
// Usage:
//   $ kbot                        # Interactive REPL
//   $ kbot "fix the auth bug"     # One-shot with inline prompt
//   $ kbot --agent researcher     # Force specific agent
//   $ kbot --model sonnet         # Override model
//   $ kbot auth                   # Configure API key
//   $ kbot usage                  # Show usage stats

import { createInterface } from 'node:readline'
import { Command } from 'commander'
import { loadConfig, setupByok, isByokEnabled, isLocalProvider, disableByok, detectProvider, getByokProvider, PROVIDERS, setupOllama, setupOpenClaw, isOllamaRunning, listOllamaModels, warmOllamaModelCache, detectLocalRuntime, type ByokProvider } from './auth.js'
import { runAndPrint, runAgent, type AgentOptions } from './agent.js'
import { gatherContext, type ProjectContext } from './context.js'
import { registerAllTools } from './tools/index.js'
import { clearHistory, clearMemory, compactHistory, restoreHistory } from './memory.js'
import {
  saveSession, loadSession, listSessions, deleteSession,
  formatSessionList,
} from './sessions.js'
import {
  createAgent, removeAgent, listAgents, getAgent, formatAgentList,
  formatAgentDetail, PRESETS, getMatrixAgentIds,
  activateMimic, listMimicProfiles, getMimicProfile, MIMIC_PROFILES,
  registerBuiltinAgents, formatBuiltinAgentList, formatBuiltinAgentDetail,
} from './matrix.js'
import { getExtendedStats, incrementSessions, learnFact, selfTrain, shouldAutoTrain, getTrainingLog, flushPendingWrites } from './learning.js'
import {
  banner,
  bannerCompact,
  bannerAuth,
  matrixConnect,
  prompt as kbotPrompt,
  printError,
  printSuccess,
  printInfo,
  printResponse,
  printHelp,
  printGoodbye,
  divider,
  setQuiet,
} from './ui.js'
import { checkForUpdate, selfUpdate } from './updater.js'
import { syncOnStartup, schedulePush, flushCloudSync, isCloudSyncEnabled, setCloudToken, getCloudToken } from './cloud-sync.js'
import chalk from 'chalk'

const VERSION = '2.9.0'

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('kbot')
    .description('K:BOT — Open-source terminal AI agent. Bring your own key, pick your model, run locally.')
    .version(VERSION)
    .option('-a, --agent <agent>', 'Force a specific agent (kernel, researcher, coder, writer, analyst, hacker, operator, dreamer)')
    .option('-m, --model <model>', 'Override AI model (auto, sonnet, haiku)')
    .option('-s, --stream', 'Stream the response')
    .option('-p, --pipe', 'Pipe mode — raw text output for scripting')
    .option('--json', 'JSON output for scripting')
    .option('-y, --yes', 'Skip all confirmation prompts')
    .option('-q, --quiet', 'Minimal output — no banners, spinners, or status')
    .option('--resume [session]', 'Resume a saved session')
    .option('--computer-use', 'Enable computer use tools')
    .option('-t, --thinking', 'Show AI reasoning steps')
    .option('--thinking-budget <tokens>', 'Thinking token budget (default: 10000)')
    .option('--self-eval', 'Enable self-evaluation loop (score and retry low-quality responses)')
    .option('--architect', 'Architect mode — plan-review-implement with dual agents')
    .option('--safe', 'Confirm destructive operations')
    .option('--strict', 'Confirm ALL operations')
    .argument('[prompt...]', 'One-shot prompt')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .action(() => { /* default action — handled below */ })

  // Sub-commands
  const ideCmd = program
    .command('ide')
    .description('Start IDE protocol server (MCP, ACP)')

  ideCmd
    .command('mcp')
    .description('Start MCP server for VS Code, Cursor, Windsurf, Zed')
    .action(async () => {
      const { startMcpServer } = await import('./ide/mcp-server.js')
      await startMcpServer()
    })

  ideCmd
    .command('acp')
    .description('Start ACP server for JetBrains IDEs (IntelliJ, WebStorm, PyCharm)')
    .action(async () => {
      const { startAcpServer } = await import('./ide/acp-server.js')
      await startAcpServer()
    })

  ideCmd
    .command('status')
    .description('Show IDE bridge status')
    .action(async () => {
      const { initBridge, getStatus } = await import('./ide/bridge.js')
      await initBridge()
      const status = getStatus()
      printInfo('K:BOT IDE Bridge Status')
      printInfo(`  Version:      ${status.version}`)
      printInfo(`  Agent:        ${status.agent}`)
      printInfo(`  Tier:         ${status.tier}`)
      printInfo(`  Tools:        ${status.toolCount}`)
      printInfo(`  Patterns:     ${status.learning.patternsCount}`)
      printInfo(`  Knowledge:    ${status.learning.knowledgeCount}`)
      printInfo(`  Sessions:     ${status.sessionCount}`)
      console.log()
      printInfo('Protocols:')
      printInfo('  kbot ide mcp    — VS Code, Cursor, Windsurf, Zed, Neovim')
      printInfo('  kbot ide acp    — IntelliJ, WebStorm, PyCharm, GoLand, Android Studio')
    })

  program
    .command('byok')
    .description('Bring Your Own Key — configure your LLM API key (19 providers)')
    .option('--off', 'Disable BYOK mode')
    .action(async (opts: { off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('BYOK provider disabled.')
        return
      }
      await byokFlow()
    })

  // Alias: `kbot auth` → same as `kbot byok` (more intuitive name)
  program
    .command('auth')
    .description('Configure your LLM API key (alias for byok)')
    .option('--off', 'Disable provider')
    .action(async (opts: { off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('Provider disabled.')
        return
      }
      await byokFlow()
    })

  program
    .command('update')
    .description('Update kbot to the latest version')
    .action(() => {
      selfUpdate(VERSION, (msg) => {
        if (msg.startsWith('Already') || msg.startsWith('Updated')) printSuccess(msg)
        else if (msg.startsWith('Permission') || msg.startsWith('Update failed') || msg.startsWith('Could not')) printError(msg)
        else printInfo(msg)
      })
    })

  program
    .command('cloud')
    .description('Connect to kernel.chat for cloud sync across machines')
    .option('--token <token>', 'Set your kernel.chat token (JWT or API key)')
    .option('--off', 'Disable cloud sync')
    .option('--status', 'Show cloud sync status')
    .option('--push', 'Force push local data to cloud')
    .option('--pull', 'Force pull cloud data to local')
    .action(async (opts: { token?: string; off?: boolean; status?: boolean; push?: boolean; pull?: boolean }) => {
      if (opts.off) {
        setCloudToken('')
        printSuccess('Cloud sync disabled.')
        return
      }
      if (opts.status) {
        const enabled = isCloudSyncEnabled()
        const token = getCloudToken()
        if (enabled) {
          const masked = token!.startsWith('kn_live_')
            ? `kn_live_...${token!.slice(-4)}`
            : `jwt...${token!.slice(-8)}`
          printInfo(`Cloud sync: enabled (${masked})`)
        } else {
          printInfo('Cloud sync: not configured')
          printInfo('Connect: kbot cloud --token <your-token>')
        }
        return
      }
      if (opts.push) {
        const { pushToCloud } = await import('./cloud-sync.js')
        printInfo('Pushing learning data to cloud...')
        const ok = await pushToCloud()
        if (ok) printSuccess('Pushed to cloud.')
        else printError('Push failed. Check your token.')
        return
      }
      if (opts.pull) {
        const { pullFromCloud } = await import('./cloud-sync.js')
        printInfo('Pulling learning data from cloud...')
        const result = await pullFromCloud()
        if (result.synced) printSuccess('Pulled from cloud.')
        else if (result.source === 'local') printInfo('Local data is already up to date.')
        else printError('Pull failed. Check your token.')
        return
      }
      if (opts.token) {
        setCloudToken(opts.token)
        printSuccess('Cloud sync enabled. Your learning data will sync across machines.')
        return
      }
      // No options — show usage
      printInfo('Cloud sync — persist learning data across machines via kernel.chat')
      printInfo('')
      printInfo('  kbot cloud --token <token>   Connect to kernel.chat')
      printInfo('  kbot cloud --status          Show sync status')
      printInfo('  kbot cloud --push            Force push to cloud')
      printInfo('  kbot cloud --pull            Force pull from cloud')
      printInfo('  kbot cloud --off             Disable sync')
    })

  program
    .command('ollama')
    .description('Use Ollama for local AI models (no API key needed)')
    .option('--model <model>', 'Set default Ollama model')
    .option('--list', 'List available Ollama models')
    .option('--off', 'Disable Ollama mode')
    .action(async (opts: { model?: string; list?: boolean; off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('Ollama disabled. Provider disabled.')
        return
      }
      if (opts.list) {
        const running = await isOllamaRunning()
        if (!running) { printError('Ollama is not running. Start it with: ollama serve'); return }
        const models = await listOllamaModels()
        if (models.length === 0) { printError('No models found. Pull one with: ollama pull llama3.1:8b'); return }
        printInfo('Available Ollama models:')
        for (const m of models) printInfo(`  • ${m}`)
        return
      }
      const running = await isOllamaRunning()
      if (!running) { printError('Ollama is not running. Start it with: ollama serve'); return }
      const ok = await setupOllama(opts.model)
      if (ok) {
        const models = await listOllamaModels()
        printSuccess(`Ollama enabled! Using local models (${models.length} available). $0 cost.`)
        printInfo(`Default model: ${opts.model || PROVIDERS.ollama.defaultModel}`)
        printInfo('Switch models: kbot ollama --model <name>')
      } else {
        printError('Failed to connect to Ollama. Is it running? Try: ollama serve')
      }
    })

  program
    .command('doctor')
    .description('Diagnose your kbot setup — check everything is working')
    .action(async () => {
      process.stderr.write('\n')
      printInfo('K:BOT Doctor — Checking your setup...')
      process.stderr.write('\n')

      // 1. Check BYOK provider
      const config = loadConfig()
      if (config?.byok_enabled && config?.byok_provider) {
        const p = PROVIDERS[config.byok_provider]
        printSuccess(`BYOK provider: ${p?.name || config.byok_provider}`)
      }

      // 3. Check Ollama
      const ollamaUp = await isOllamaRunning()
      if (ollamaUp) {
        const models = await listOllamaModels()
        printSuccess(`Ollama: running (${models.length} models)`)
        for (const m of models) printInfo(`    ${m}`)
      } else {
        printInfo('  Ollama: not running (optional — run: ollama serve)')
      }

      // 4. Check OpenClaw
      try {
        const res = await fetch('http://127.0.0.1:18789/health', { signal: AbortSignal.timeout(2000) })
        if (res.ok) {
          printSuccess('OpenClaw: gateway running at 127.0.0.1:18789')
        } else {
          printInfo('  OpenClaw: gateway not responding (optional)')
        }
      } catch {
        printInfo('  OpenClaw: gateway offline (optional — run: openclaw-cmd start)')
      }

      // 5. Check Docker (for sandbox tools)
      try {
        const { execSync } = await import('node:child_process')
        execSync('docker info', { timeout: 5000, stdio: 'pipe' })
        printSuccess('Docker: running (sandbox execution available)')
      } catch {
        printInfo('  Docker: not running (optional — needed for sandbox_run)')
      }

      // 6. Check git
      try {
        const { execSync } = await import('node:child_process')
        const ver = execSync('git --version', { encoding: 'utf-8', timeout: 3000 }).trim()
        printSuccess(`Git: ${ver}`)
      } catch {
        printError('Git: not found (needed for git tools)')
      }

      // 7. Check Node.js version
      printSuccess(`Node.js: ${process.version}`)

      // 8. Check config directory
      const { existsSync } = await import('node:fs')
      const { homedir } = await import('node:os')
      const { join } = await import('node:path')
      const kbotDir = join(homedir(), '.kbot')
      if (existsSync(kbotDir)) {
        printSuccess(`Config: ${kbotDir}`)
      } else {
        printInfo(`  Config directory will be created at: ${kbotDir}`)
      }

      process.stderr.write('\n')
      // Summary
      const hasProvider = !!((config?.byok_enabled && config?.byok_provider) || ollamaUp)
      if (hasProvider) {
        printSuccess('Ready to go! Run: kbot')
      } else {
        printInfo('Get started with one of:')
        printInfo('  kbot ollama    — Free local AI')
        printInfo('  kbot byok      — Use your own API key')
      }
      process.stderr.write('\n')
    })

  program
    .command('pull')
    .description('Download recommended Ollama models for local AI')
    .option('--model <model>', 'Pull a specific model')
    .action(async (opts: { model?: string }) => {
      const running = await isOllamaRunning()
      if (!running) { printError('Ollama is not running. Start with: ollama serve'); return }

      if (opts.model) {
        printInfo(`Pulling ${opts.model}...`)
        try {
          const { execSync } = await import('node:child_process')
          execSync(`ollama pull ${opts.model}`, { stdio: 'inherit', timeout: 600_000 })
          printSuccess(`${opts.model} ready!`)
        } catch {
          printError(`Failed to pull ${opts.model}`)
        }
        return
      }

      const models = await listOllamaModels()
      const recommended = [
        { name: 'qwen2.5-coder:7b', desc: 'Best for coding (4.7 GB)', category: 'code' },
        { name: 'llama3.1:8b', desc: 'General purpose (4.9 GB)', category: 'general' },
        { name: 'mistral:7b', desc: 'General purpose (4.4 GB)', category: 'general' },
        { name: 'phi4:14b', desc: 'Reasoning & analysis (8.4 GB)', category: 'reasoning' },
        { name: 'gemma3:12b', desc: 'Writing & research (8.1 GB)', category: 'general' },
        { name: 'deepseek-coder-v2:16b', desc: 'Advanced coding (9.7 GB)', category: 'code' },
        { name: 'codellama:13b', desc: 'Meta code model (7.4 GB)', category: 'code' },
        { name: 'starcoder2:7b', desc: 'Code completion (4.0 GB)', category: 'code' },
        { name: 'llama3.2:3b', desc: 'Lightweight fast model (2.0 GB)', category: 'general' },
        { name: 'codegemma:7b', desc: 'Google code model (5.0 GB)', category: 'code' },
        { name: 'nemotron-mini', desc: 'NVIDIA Nemotron Mini 4B (2.5 GB)', category: 'general' },
        { name: 'nemotron-3-nano', desc: 'NVIDIA Nemotron 3 Nano 8B (4.5 GB)', category: 'reasoning' },
        { name: 'nomic-embed-text', desc: 'Embeddings model (274 MB)', category: 'embeddings' },
      ]

      printInfo('Recommended models for kbot:')
      console.log()
      for (const rec of recommended) {
        const installed = models.some(m => m.startsWith(rec.name.split(':')[0]))
        const icon = installed ? '  ✓' : '  ○'
        const status = installed ? '(installed)' : ''
        printInfo(`${icon} ${rec.name.padEnd(25)} ${rec.desc} ${status}`)
      }
      console.log()
      const missing = recommended.filter(r => !models.some(m => m.startsWith(r.name.split(':')[0])))
      if (missing.length === 0) {
        printSuccess('All recommended models installed!')
      } else {
        printInfo(`Pull missing models: kbot pull --model <name>`)
        printInfo(`Or pull all: ${missing.map(m => `ollama pull ${m.name}`).join(' && ')}`)
      }
    })

  program
    .command('serve')
    .description('Start HTTP server — expose all 151 tools for kernel.chat or any client')
    .option('-p, --port <port>', 'Port to listen on', '7437')
    .option('--token <token>', 'Require auth token for all requests')
    .option('--computer-use', 'Enable computer use tools')
    .action(async (opts: { port: string; token?: string; computerUse?: boolean }) => {
      const { startServe } = await import('./serve.js')
      await startServe({
        port: parseInt(opts.port, 10),
        token: opts.token,
        computerUse: opts.computerUse,
      })
    })

  program
    .command('openclaw')
    .description('Use OpenClaw gateway as AI provider')
    .option('--token <token>', 'Gateway auth token')
    .option('--off', 'Disable OpenClaw mode')
    .action(async (opts: { token?: string; off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('OpenClaw disabled. Provider disabled.')
        return
      }
      const ok = await setupOpenClaw(opts.token)
      if (ok) {
        printSuccess('OpenClaw enabled! Connected to local gateway at 127.0.0.1:18789.')
      } else {
        printError('Cannot connect to OpenClaw gateway. Start it first.')
      }
    })


  program
    .command('agents [name]')
    .description('List all available agents, or show details for one')
    .action(async (name?: string) => {
      registerBuiltinAgents()
      if (name) {
        const detail = formatBuiltinAgentDetail(name)
        if (detail) {
          console.log(detail)
        } else {
          printError(`Agent "${name}" not found.`)
          printInfo('Run `kbot agents` to see all available agents.')
        }
      } else {
        console.log(formatBuiltinAgentList())
        console.log()
        printInfo('Use: kbot --agent <name> "prompt"')
      }
    })

  program.parse(process.argv)

  const opts = program.opts()
  const promptArgs = program.args

  // Quiet mode: suppress banners, spinners, status messages
  if (opts.quiet) setQuiet(true)

  // If a sub-command was run, we're done
  if (['byok', 'auth', 'ide', 'ollama', 'openclaw', 'pull', 'doctor', 'serve', 'agents'].includes(program.args[0])) return

  // Check for API key (BYOK or local provider)
  let byokActive = isByokEnabled()
  let localActive = byokActive && isLocalProvider(getByokProvider())

  // AUTO-SETUP: If no provider configured, try to auto-detect and configure one
  if (!byokActive) {
    // Priority 1: Check environment variables (instant, no network)
    const envDetected = autoDetectFromEnv()
    if (envDetected) {
      byokActive = true
      localActive = isLocalProvider(envDetected)
      printSuccess(`Auto-detected ${PROVIDERS[envDetected].name} from environment.`)
    }

    // Priority 2: Check local providers in PARALLEL (all at once, use whichever responds first)
    if (!byokActive) {
      const { isLmStudioRunning, isJanRunning, setupLmStudio, setupJan } = await import('./auth.js')
      const [ollamaResult, lmstudioResult, janResult, openclawResult] = await Promise.allSettled([
        // Check Ollama
        (async () => {
          const up = await isOllamaRunning()
          if (!up) return null
          const models = await listOllamaModels()
          if (models.length === 0) return null
          const ok = await setupOllama()
          return ok ? { provider: 'ollama' as const, models: models.length } : null
        })(),
        // Check LM Studio
        (async () => {
          const up = await isLmStudioRunning()
          if (!up) return null
          const ok = await setupLmStudio()
          return ok ? { provider: 'lmstudio' as const } : null
        })(),
        // Check Jan
        (async () => {
          const up = await isJanRunning()
          if (!up) return null
          const ok = await setupJan()
          return ok ? { provider: 'jan' as const } : null
        })(),
        // Check OpenClaw
        (async () => {
          try {
            const res = await fetch('http://127.0.0.1:18789/health', { signal: AbortSignal.timeout(1500) })
            if (!res.ok) return null
            const ok = await setupOpenClaw()
            return ok ? { provider: 'openclaw' as const } : null
          } catch { return null }
        })(),
      ])

      // Prefer Ollama > LM Studio > Jan > OpenClaw
      const ollamaOk = ollamaResult.status === 'fulfilled' && ollamaResult.value
      const lmstudioOk = lmstudioResult.status === 'fulfilled' && lmstudioResult.value
      const janOk = janResult.status === 'fulfilled' && janResult.value
      const openclawOk = openclawResult.status === 'fulfilled' && openclawResult.value

      if (ollamaOk) {
        byokActive = true
        localActive = true
        printSuccess(`Auto-configured Ollama (${ollamaOk.models} models). Ready — $0 cost!`)
      } else if (lmstudioOk) {
        byokActive = true
        localActive = true
        printSuccess('Auto-configured LM Studio. Ready — $0 cost!')
      } else if (janOk) {
        byokActive = true
        localActive = true
        printSuccess('Auto-configured Jan. Ready — $0 cost!')
      } else if (openclawOk) {
        byokActive = true
        localActive = true
        printSuccess('Auto-configured OpenClaw gateway. Ready — $0 cost!')
      }
    }

    // Still no provider — launch guided setup for new users
    if (!byokActive) {
      const result = await guidedSetup()
      if (!result) return
      byokActive = true
      localActive = result.local
    }
  }

  /** Auto-detect provider from environment variables */
  function autoDetectFromEnv(): ByokProvider | null {
    const envKeys: Array<{ env: string; provider: ByokProvider }> = [
      { env: 'ANTHROPIC_API_KEY', provider: 'anthropic' },
      { env: 'OPENAI_API_KEY', provider: 'openai' },
      { env: 'GOOGLE_API_KEY', provider: 'google' },
      { env: 'MISTRAL_API_KEY', provider: 'mistral' },
      { env: 'XAI_API_KEY', provider: 'xai' },
      { env: 'DEEPSEEK_API_KEY', provider: 'deepseek' },
      { env: 'GROQ_API_KEY', provider: 'groq' },
      { env: 'TOGETHER_API_KEY', provider: 'together' },
      { env: 'FIREWORKS_API_KEY', provider: 'fireworks' },
      { env: 'PERPLEXITY_API_KEY', provider: 'perplexity' },
      { env: 'COHERE_API_KEY', provider: 'cohere' },
      { env: 'NVIDIA_API_KEY', provider: 'nvidia' },
      { env: 'SAMBANOVA_API_KEY', provider: 'sambanova' },
      { env: 'CEREBRAS_API_KEY', provider: 'cerebras' },
      { env: 'OPENROUTER_API_KEY', provider: 'openrouter' },
    ]
    for (const { env, provider } of envKeys) {
      if (process.env[env]) return provider
    }
    return null
  }

  // Permission mode: autonomous by default, users opt-in to confirmations
  {
    const { setPermissionMode } = await import('./permissions.js')
    if (opts.yes) {
      // --yes / -y: skip all confirmations (for scripts & CI)
      setPermissionMode('permissive')
    } else if (opts.strict) {
      setPermissionMode('strict')
    } else if (opts.safe || process.env.KBOT_SAFE) {
      setPermissionMode('normal')
    } else {
      // DEFAULT: permissive — kbot acts autonomously, no confirmation prompts
      setPermissionMode('permissive')
    }
  }

  // Register built-in agents (hacker, operator, dreamer) so --agent flag works
  registerBuiltinAgents()

  // Parallel startup: register tools, gather context, check updates, and cloud sync
  const [, context, , syncMsg] = await Promise.all([
    registerAllTools({ computerUse: opts.computerUse }),
    Promise.resolve(gatherContext()),
    // Non-blocking update check — fire and forget
    Promise.resolve().then(() => {
      try {
        const msg = checkForUpdate(VERSION)
        if (msg) printSuccess(msg)
      } catch { /* non-critical */ }
    }),
    // Cloud sync — pull latest learning data if available
    syncOnStartup().catch(() => null),
  ])
  if (syncMsg) printInfo(syncMsg)

  const config = loadConfig()
  const tier = 'free'

  const agentOpts: AgentOptions = {
    agent: opts.agent || 'auto',
    model: opts.model,
    stream: opts.stream ?? true, // Stream by default for faster perceived response
    context,
    tier,
    thinking: opts.thinking || false,
    thinkingBudget: opts.thinkingBudget ? (parseInt(opts.thinkingBudget, 10) || 10000) : undefined,
  }

  // Enable self-evaluation if requested
  if (opts.selfEval) {
    const { setSelfEvalEnabled } = await import('./self-eval.js')
    setSelfEvalEnabled(true)
  }

  // Pipe mode: echo "prompt" | kbot -p  OR  kbot -p "prompt"
  if (opts.pipe) {
    let message = promptArgs.join(' ')
    if (!message && !process.stdin.isTTY) {
      // Read from stdin pipe
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      message = Buffer.concat(chunks).toString('utf-8').trim()
    }
    if (!message) {
      process.stderr.write('Error: no prompt provided\n')
      process.exit(1)
    }
    try {
      const response = await runAgent(message, agentOpts)
      if (opts.json) {
        process.stdout.write(JSON.stringify({
          content: response.content,
          agent: response.agent,
          model: response.model,
          toolCalls: response.toolCalls,
          usage: response.usage,
        }) + '\n')
      } else {
        process.stdout.write(response.content + '\n')
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(1)
    }
    return
  }

  // Resume session if --resume flag is used
  if (opts.resume) {
    const sessionId = typeof opts.resume === 'string' ? opts.resume : undefined
    if (sessionId) {
      const session = loadSession(sessionId)
      if (session) {
        restoreHistory(session.history)
        if (session.agent) agentOpts.agent = session.agent
        printSuccess(`Resumed session: ${session.name} (${session.turnCount} turns)`)
      } else {
        printError(`Session not found: ${sessionId}`)
        printInfo('Run /sessions to list saved sessions.')
      }
    } else {
      // Resume most recent session
      const { getLastSession } = await import('./sessions.js')
      const last = getLastSession()
      if (last) {
        restoreHistory(last.history)
        if (last.agent) agentOpts.agent = last.agent
        printSuccess(`Resumed last session: ${last.name}`)
      } else {
        printInfo('No previous sessions found.')
      }
    }
  }

  // Stdin pipe composability: cat file.txt | kbot "explain this"
  // Read stdin BEFORE one-shot check, so it's available for both paths
  let stdinContent = ''
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    stdinContent = Buffer.concat(chunks).toString('utf-8').trim()
  }

  // One-shot mode: kbot "fix the bug" — always stream for speed
  if (promptArgs.length > 0 && !['byok', 'auth', 'ide', 'ollama', 'openclaw', 'pull', 'doctor'].includes(promptArgs[0])) {
    if (!opts.pipe) console.log(bannerCompact())
    let message = promptArgs.join(' ')
    // If stdin was piped in, prepend it as context
    if (stdinContent) {
      message = `${stdinContent}\n\n---\n${message}`
    }
    // JSON output mode — structured output for scripting
    if (opts.json) {
      agentOpts.stream = false // No streaming for JSON mode
      const response = await runAgent(message, agentOpts)
      process.stdout.write(JSON.stringify({
        content: response.content,
        agent: response.agent,
        model: response.model,
        toolCalls: response.toolCalls,
        usage: response.usage,
      }) + '\n')
      return
    }
    // Architect mode: plan-review-implement with dual agents
    if (opts.architect) {
      const { runArchitectMode } = await import('./architect.js')
      await runArchitectMode(message, agentOpts)
      return
    }
    agentOpts.stream = true // Force streaming for faster one-shot
    await runAndPrint(message, agentOpts)
    return
  }

  // Stdin-only mode: echo "what is 2+2" | kbot (no prompt args, just piped input)
  if (stdinContent && promptArgs.length === 0) {
    if (opts.json) {
      agentOpts.stream = false
      const response = await runAgent(stdinContent, agentOpts)
      process.stdout.write(JSON.stringify({
        content: response.content,
        agent: response.agent,
        model: response.model,
        toolCalls: response.toolCalls,
        usage: response.usage,
      }) + '\n')
      return
    }
    agentOpts.stream = true
    await runAndPrint(stdinContent, agentOpts)
    return
  }

  // Interactive REPL mode
  await startRepl(agentOpts, context, tier, byokActive, localActive)
}

async function byokFlow(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(bannerAuth())
  printInfo('BYOK Mode — Bring Your Own Key')
  printInfo('Use your own LLM API key. You pay the provider directly for tokens.')
  printInfo('Kernel routing + tools + collective intelligence are free.')
  console.log()
  printInfo('Supported providers (14):')
  printInfo('  Anthropic (Claude)    OpenAI (GPT)       Google (Gemini)')
  printInfo('  Mistral AI            xAI (Grok)         DeepSeek')
  printInfo('  Groq                  Together AI        Fireworks AI')
  printInfo('  Perplexity            Cohere             NVIDIA NIM')
  printInfo('  Ollama (local, free)  OpenClaw (local gateway)')
  console.log()
  printInfo('Paste your API key (auto-detected by prefix):')
  console.log()

  const key = await new Promise<string>((resolve) => {
    rl.question('  > ', (answer) => {
      resolve(answer.trim())
      rl.close()
    })
  })

  if (!key || key.length < 10) {
    printError('Invalid key. Please provide a valid API key.')
    process.exit(1)
  }

  // Try auto-detect first
  let provider = detectProvider(key)

  // If we can't detect, ask user to pick
  if (!provider) {
    console.log()
    printInfo('Could not auto-detect provider. Which provider is this key for?')
    const providerList = Object.entries(PROVIDERS).map(([id, p], i) => `  ${i + 1}. ${p.name} (${id})`).join('\n')
    console.log(providerList)
    console.log()

    const rl2 = createInterface({ input: process.stdin, output: process.stdout })
    const choice = await new Promise<string>((resolve) => {
      rl2.question('  Enter number or provider id: ', (answer) => {
        resolve(answer.trim())
        rl2.close()
      })
    })

    const providerIds = Object.keys(PROVIDERS) as ByokProvider[]
    const num = parseInt(choice, 10)
    if (num >= 1 && num <= providerIds.length) {
      provider = providerIds[num - 1]
    } else if (providerIds.includes(choice as ByokProvider)) {
      provider = choice as ByokProvider
    } else {
      printError('Invalid provider selection.')
      process.exit(1)
    }
  }

  const providerConfig = PROVIDERS[provider]
  printInfo(`Provider: ${providerConfig.name}`)
  printInfo(`Models: ${providerConfig.defaultModel} / ${providerConfig.fastModel}`)
  printInfo('Verifying key...')

  const ok = await setupByok(key, provider)

  if (!ok) {
    printError(`Key verification failed. Check your ${providerConfig.name} API key.`)
    process.exit(1)
  }

  console.log()
  printSuccess(`BYOK mode enabled — ${providerConfig.name}`)
  printInfo('You pay the provider directly. No message limits. No restrictions.')
  printInfo('All 81 tools + 17 agents + learning system = yours.')
  console.log()
  printSuccess('Ready. Run `kbot` to start.')
}

/** Guided setup for first-time users who have no AI experience */
async function guidedSetup(): Promise<{ local: boolean } | null> {
  console.log(banner(VERSION))
  console.log()
  console.log(chalk.bold('  Hey! I\'m K:BOT — your AI assistant for the terminal.'))
  console.log()
  console.log(chalk.dim('  I can write code, answer questions, search the web, manage git,'))
  console.log(chalk.dim('  and a lot more. First, I need an AI brain. Pick one:'))
  console.log()
  console.log(`  ${chalk.bold('1.')} ${chalk.hex('#6B8E6B')('Free & Private')} — Run AI on your computer (no account, no cost)`)
  console.log(`  ${chalk.bold('2.')} ${chalk.hex('#5B8BA0')('Cloud AI')} — Use an API key (OpenAI, Google, Anthropic, etc.)`)
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const choice = await new Promise<string>((resolve) => {
    rl.question('  Pick 1 or 2 (or q to quit): ', (answer) => {
      resolve(answer.trim().toLowerCase())
    })
  })

  if (choice === 'q' || choice === 'quit') {
    rl.close()
    return null
  }

  if (choice === '1' || choice === 'free' || choice === 'local') {
    rl.close()
    console.log()

    // Check if Ollama is already installed and running
    const running = await isOllamaRunning()
    if (running) {
      const models = await listOllamaModels()
      if (models.length > 0) {
        const ok = await setupOllama()
        if (ok) {
          printSuccess(`Found Ollama with ${models.length} model(s). You're ready!`)
          return { local: true }
        }
      } else {
        printInfo('Ollama is running but has no models. Downloading one now...')
        try {
          const { execSync } = await import('node:child_process')
          printInfo('Pulling llama3.2:3b (small & fast, 2GB download)...')
          execSync('ollama pull llama3.2:3b', { stdio: 'inherit', timeout: 600_000 })
          const ok = await setupOllama('llama3.2:3b')
          if (ok) {
            printSuccess('Done! Local AI is ready.')
            return { local: true }
          }
        } catch {
          printError('Download failed. Try manually: ollama pull llama3.2:3b')
          return null
        }
      }
    }

    // Ollama not running or not installed
    console.log(chalk.bold('  To run AI locally, you need Ollama (free, 1 minute install):'))
    console.log()
    console.log(`  ${chalk.bold('Step 1:')} Download Ollama from ${chalk.underline('https://ollama.com')}`)
    console.log(`  ${chalk.bold('Step 2:')} Open the Ollama app (it runs in the background)`)
    console.log(`  ${chalk.bold('Step 3:')} Run: ${chalk.cyan('kbot')} again — it will auto-detect Ollama`)
    console.log()
    printInfo('Ollama is like having ChatGPT on your computer — free, private, no account needed.')
    console.log()
    return null
  }

  if (choice === '2' || choice === 'cloud' || choice === 'api') {
    console.log()
    console.log(chalk.dim('  Paste your API key below. K:BOT will auto-detect which service it\'s from.'))
    console.log()
    console.log(chalk.dim('  Where to get a key:'))
    console.log(chalk.dim('    OpenAI:    https://platform.openai.com/api-keys'))
    console.log(chalk.dim('    Google:    https://aistudio.google.com/apikey'))
    console.log(chalk.dim('    Anthropic: https://console.anthropic.com/settings/keys'))
    console.log()

    const key = await new Promise<string>((resolve) => {
      rl.question('  API key: ', (answer) => {
        resolve(answer.trim())
        rl.close()
      })
    })

    if (!key || key.length < 10) {
      printError('That doesn\'t look like a valid API key. Try again with: kbot auth')
      return null
    }

    let provider = detectProvider(key)

    if (!provider) {
      // Ask which provider with simple numbered list
      console.log()
      console.log(chalk.dim('  Couldn\'t auto-detect the provider. Which service is this key for?'))
      const mainProviders: Array<{ id: ByokProvider; name: string }> = [
        { id: 'openai', name: 'OpenAI (ChatGPT)' },
        { id: 'google', name: 'Google (Gemini)' },
        { id: 'anthropic', name: 'Anthropic (Claude)' },
        { id: 'mistral', name: 'Mistral AI' },
        { id: 'deepseek', name: 'DeepSeek' },
        { id: 'groq', name: 'Groq' },
      ]
      for (let i = 0; i < mainProviders.length; i++) {
        console.log(`  ${i + 1}. ${mainProviders[i].name}`)
      }
      console.log()

      const rl2 = createInterface({ input: process.stdin, output: process.stdout })
      const providerChoice = await new Promise<string>((resolve) => {
        rl2.question('  Enter number: ', (a) => { resolve(a.trim()); rl2.close() })
      })
      const idx = parseInt(providerChoice, 10) - 1
      if (idx >= 0 && idx < mainProviders.length) {
        provider = mainProviders[idx].id
      } else {
        printError('Invalid choice. Run kbot auth to try again.')
        return null
      }
    }

    printInfo(`Setting up ${PROVIDERS[provider].name}...`)
    const ok = await setupByok(key, provider)
    if (ok) {
      console.log()
      printSuccess(`Connected to ${PROVIDERS[provider].name}! You're ready.`)
      return { local: isLocalProvider(provider) }
    } else {
      printError('Could not verify that key. Double-check it and try: kbot auth')
      return null
    }
  }

  rl.close()
  printError('Pick 1 or 2. Run kbot again to retry.')
  return null
}

async function startRepl(
  agentOpts: AgentOptions,
  context: ProjectContext,
  tier: string,
  byokActive = false,
  localActive = false,
): Promise<void> {
  console.log(banner(VERSION))

  // Show provider status — one clean line
  if (localActive) {
    const config = loadConfig()
    const provider = config?.byok_provider
    if (provider === 'ollama') {
      const models = await warmOllamaModelCache()
      printInfo(`Ollama · ${models.length} models · free`)
    } else if (provider === 'openclaw') {
      printInfo('OpenClaw · local · free')
    }
  } else if (byokActive) {
    const config = loadConfig()
    const p = config?.byok_provider ? PROVIDERS[config.byok_provider] : null
    if (p) printInfo(`${p.name}`)
  }

  const sessionCount = incrementSessions()

  // Return-visit greeting — show kbot's growth
  if (sessionCount > 1) {
    const stats = getExtendedStats()
    const parts: string[] = []
    if (stats.patternsCount > 0) parts.push(`${stats.patternsCount} patterns learned`)
    if (stats.solutionsCount > 0) parts.push(`${stats.solutionsCount} solutions cached`)
    if (stats.knowledgeCount > 0) parts.push(`${stats.knowledgeCount} facts remembered`)
    if (parts.length > 0) {
      printInfo(`Session ${stats.sessions} · ${parts.join(' · ')}`)
    }
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: kbotPrompt(),
  })

  // First time? Show a friendly walkthrough
  if (sessionCount <= 1) {
    console.log()
    console.log(chalk.dim('  ┌─────────────────────────────────────────────┐'))
    console.log(chalk.dim('  │') + chalk.bold('  Welcome! Here are some things you can try: ') + chalk.dim(' │'))
    console.log(chalk.dim('  │                                             │'))
    console.log(chalk.dim('  │') + '  "explain this project"                    ' + chalk.dim('  │'))
    console.log(chalk.dim('  │') + '  "write a function that sorts names"       ' + chalk.dim('  │'))
    console.log(chalk.dim('  │') + '  "find all TODO comments in this repo"     ' + chalk.dim('  │'))
    console.log(chalk.dim('  │') + '  "what files are in this directory?"        ' + chalk.dim('  │'))
    console.log(chalk.dim('  │                                             │'))
    console.log(chalk.dim('  │') + chalk.dim('  Type /help for more commands.              ') + chalk.dim(' │'))
    console.log(chalk.dim('  └─────────────────────────────────────────────┘'))
    console.log()
  } else if (sessionCount <= 3) {
    // Second and third time — show a quick tip they might not know
    const tips = [
      'Tip: kbot picks the right specialist for you. Try asking about science, code, or writing.',
      'Tip: Type /save to keep this conversation. /resume to pick it up later.',
      'Tip: kbot learns from you. The more you use it, the better it gets.',
    ]
    printInfo(tips[Math.min(sessionCount - 1, tips.length - 1)])
  }

  console.log()
  rl.prompt()

  let processing = false

  rl.on('line', (line) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    if (processing) return
    processing = true
    rl.pause()

    // Move cursor up and clear the echoed line to prevent double-display
    process.stdout.write('\x1b[A\x1b[2K')
    // Re-print the input cleanly with the prompt prefix
    console.log(`${kbotPrompt()}${input}`)

    const handle = async () => {
      // Slash commands
      if (input.startsWith('/')) {
        try {
          await handleSlashCommand(input, agentOpts, rl)
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err))
        }
      } else {
        // Run agent
        try {
          const response = await runAgent(input, agentOpts)

          // Only print response if it wasn't already streamed to stdout
          if (!response.streamed) {
            printResponse(response.agent, response.content)
          }

          // Mentor footer — teach the user what kbot did (agent, tools, cost)
          {
            const parts: string[] = []

            // Show which agent handled it (teaches routing)
            if (response.agent && response.agent !== 'kernel') {
              parts.push(`${response.agent} agent`)
            }

            if (response.toolCalls > 0) {
              parts.push(`${response.toolCalls} tool${response.toolCalls > 1 ? 's' : ''} used`)
            }

            if (response.usage) {
              const tokens = response.usage.input_tokens + response.usage.output_tokens
              const cost = response.usage.cost_usd === 0 ? 'free' : `$${response.usage.cost_usd.toFixed(4)}`
              parts.push(`${tokens} tokens · ${cost}`)
            }

            if (parts.length > 0) {
              printInfo(parts.join(' · '))
            }

            // On first 5 sessions, teach what just happened
            if (sessionCount <= 5 && response.agent && response.agent !== 'kernel') {
              printInfo(chalk.dim(`  I picked the ${response.agent} agent for this. You can also say /agent ${response.agent} to use it directly.`))
            }
          }

          // Schedule cloud sync push (debounced — batches writes)
          schedulePush()
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err))
        }
      }

      console.log()
      processing = false
      rl.resume()
      rl.prompt()
    }

    handle().catch((err) => {
      printError(err instanceof Error ? err.message : String(err))
      processing = false
      rl.resume()
      rl.prompt()
    })
  })

  // Ctrl+C: don't exit immediately — just cancel current input and re-prompt
  let sigintCount = 0
  rl.on('SIGINT', () => {
    sigintCount++
    if (sigintCount >= 2) {
      printGoodbye()
      process.exit(0)
    }
    console.log() // newline after ^C
    printInfo('Ctrl+C again to exit')
    rl.prompt()
    // Reset after 2 seconds
    setTimeout(() => { sigintCount = 0 }, 2000)
  })

  // Keep process alive until readline closes
  return new Promise<void>((resolve) => {
    rl.on('close', () => {
      // Flush all pending learning writes and cloud sync before exit
      flushPendingWrites()
      flushCloudSync()
      printGoodbye()
      resolve()
      process.exit(0)
    })
  })
}

async function handleMatrixCommand(args: string[]): Promise<void> {
  const sub = args[0]

  if (!sub || sub === 'list') {
    printInfo('Agent Creation Matrix')
    console.log(formatAgentList())
    console.log()
    printInfo('Presets: ' + Object.keys(PRESETS).join(', '))
    printInfo('Usage: /matrix create <name> <prompt>')
    printInfo('       /matrix preset <name>')
    printInfo('       /matrix remove <id>')
    printInfo('       /matrix info <id>')
    return
  }

  if (sub === 'create') {
    const name = args[1]
    if (!name) {
      printError('Usage: /matrix create <name> <system prompt...>')
      return
    }
    const prompt = args.slice(2).join(' ')
    if (!prompt) {
      printError('System prompt required. Example:')
      printInfo('  /matrix create "Security Bot" You are a security expert who finds vulnerabilities.')
      return
    }
    try {
      const agent = createAgent(name, prompt)
      printSuccess(`Agent "${agent.name}" created (${agent.id})`)
      printInfo(`Use with: /agent ${agent.id}`)
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
    }
    return
  }

  if (sub === 'preset') {
    const presetId = args[1]
    if (!presetId || !PRESETS[presetId]) {
      printError(`Unknown preset. Available: ${Object.keys(PRESETS).join(', ')}`)
      return
    }
    const preset = PRESETS[presetId]
    try {
      const agent = createAgent(preset.name, preset.prompt)
      printSuccess(`Preset agent "${agent.name}" spawned (${agent.id})`)
      printInfo(`Use with: /agent ${agent.id}`)
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
    }
    return
  }

  if (sub === 'remove') {
    const id = args[1]
    if (!id) {
      printError('Usage: /matrix remove <agent-id>')
      return
    }
    if (removeAgent(id)) {
      printSuccess(`Agent "${id}" removed from matrix`)
    } else {
      printError(`Agent "${id}" not found`)
    }
    return
  }

  if (sub === 'info') {
    const id = args[1]
    if (!id) {
      printError('Usage: /matrix info <agent-id>')
      return
    }
    const agent = getAgent(id)
    if (agent) {
      console.log(formatAgentDetail(agent))
    } else {
      printError(`Agent "${id}" not found`)
    }
    return
  }

  printError(`Unknown matrix command: ${sub}`)
  printInfo('Available: list, create, preset, remove, info')
}

async function handleSlashCommand(
  input: string,
  opts: AgentOptions,
  rl: ReturnType<typeof createInterface>,
): Promise<void> {
  const [cmd, ...args] = input.slice(1).split(' ')

  switch (cmd) {
    case 'help':
      printHelp()
      break

    case 'tutorial': {
      console.log()
      console.log(chalk.bold('  Let\'s build something together. Pick a track:'))
      console.log()
      console.log(`  ${chalk.bold('1.')} ${chalk.hex('#4ADE80')('Build a website')}     — Create an HTML page from scratch`)
      console.log(`  ${chalk.bold('2.')} ${chalk.hex('#60A5FA')('Fix a bug')}           — Find and fix a problem in code`)
      console.log(`  ${chalk.bold('3.')} ${chalk.hex('#FB923C')('Write a script')}      — Automate something with Python or JavaScript`)
      console.log(`  ${chalk.bold('4.')} ${chalk.hex('#F472B6')('Research a topic')}    — Deep-dive into any subject`)
      console.log(`  ${chalk.bold('5.')} ${chalk.hex('#A78BFA')('Explore this project')} — Understand the code in this folder`)
      console.log()
      console.log(chalk.dim('  Pick a number, or just type what you want to build.'))
      console.log()

      const tutorialInput = await new Promise<string>((resolve) => {
        rl.question('  Your choice: ', (answer) => resolve(answer.trim()))
      })

      const tutorialPrompts: Record<string, string> = {
        '1': 'Create a simple, beautiful HTML page with a heading, a paragraph about me, and some CSS styling. Save it as index.html. Walk me through what each part does.',
        '2': 'Look at the files in this directory. Find any issues, bugs, or things that could be improved. Explain what you found and fix the most important one.',
        '3': 'Write a short script that lists all files in the current directory, sorted by size. Use the language that makes the most sense for this project. Explain each line.',
        '4': 'I want to understand how AI agents work. Research this topic and explain it simply — what are agents, how do they think, and what tools do they use? Give real examples.',
        '5': 'Explore this project directory. What language is it written in? What does it do? What are the most important files? Give me a quick tour.',
      }

      const prompt = tutorialPrompts[tutorialInput] || tutorialInput
      if (prompt) {
        console.log()
        printInfo('Great choice! Let me work on that...')
        console.log()
        try {
          const response = await runAgent(prompt, opts)
          if (!response.streamed) {
            printResponse(response.agent, response.content)
          }
          console.log()
          printInfo(chalk.dim('That\'s the basics! Keep asking questions — I learn from every conversation.'))
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err))
        }
      }
      break
    }

    case 'agent':
      if (args[0]) {
        opts.agent = args[0]
        printSuccess(`Agent set to: ${args[0]}`)
      } else {
        printInfo(`Current agent: ${opts.agent || 'auto'}`)
        printInfo('Built-in: kernel, researcher, coder, writer, analyst, aesthete, guardian, curator, strategist')
        const matrixIds = getMatrixAgentIds()
        if (matrixIds.length > 0) {
          printInfo(`Matrix: ${matrixIds.join(', ')}`)
        }
      }
      break

    case 'matrix':
      await handleMatrixCommand(args)
      break

    case 'model':
      if (args[0]) {
        const config = loadConfig()
        // If using Ollama, update the default model in the provider config
        if (config?.byok_provider === 'ollama') {
          PROVIDERS.ollama.defaultModel = args[0]
          printSuccess(`Ollama model set to: ${args[0]}`)
          printInfo('This model will be used for all requests (overrides smart routing)')
        } else {
          opts.model = args[0]
          printSuccess(`Model set to: ${args[0]}`)
        }
      } else {
        const config = loadConfig()
        if (config?.byok_provider === 'ollama') {
          printInfo(`Current model: ${PROVIDERS.ollama.defaultModel} (Ollama, smart routing active)`)
          printInfo('Override with: /model <name>  or  /model auto')
        } else {
          printInfo(`Current model: ${opts.model || 'auto'}`)
        }
      }
      break



    case 'clear':
      clearHistory()
      printSuccess('Conversation history cleared')
      break

    case 'context':
      if (opts.context) {
        const { formatContextForPrompt } = await import('./context.js')
        printInfo(formatContextForPrompt(opts.context))
      } else {
        printInfo('No project context available')
      }
      break

    case 'memory':
      if (args[0] === 'clear') {
        clearMemory()
        printSuccess('Persistent memory cleared')
      } else {
        const { loadMemory } = await import('./memory.js')
        const mem = loadMemory()
        printInfo(mem || 'No memory entries yet')
      }
      break

    case 'learn':
    case 'stats': {
      const stats = getExtendedStats()
      console.log()
      console.log(chalk.bold('  Learning'))
      printInfo(`  ${stats.patternsCount} patterns · ${stats.solutionsCount} solutions · ${stats.knowledgeCount} facts`)
      printInfo(`  ${stats.totalMessages} messages · ${stats.sessions} sessions · ${stats.efficiency} efficiency`)
      if (stats.topKnowledge.length > 0) {
        console.log()
        for (const fact of stats.topKnowledge.slice(0, 5)) {
          printInfo(`  • ${fact}`)
        }
      }
      break
    }

    case 'remember': {
      const fact = args.join(' ')
      if (!fact) {
        printError('Usage: /remember <fact to remember>')
        printInfo('Example: /remember My API runs on port 3001')
      } else {
        learnFact(fact, 'fact', 'user-taught')
        printSuccess(`Learned: "${fact}"`)
      }
      break
    }

    case 'compact': {
      const result = compactHistory()
      printSuccess(result.summary)
      break
    }

    case 'save': {
      const sessionName = args.join(' ') || undefined
      try {
        const session = saveSession(sessionName, opts.agent)
        printSuccess(`Session saved: ${session.name} (${session.id})`)
        printInfo('Resume with: /resume ' + session.id)
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
      break
    }

    case 'resume': {
      const sessionId = args.join(' ')
      if (!sessionId) {
        printError('Usage: /resume <session-id or name>')
        printInfo('Run /sessions to list saved sessions.')
      } else {
        const session = loadSession(sessionId)
        if (session) {
          restoreHistory(session.history)
          if (session.agent) opts.agent = session.agent
          printSuccess(`Resumed: ${session.name} (${session.turnCount} turns)`)
        } else {
          printError(`Session not found: ${sessionId}`)
        }
      }
      break
    }

    case 'sessions': {
      const sessions = listSessions()
      printInfo('Saved Sessions')
      console.log(formatSessionList(sessions))
      break
    }

    case 'delete-session': {
      const id = args.join(' ')
      if (!id) {
        printError('Usage: /delete-session <session-id>')
      } else if (deleteSession(id)) {
        printSuccess(`Session deleted: ${id}`)
      } else {
        printError(`Session not found: ${id}`)
      }
      break
    }

    case 'train': {
      printInfo('Running self-training...')
      const result = selfTrain()
      printSuccess('Training complete')
      console.log()
      for (const line of result.summary.split('\n')) {
        printInfo(`  ${line}`)
      }
      const log = getTrainingLog()
      console.log()
      printInfo(`  Total training runs: ${log.runsTotal}`)
      printInfo(`  Total entries pruned: ${log.entriesPruned}`)
      printInfo(`  Total insights synthesized: ${log.insightsSynthesized}`)
      break
    }

    case 'thinking':
      opts.thinking = !opts.thinking
      printSuccess(`Extended thinking: ${opts.thinking ? 'ON' : 'OFF'}`)
      if (opts.thinking) printInfo('AI will show reasoning steps before responding.')
      break

    case 'self-eval':
    case 'selfeval': {
      const { isSelfEvalEnabled, setSelfEvalEnabled } = await import('./self-eval.js')
      const newState = !isSelfEvalEnabled()
      setSelfEvalEnabled(newState)
      printSuccess(`Self-evaluation: ${newState ? 'ON' : 'OFF'}`)
      if (newState) printInfo('Responses will be scored for quality and retried if below threshold.')
      break
    }

    case 'health':
    case 'providers': {
      const { getProviderHealth } = await import('./provider-fallback.js')
      const health = getProviderHealth()
      const active = health.filter(h => h.lastSuccess || h.lastFailure)
      if (active.length === 0) {
        printInfo('No provider calls recorded yet.')
      } else {
        console.log()
        printInfo('Provider Health:')
        for (const h of active) {
          const status = h.isHealthy ? chalk.green('healthy') : chalk.red('unhealthy')
          const latency = h.avgLatencyMs ? `${h.avgLatencyMs}ms` : '-'
          const failures = h.consecutiveFailures > 0 ? chalk.yellow(` (${h.consecutiveFailures} failures)`) : ''
          printInfo(`  ${h.provider}: ${status} · ${latency}${failures}`)
        }
        console.log()
      }
      break
    }

    case 'confidence': {
      const task = args.join(' ') || 'general task'
      const { estimateConfidence, reportConfidence } = await import('./confidence.js')
      const score = estimateConfidence(task, process.cwd())
      printInfo(reportConfidence(score))
      break
    }

    case 'skills': {
      const { getSkillProfile } = await import('./confidence.js')
      const profile = getSkillProfile()
      printInfo('Strengths:')
      for (const s of profile.strengths.slice(0, 5)) printInfo(`  ✓ ${s.domain} (${Math.round(s.successRate * 100)}% success, ${s.sampleSize} tasks)`)
      if (profile.weaknesses.length > 0) {
        printInfo('Weaknesses:')
        for (const w of profile.weaknesses.slice(0, 5)) printInfo(`  ✗ ${w.domain} (${Math.round(w.successRate * 100)}% success)`)
      }
      if (profile.unknown.length > 0) printInfo(`Unknown: ${profile.unknown.join(', ')}`)
      break
    }

    case 'effort': {
      const task = args.join(' ')
      if (!task) { printError('Usage: /effort <task description>'); break }
      const { estimateEffort } = await import('./confidence.js')
      const est = estimateEffort(task)
      printInfo(`Complexity: ${est.complexity}`)
      printInfo(`Tool calls: ${est.toolCalls.min}-${est.toolCalls.max} (expected: ${est.toolCalls.expected})`)
      printInfo(`Cost: $${est.estimatedCostUsd.min.toFixed(3)}-$${est.estimatedCostUsd.max.toFixed(3)}`)
      printInfo(`Breakdown: ${est.breakdown}`)
      break
    }

    case 'handoff': {
      const { getActiveHandoffs } = await import('./agent-protocol.js')
      const handoffs = getActiveHandoffs()
      if (handoffs.length === 0) printInfo('No active handoffs.')
      else for (const h of handoffs) printInfo(`  [${h.priority}] ${h.from} → ${h.to}: ${h.reason}`)
      break
    }

    case 'blackboard': {
      const { blackboardQuery } = await import('./agent-protocol.js')
      const entries = blackboardQuery()
      if (entries.length === 0) printInfo('Blackboard is empty.')
      else for (const e of entries) printInfo(`  [${e.type}] ${e.key} = ${JSON.stringify(e.value).slice(0, 60)} (by ${e.author})`)
      break
    }

    case 'trust': {
      const { getTrustReport } = await import('./agent-protocol.js')
      const report = getTrustReport()
      printInfo(report)
      break
    }

    case 'checkpoint': {
      const desc = args.join(' ')
      if (desc) {
        const { createCheckpoint } = await import('./temporal.js')
        createCheckpoint(desc, { filesModified: [], toolsUsed: [], decisions: [] })
        printSuccess(`Checkpoint saved: ${desc}`)
      } else {
        const { getCheckpoints } = await import('./temporal.js')
        const cps = getCheckpoints()
        if (cps.length === 0) printInfo('No checkpoints.')
        else for (const cp of cps) printInfo(`  [${cp.id}] step ${cp.step}: ${cp.description}`)
      }
      break
    }

    case 'anticipate': {
      const { anticipateNext } = await import('./temporal.js')
      const predictions = anticipateNext([], args.join(' ') || 'general')
      if (predictions.length === 0) printInfo('No predictions.')
      else for (const p of predictions) printInfo(`  ${Math.round(p.confidence * 100)}% — ${p.prediction}`)
      break
    }

    case 'identity': {
      const { getIdentity, getPersonalitySummary } = await import('./temporal.js')
      const id = getIdentity()
      printInfo(`Sessions: ${id.totalSessions} · Messages: ${id.totalMessages} · Tools: ${id.totalToolCalls}`)
      printInfo(getPersonalitySummary())
      break
    }

    case 'hypothesize': {
      const obs = args.join(' ')
      if (!obs) { printError('Usage: /hypothesize <error or observation>'); break }
      const { generateHypotheses } = await import('./reasoning.js')
      const result = generateHypotheses(obs, process.cwd())
      for (const h of result.hypotheses.slice(0, 5)) {
        printInfo(`  ${Math.round(h.likelihood * 100)}% — ${h.explanation}`)
        if (h.testAction) printInfo(`       Test: ${h.testAction}`)
      }
      break
    }

    case 'counterfactual': {
      const parts = args.join(' ').split(' vs ')
      if (parts.length < 2) { printError('Usage: /counterfactual <approach A> vs <approach B>'); break }
      const { exploreCounterfactual } = await import('./reasoning.js')
      const cf = exploreCounterfactual(parts[0].trim(), parts[1].trim(), process.cwd())
      printInfo(`Recommendation: ${cf.recommendation}`)
      printInfo(`Benefits: ${cf.tradeoffs.benefits.join(', ')}`)
      printInfo(`Risks: ${cf.tradeoffs.risks.join(', ')}`)
      break
    }

    case 'strategy': {
      const task = args.join(' ')
      if (!task) { printError('Usage: /strategy <task description>'); break }
      const { selectStrategy } = await import('./reasoning.js')
      const result = selectStrategy(task, process.cwd())
      printInfo(`Strategy: ${result.chosenStrategy}`)
      printInfo(`Reasoning: ${result.reasoning}`)
      if (result.adaptations.length > 0) printInfo(`Adaptations: ${result.adaptations.join(', ')}`)
      printInfo(`Fallback: ${result.fallbackStrategy}`)
      break
    }

    case 'drives': {
      const { getDriveState } = await import('./intentionality.js')
      const state = getDriveState()
      for (const d of state.drives) {
        const bar = '█'.repeat(Math.round(d.currentSatisfaction * 10)) + '░'.repeat(10 - Math.round(d.currentSatisfaction * 10))
        printInfo(`  ${d.name}: ${bar} ${Math.round(d.currentSatisfaction * 100)}% (weight: ${d.weight.toFixed(1)})`)
      }
      if (state.frustrated) printInfo('  ⚠ Frustrated — multiple drives below threshold')
      if (state.motivated) printInfo('  ✓ Motivated — all drives healthy')
      break
    }

    case 'motivation': {
      const { getMotivation, getMotivationSummary, suggestFromMotivation } = await import('./intentionality.js')
      printInfo(getMotivationSummary())
      const suggestions = suggestFromMotivation()
      if (suggestions.length > 0) {
        printInfo('Suggestions:')
        for (const s of suggestions) printInfo(`  → ${s}`)
      }
      break
    }

    case 'architect': {
      const archTask = args.join(' ')
      if (!archTask) {
        printError('Usage: /architect <task description>')
        printInfo('Example: /architect refactor the auth system to use JWT')
      } else {
        const { runArchitectMode } = await import('./architect.js')
        await runArchitectMode(archTask, opts)
      }
      break
    }

    case 'graph': {
      const graphArgs = args.join(' ')
      if (!graphArgs) {
        const { getGraph } = await import('./graph-memory.js')
        const graph = getGraph()
        printInfo(`Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges`)
        if (graph.nodes.size > 0) {
          const { toContext } = await import('./graph-memory.js')
          printInfo(toContext(500))
        }
      } else {
        const { findNode } = await import('./graph-memory.js')
        const results = findNode(graphArgs)
        if (results.length === 0) {
          printInfo('No matching nodes found.')
        } else {
          for (const n of results.slice(0, 10)) {
            printInfo(`  [${n.type}:${n.name}] (${n.accessCount} accesses)`)
          }
        }
      }
      break
    }

    case 'plan': {
      const planTask = args.join(' ')
      if (!planTask) {
        printError('Usage: /plan <task description>')
        printInfo('Example: /plan refactor the auth system to use JWT')
      } else {
        const { autonomousExecute } = await import('./planner.js')
        const plan = await autonomousExecute(planTask, opts, {
          onApproval: async (plan) => {
            const { createInterface: createRl } = await import('node:readline')
            const confirmRl = createRl({ input: process.stdin, output: process.stdout })
            const answer = await new Promise<string>((resolve) => {
              confirmRl.question('  Approve this plan? [y/N] ', (a) => {
                resolve(a.trim().toLowerCase())
                confirmRl.close()
              })
            })
            return answer === 'y' || answer === 'yes'
          },
        })
        const { formatPlanSummary } = await import('./planner.js')
        printInfo(formatPlanSummary(plan))
      }
      break
    }

    case 'worktree': {
      if (!args[0] || args[0] === 'list') {
        const { executeTool: execTool } = await import('./tools/index.js')
        const result = await execTool({ id: 'cli_wt', name: 'worktree_list', arguments: {} })
        printInfo(result.result)
      } else if (args[0] === 'create') {
        const { executeTool: execTool } = await import('./tools/index.js')
        const result = await execTool({ id: 'cli_wt', name: 'worktree_create', arguments: { name: args[1] } })
        printInfo(result.result)
      } else if (args[0] === 'switch') {
        const { executeTool: execTool } = await import('./tools/index.js')
        const result = await execTool({ id: 'cli_wt', name: 'worktree_switch', arguments: { id: args[1] } })
        printInfo(result.result)
      } else if (args[0] === 'merge') {
        const { executeTool: execTool } = await import('./tools/index.js')
        const result = await execTool({ id: 'cli_wt', name: 'worktree_merge', arguments: { id: args[1] } })
        printInfo(result.result)
      } else if (args[0] === 'remove') {
        const { executeTool: execTool } = await import('./tools/index.js')
        const result = await execTool({ id: 'cli_wt', name: 'worktree_remove', arguments: { id: args[1] } })
        printInfo(result.result)
      } else {
        printError('Usage: /worktree [list|create|switch|merge|remove] [args]')
      }
      break
    }

    case 'permission': {
      const { setPermissionMode, getPermissionMode } = await import('./permissions.js')
      const mode = args[0]
      if (mode === 'permissive' || mode === 'normal' || mode === 'strict') {
        setPermissionMode(mode)
        printSuccess(`Permission mode: ${mode}`)
      } else {
        printInfo(`Current permission mode: ${getPermissionMode()}`)
        printInfo('Available: permissive, normal, strict')
      }
      break
    }

    case 'plugins': {
      const { getLoadedPlugins, formatPluginList, scaffoldPlugin } = await import('./plugins.js')
      if (args[0] === 'create' && args[1]) {
        const result = scaffoldPlugin(args[1])
        printInfo(result)
      } else if (args[0] === 'reload') {
        const { loadPlugins } = await import('./plugins.js')
        const plugins = await loadPlugins(true)
        printSuccess(`Reloaded ${plugins.length} plugin(s)`)
      } else {
        printInfo(formatPluginList())
      }
      break
    }

    case 'dashboard': {
      const { renderDashboard } = await import('./tui.js')
      const config = loadConfig()
      const stats = getExtendedStats()
      const dashState = {
        agent: opts.agent || 'auto',
        model: opts.model || 'auto',
        provider: config?.byok_provider || 'anthropic',
        toolsUsed: stats.totalMessages,
        tokensUsed: 0,
        cost: 0,
        sessionTurns: 0,
        activeSubagents: [],
        recentTools: [],
      }
      console.log(renderDashboard(dashState))
      break
    }

    case 'build': {
      const { detectProjectTargets, formatTargetList, getMissingTools } = await import('./build-targets.js')
      const detected = detectProjectTargets()
      if (detected.length === 0) {
        printInfo('No build targets detected in this project.')
        printInfo('Use: /build targets — to see all supported platforms')
      } else if (args[0] === 'targets') {
        const { BUILD_TARGETS } = await import('./build-targets.js')
        console.log(formatTargetList(Object.values(BUILD_TARGETS)))
      } else {
        printInfo('Detected build targets:')
        for (const t of detected) {
          const missing = getMissingTools(t)
          const icon = missing.length === 0 ? '✓' : '○'
          printInfo(`  ${icon} ${t.id.padEnd(16)} ${t.name}`)
        }
        console.log()
        printInfo('Run: kbot "build for <target>" to trigger a build')
      }
      break
    }

    case 'ollama': {
      if (args[0] === 'off') {
        disableByok()
        printSuccess('Ollama disabled. Provider disabled.')
        break
      }
      const running = await isOllamaRunning()
      if (!running) { printError('Ollama not running. Start with: ollama serve'); break }
      if (args[0] === 'list') {
        const models = await listOllamaModels()
        printInfo('Available Ollama models:')
        for (const m of models) printInfo(`  • ${m}`)
        break
      }
      const model = args[0]
      const ok = await setupOllama(model)
      if (ok) {
        const models = await listOllamaModels()
        printSuccess(`Ollama enabled! ${models.length} models available. $0 cost.`)
        printInfo(`Default: ${model || PROVIDERS.ollama.defaultModel}`)
      } else {
        printError('Failed to connect to Ollama.')
      }
      break
    }

    case 'openclaw': {
      if (args[0] === 'off') {
        disableByok()
        printSuccess('OpenClaw disabled.')
        break
      }
      const ok = await setupOpenClaw(args[0])
      if (ok) {
        printSuccess('OpenClaw gateway connected at 127.0.0.1:18789')
      } else {
        printError('Cannot connect to OpenClaw gateway.')
      }
      break
    }

    case 'models': {
      const config = loadConfig()
      if (config?.byok_provider === 'ollama') {
        const running = await isOllamaRunning()
        if (!running) { printError('Ollama not running'); break }
        const models = await listOllamaModels()
        printInfo('Available local models:')
        for (const m of models) {
          const active = m === (PROVIDERS.ollama.defaultModel) ? ' (active)' : ''
          printInfo(`  ${active ? '>' : ' '} ${m}${active}`)
        }
        console.log()
        printInfo('Switch model: /model <name>')
        printInfo('Smart routing auto-selects: coding → qwen2.5-coder · reasoning → phi4 · general → llama3.1')
      } else if (config?.byok_provider) {
        const p = PROVIDERS[config.byok_provider]
        printInfo(`Provider: ${p.name}`)
        printInfo(`  Default: ${p.defaultModel}`)
        printInfo(`  Fast:    ${p.fastModel}`)
      } else {
        printInfo('No provider configured. Run: kbot byok')
      }
      break
    }

    case 'provider': {
      const config = loadConfig()
      if (config?.byok_enabled && config?.byok_provider) {
        const p = PROVIDERS[config.byok_provider]
        printInfo(`Active provider: ${p?.name || config.byok_provider}`)
        printInfo(`  Model: ${p?.defaultModel || 'unknown'}`)
        printInfo(`  Cost: $${p?.inputCost || 0}/${p?.outputCost || 0} per 1M tokens`)
        printInfo(`  Local: ${isLocalProvider(config.byok_provider) ? 'Yes (free, private)' : 'No (cloud)'}`)
      } else {
        printInfo('No provider configured. Run: kbot byok')
      }
      printInfo('')
      printInfo('Switch: /ollama [model] | /openclaw | kbot byok')
      break
    }

    case 'mimic': {
      if (!args[0] || args[0] === 'list') {
        const profiles = listMimicProfiles()
        printInfo('Mimic Matrix — Code like the best tools and frameworks')
        console.log()
        printInfo('  Tool Styles:')
        for (const p of profiles.filter(p => ['claude-code', 'cursor', 'copilot'].includes(p.id))) {
          const color = chalk.hex(p.color)
          printInfo(`    ${color(p.icon)} ${p.id.padEnd(16)} ${p.description}`)
        }
        console.log()
        printInfo('  Framework Experts:')
        for (const p of profiles.filter(p => ['nextjs', 'react', 'python', 'rust'].includes(p.id))) {
          const color = chalk.hex(p.color)
          printInfo(`    ${color(p.icon)} ${p.id.padEnd(16)} ${p.description}`)
        }
        console.log()
        printInfo('  Coding Philosophies:')
        for (const p of profiles.filter(p => ['senior', 'startup'].includes(p.id))) {
          const color = chalk.hex(p.color)
          printInfo(`    ${color(p.icon)} ${p.id.padEnd(16)} ${p.description}`)
        }
        console.log()
        printInfo('Activate: /mimic <id>     Example: /mimic nextjs')
        printInfo('Deactivate: /mimic off')
      } else if (args[0] === 'off') {
        opts.agent = 'auto'
        printSuccess('Mimic mode deactivated. Back to auto-routing.')
      } else {
        const profileId = args[0]
        const agent = activateMimic(profileId)
        if (agent) {
          opts.agent = agent.id
          const color = chalk.hex(agent.color)
          printSuccess(`Mimic activated: ${color(agent.icon)} ${agent.name}`)
          const profile = getMimicProfile(profileId)
          if (profile?.conventions) {
            printInfo(`Conventions: ${profile.conventions.join(' · ')}`)
          }
          printInfo('All responses will follow this style. Deactivate with: /mimic off')
        } else {
          printError(`Unknown mimic profile: ${profileId}`)
          printInfo('Run /mimic to see available profiles')
        }
      }
      break
    }



    case 'quit':
    case 'exit':
      rl.close()
      break

    default:
      printError(`I don't know "/${cmd}". Here are some you can try:`)
      printInfo('  /save — save this chat  |  /agent — pick a specialist  |  /help — see everything')
  }
}

// Prevent unhandled rejections from killing the process
process.on('unhandledRejection', (err) => {
  printError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
})

// Run
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

#!/usr/bin/env node
// kbot CLI — Terminal entry point
//
// Usage:
//   $ kbot                        # Interactive REPL
//   $ kbot "fix the auth bug"     # One-shot with inline prompt
//   $ kbot --agent researcher     # Force specific agent
//   $ kbot --model sonnet         # Override model
//   $ kbot auth                   # Configure API key
//   $ kbot usage                  # Show usage stats

import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { Command } from 'commander'
import { loadConfig, setupByok, setupEmbedded, isByokEnabled, isLocalProvider, disableByok, detectProvider, getByokProvider, PROVIDERS, setupOllama, setupKbotLocal, isOllamaRunning, listOllamaModels, warmOllamaModelCache, detectLocalRuntime, type ByokProvider } from './auth.js'
import { runAndPrint, runAgent, runAgentFromCheckpoint, type AgentOptions } from './agent.js'
import { gatherContext, type ProjectContext } from './context.js'
import { registerCoreTools, startLazyToolRegistration, ensureLazyToolsLoaded } from './tools/index.js'
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
import { maybeSynthesize, getSynthesisStats } from './memory-synthesis.js'
import {
  banner,
  bannerCompact,
  bannerAuth,
  matrixConnect,
  prompt as kbotPrompt,
  printError,
  printSuccess,
  printInfo,
  printWarn,
  printResponse,
  printHelp,
  printGoodbye,
  divider,
  setQuiet,
} from './ui.js'
import { checkForUpdate, selfUpdate } from './updater.js'
import { runTutorial } from './tutorial.js'
import { syncOnStartup, schedulePush, flushCloudSync, isCloudSyncEnabled, setCloudToken, getCloudToken } from './cloud-sync.js'
import chalk from 'chalk'

import { createRequire } from 'node:module'
const __require = createRequire(import.meta.url)
const VERSION = (__require('../package.json') as { version: string }).version

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('kbot')
    .description('kbot — Open-source terminal AI agent. Bring your own key, pick your model, run locally.')
    .version(VERSION)
    .option('-a, --agent <agent>', 'Force a specific agent (run kbot agents to see all 22)')
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
    .option('--plan', 'Plan mode — read-only exploration, no changes')
    .option('--architect', 'Architect mode — plan-review-implement with dual agents')
    .option('--safe', 'Confirm destructive operations')
    .option('--strict', 'Confirm ALL operations')
    .argument('[prompt...]', 'One-shot prompt')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .action(() => { /* default action — handled below */ })

  // Sub-commands
  program
    .command('version')
    .description('Show kbot version')
    .action(() => {
      console.log(`kbot v${VERSION}`)
      process.exit(0)
    })

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
      printInfo('kbot IDE Bridge Status')
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
    .description('Bring Your Own Key — configure your LLM API key (20 providers)')
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

  // `kbot local` — primary command for local models
  // Supports both Ollama (external service) and embedded (in-process llama.cpp)
  const localAction = async (opts: { model?: string; list?: boolean; off?: boolean; embedded?: boolean }) => {
    if (opts.off) {
      disableByok()
      printSuccess('Local AI disabled.')
      return
    }

    // Embedded mode — runs models directly, no Ollama needed
    if (opts.embedded) {
      const { listLocalModels, isEmbeddedAvailable } = await import('./inference.js')
      const available = await isEmbeddedAvailable()
      if (!available) {
        printError('node-llama-cpp not installed. Run: npm install -g node-llama-cpp')
        return
      }
      const models = listLocalModels()
      if (models.length === 0) {
        printInfo('No models downloaded yet. Pull one:')
        printInfo('  kbot models pull llama3.1-8b')
        printInfo('  kbot models pull qwen2.5-coder-7b')
        printInfo('  kbot models pull deepseek-r1-8b')
        return
      }
      // Configure embedded provider
      setupEmbedded()
      printSuccess(`Embedded engine enabled! ${models.length} model${models.length === 1 ? '' : 's'} ready. $0 cost. No external service needed.`)
      printInfo('Using lightweight local model. For better quality, try Ollama with a larger model.')
      for (const m of models) printInfo(`  • ${m.name} (${m.size})`)
      return
    }

    if (opts.list) {
      const running = await isOllamaRunning()
      if (!running) { printError('No local runtime found. Install Ollama: https://ollama.com'); return }
      const models = await listOllamaModels()
      if (models.length === 0) { printError('No models found. Pull one with: ollama pull llama3.1:8b'); return }
      printInfo('Available local models:')
      for (const m of models) printInfo(`  • ${m}`)
      return
    }
    const running = await isOllamaRunning()
    if (!running) {
      // Auto-fallback to embedded if available
      const { listLocalModels, isEmbeddedAvailable } = await import('./inference.js')
      const embAvailable = await isEmbeddedAvailable()
      const embModels = listLocalModels()
      if (embAvailable && embModels.length > 0) {
        setupEmbedded()
        printSuccess(`No Ollama found — using embedded engine. ${embModels.length} model${embModels.length === 1 ? '' : 's'} ready.`)
        printInfo('Using lightweight local model. For better quality, try Ollama with a larger model.')
        return
      }
      printError('No local runtime found. Install Ollama: https://ollama.com')
      printInfo('Or use embedded mode: kbot local --embedded')
      return
    }
    const ok = await setupOllama(opts.model)
    if (ok) {
      const models = await listOllamaModels()
      printSuccess(`Local AI enabled! ${models.length} models available. $0 cost.`)
      printInfo(`Default model: ${opts.model || PROVIDERS.ollama.defaultModel}`)
      printInfo('Switch models: kbot local --model <name>')
    } else {
      printError('Failed to connect to local runtime. Is Ollama running? Try: ollama serve')
    }
  }
  const localOpts = (cmd: Command) => cmd
    .option('--model <model>', 'Set default local model')
    .option('--list', 'List available local models')
    .option('--off', 'Disable local mode')
    .option('--embedded', 'Use embedded llama.cpp engine (no Ollama needed)')

  localOpts(program.command('local').description('Use local AI models — no API key, $0 cost, fully private'))
    .action(localAction)
  localOpts(program.command('ollama').description('Alias for: kbot local'))
    .action(localAction)

  // `kbot models` — manage GGUF models for embedded inference
  const modelsCmd = program.command('models').description('Manage local GGUF models for embedded inference')

  modelsCmd
    .command('list')
    .description('List downloaded models')
    .action(async () => {
      const { listLocalModels, ensureModelsDir } = await import('./inference.js')
      ensureModelsDir()
      const models = listLocalModels()
      if (models.length === 0) {
        printInfo('No models downloaded. Pull one:')
        printInfo('  kbot models pull llama3.1-8b')
        printInfo('  kbot models pull qwen2.5-coder-7b')
        printInfo('  kbot models pull deepseek-r1-8b')
        return
      }
      printInfo(`${models.length} model${models.length === 1 ? '' : 's'}:`)
      for (const m of models) {
        printInfo(`  • ${m.name}  ${m.size}  (${m.modified})`)
      }
    })

  modelsCmd
    .command('pull <name>')
    .description('Download a model (preset name or HuggingFace URI)')
    .action(async (name: string) => {
      const { downloadModel, DEFAULT_MODELS } = await import('./inference.js')
      const preset = DEFAULT_MODELS[name]
      if (preset) {
        printInfo(`Downloading ${name} (${preset.description}) — ${preset.size}...`)
      } else {
        printInfo(`Downloading ${name}...`)
      }
      try {
        const modelPath = await downloadModel(name, (pct) => {
          process.stderr.write(`\r  Progress: ${pct}%`)
        })
        process.stderr.write('\n')
        printSuccess(`Model ready: ${modelPath}`)
        printInfo('Enable embedded mode: kbot local --embedded')
      } catch (err) {
        printError(`Download failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

  modelsCmd
    .command('remove <name>')
    .description('Remove a downloaded model')
    .action(async (name: string) => {
      const { removeModel } = await import('./inference.js')
      if (removeModel(name)) {
        printSuccess(`Removed model matching "${name}"`)
      } else {
        printError(`No model found matching "${name}"`)
      }
    })

  modelsCmd
    .command('catalog')
    .description('Show available models for download')
    .action(async () => {
      const { DEFAULT_MODELS } = await import('./inference.js')
      printInfo('Available models:')
      for (const [name, info] of Object.entries(DEFAULT_MODELS)) {
        printInfo(`  • ${name}  ${info.size}`)
        printInfo(`    ${info.description}`)
      }
      printInfo('')
      printInfo('Download: kbot models pull <name>')
      printInfo('Or use any HuggingFace GGUF: kbot models pull hf:user/repo:file.gguf')
    })

  program
    .command('doctor')
    .description('Diagnose your kbot setup — check everything is working')
    .action(async () => {
      const { runDoctor, formatDoctorReport } = await import('./doctor.js')
      process.stderr.write('\n')
      printInfo('kbot Doctor — Checking your setup...')
      const report = await runDoctor()
      process.stderr.write(formatDoctorReport(report))
    })

  // ── Forge subcommands ──
  const forgeCmd = program
    .command('forge')
    .description('Forge registry — create, share, and install community tools')

  forgeCmd
    .command('list')
    .description('List all locally forged tools')
    .action(async () => {
      const { listForgedTools } = await import('./tools/forge.js')
      const chalk = (await import('chalk')).default
      const tools = listForgedTools()

      if (tools.length === 0) {
        printInfo('No forged tools yet. Use `kbot forge create` or ask kbot to create one.')
        return
      }

      process.stderr.write(`\n  ${chalk.hex('#6B5B95')('Forged Tools')} (${tools.length}):\n\n`)
      for (const t of tools) {
        process.stderr.write(`  ${chalk.bold(t.name)} — ${t.description}\n`)
        process.stderr.write(`    ${chalk.dim(`Created: ${t.createdAt} · ${t.path}`)}\n\n`)
      }
    })

  forgeCmd
    .command('search <query>')
    .description('Search the shared forge registry for community tools')
    .action(async (query: string) => {
      printInfo(`Searching forge registry for "${query}"...`)
      try {
        const res = await fetch(`https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/forge-registry/search?q=${encodeURIComponent(query)}&limit=15`, {
          signal: AbortSignal.timeout(8_000),
        })
        const data = await res.json()
        const chalk = (await import('chalk')).default

        if (!data.tools || data.tools.length === 0) {
          printInfo(`No tools found for "${query}". Be the first — forge one and publish it!`)
          return
        }

        process.stderr.write(`\n  ${chalk.hex('#6B5B95')('Forge Registry')} — ${data.tools.length} results:\n\n`)
        for (const t of data.tools) {
          process.stderr.write(`  ${chalk.bold(t.name)} v${t.version} — ${t.description}\n`)
          process.stderr.write(`    ${chalk.dim(`${t.downloads || 0} downloads · ${(t.tags || []).join(', ') || 'no tags'}`)}\n`)
          process.stderr.write(`    ${chalk.dim(`Install: kbot forge install ${t.id}`)}\n\n`)
        }
      } catch (err) {
        printError(`Search failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

  forgeCmd
    .command('install <id>')
    .description('Install a tool from the forge registry by ID')
    .action(async (id: string) => {
      printInfo(`Installing from forge registry...`)
      const { registerForgeTools } = await import('./tools/forge.js')
      const { ensureLazyToolsLoaded, executeTool } = await import('./tools/index.js')
      await ensureLazyToolsLoaded()
      const result = await executeTool({ id: 'cli', name: 'forge_install', arguments: { id } })
      process.stderr.write(`\n  ${result.result}\n\n`)
    })

  forgeCmd
    .command('publish <name>')
    .description('Publish a locally forged tool to the shared registry')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (name: string, opts: { tags?: string }) => {
      printInfo(`Publishing "${name}" to forge registry...`)
      const { ensureLazyToolsLoaded, executeTool } = await import('./tools/index.js')
      await ensureLazyToolsLoaded()
      const result = await executeTool({ id: 'cli', name: 'forge_publish', arguments: { name, tags: opts.tags || '' } })
      process.stderr.write(`\n  ${result.result}\n\n`)
    })

  program
    .command('vitals')
    .description('Autopoietic health check — system viability, component status, self-healing log')
    .action(async () => {
      const { AutopoieticSystem } = await import('./autopoiesis.js')
      const chalk = (await import('chalk')).default
      const AMETHYST = chalk.hex('#6B5B95')

      process.stderr.write('\n')
      printInfo('kbot Vitals — Autopoietic System Health')

      const system = new AutopoieticSystem()

      // Probe live components
      const { isOllamaRunning, isByokEnabled, getByokProvider } = await import('./auth.js')
      const { existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { homedir } = await import('node:os')

      // Filesystem
      system.reportHealth('filesystem', true)

      // Bash
      try {
        const { execSync } = await import('node:child_process')
        execSync('echo ok', { timeout: 2000 })
        system.reportHealth('bash', true)
      } catch { system.reportHealth('bash', false) }

      // Git
      try {
        const { execSync } = await import('node:child_process')
        execSync('git --version', { timeout: 2000 })
        system.reportHealth('git', true)
      } catch { system.reportHealth('git', false) }

      // Memory
      const memDir = join(homedir(), '.kbot', 'memory')
      system.reportHealth('local-memory', existsSync(memDir))
      system.reportHealth('session-context', true)

      // Providers
      if (isByokEnabled()) {
        const provider = getByokProvider()
        system.reportHealth(provider, true)
      }

      // Ollama
      const ollamaOk = await isOllamaRunning()
      system.reportHealth('ollama', ollamaOk)

      // Internet
      try {
        const res = await fetch('https://httpbin.org/status/200', { signal: AbortSignal.timeout(3000) })
        system.reportHealth('internet', res.ok)
      } catch { system.reportHealth('internet', false) }

      // Forged tools
      const forgedDir = join(homedir(), '.kbot', 'plugins', 'forged')
      if (existsSync(forgedDir)) {
        const { readdirSync } = await import('node:fs')
        const forged = readdirSync(forgedDir).filter(f => f.endsWith('.js'))
        for (const f of forged) {
          const name = f.replace('.js', '')
          system.registerForgedComponent(name, `User-forged tool`)
        }
      }

      // Run health check
      const report = system.healthCheck()

      // Display
      const viabilityColor = report.viability > 0.7 ? chalk.green : report.viability > 0.4 ? chalk.yellow : chalk.red
      process.stderr.write(`\n  ${AMETHYST('Viability')}: ${viabilityColor(`${(report.viability * 100).toFixed(0)}%`)}`)
      process.stderr.write(`  ${report.isViable ? chalk.green('VIABLE') : chalk.red('DEGRADED')}`)
      process.stderr.write(`  ${report.boundaryIntact ? chalk.green('boundary intact') : chalk.red('boundary breached')}\n\n`)

      if (report.healthy.length > 0) {
        process.stderr.write(`  ${chalk.green('Healthy')}: ${report.healthy.join(', ')}\n`)
      }
      if (report.degraded.length > 0) {
        process.stderr.write(`  ${chalk.yellow('Degraded')}: ${report.degraded.join(', ')}\n`)
      }
      if (report.failed.length > 0) {
        process.stderr.write(`  ${chalk.red('Failed')}: ${report.failed.join(', ')}\n`)
      }
      if (report.healingActions.length > 0) {
        process.stderr.write(`\n  ${AMETHYST('Self-Healing')}:\n`)
        for (const action of report.healingActions) {
          process.stderr.write(`    ${chalk.dim('→')} ${action}\n`)
        }
      }

      const speed = system.recommendModelSpeed()
      process.stderr.write(`\n  ${AMETHYST('Cost regulation')}: ${speed === 'fast' ? chalk.yellow('conserving (fast model)') : chalk.green('normal (default model)')}\n\n`)
    })

  program
    .command('status')
    .description('Unified Kernel dashboard — version, tools, agents, learning, collective, npm, GitHub, bootstrap')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      // Check both subcommand and parent opts (commander absorbs --json at parent level)
      const jsonMode = opts.json || program.opts().json
      const chalk = (await import('chalk')).default
      const AMETHYST = chalk.hex('#6B5B95')
      const DIM = chalk.dim
      const GREEN = chalk.hex('#4ADE80')
      const YELLOW = chalk.hex('#FBBF24')
      const RED = chalk.hex('#F87171')
      const CYAN = chalk.hex('#67E8F9')
      const line = DIM('  ' + '─'.repeat(40))

      // ── 1. Version & latest check ──
      let latestVersion = ''
      let isLatest = false
      const npmDownloads: { downloads?: number } = {}
      const githubData: { stars?: number; issues?: number } = {}

      // Fire all network requests in parallel with 3s timeouts
      const [npmVersionRes, npmDlRes, ghRes] = await Promise.allSettled([
        fetch('https://registry.npmjs.org/@kernel.chat/kbot/latest', { signal: AbortSignal.timeout(3000) })
          .then(r => r.json() as Promise<{ version?: string }>),
        fetch('https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot', { signal: AbortSignal.timeout(3000) })
          .then(r => r.json() as Promise<{ downloads?: number }>),
        fetch('https://api.github.com/repos/isaacsight/kernel', { signal: AbortSignal.timeout(3000) })
          .then(r => r.json() as Promise<{ stargazers_count?: number; open_issues_count?: number }>),
      ])

      if (npmVersionRes.status === 'fulfilled' && npmVersionRes.value.version) {
        latestVersion = npmVersionRes.value.version
        isLatest = VERSION === latestVersion
      }
      if (npmDlRes.status === 'fulfilled' && npmDlRes.value.downloads !== undefined) {
        npmDownloads.downloads = npmDlRes.value.downloads
      }
      if (ghRes.status === 'fulfilled' && ghRes.value.stargazers_count !== undefined) {
        githubData.stars = ghRes.value.stargazers_count
        githubData.issues = ghRes.value.open_issues_count ?? 0
      }

      // ── 2. Learning stats ──
      const { getStats } = await import('./learning.js')
      const stats = getStats()

      // ── 3. Collective ──
      const { getOptInState } = await import('./collective.js')
      const collectiveState = getOptInState()

      // ── 4. Tools count ──
      const { getAllTools } = await import('./tools/index.js')
      const toolCount = getAllTools().length || 290 // fallback to known count if tools not yet registered

      // ── 5. Bootstrap (autotelic score) ──
      let bootstrapScore = 0
      let bootstrapMax = 0
      let bootstrapGrade = '?'
      let bootstrapTopFix = ''
      let distributionPct = ''
      try {
        const { runBootstrap } = await import('./bootstrap.js')
        const report = await runBootstrap()
        bootstrapScore = report.score
        bootstrapMax = report.maxScore
        bootstrapGrade = report.grade
        bootstrapTopFix = report.topFix
        const distSection = report.sections.find(s => s.name.toLowerCase().includes('distribution'))
        if (distSection) {
          distributionPct = `${Math.round((distSection.score / distSection.maxScore) * 100)}%`
        }
      } catch { /* bootstrap can fail if not in a project dir */ }

      // ── 6. Cognitive modules — count from known list ──
      const cognitiveModules = [
        'learning', 'entropy-context', 'autopoiesis', 'free-energy',
        'predictive-processing', 'reasoning', 'intentionality',
        'temporal', 'confidence', 'strange-loops', 'integrated-information',
      ]
      const cognitiveCount = cognitiveModules.length // 11

      // ── JSON output ──
      if (jsonMode) {
        console.log(JSON.stringify({
          version: VERSION,
          latestVersion: latestVersion || null,
          isLatest,
          tools: toolCount,
          agents: 23,
          cognitiveModules: cognitiveCount,
          learning: {
            patterns: stats.patternsCount,
            solutions: stats.solutionsCount,
            tokensSaved: stats.totalTokensSaved,
            efficiency: stats.efficiency,
          },
          collective: {
            enabled: collectiveState.enabled,
            signalsSent: collectiveState.total_signals_sent,
          },
          npm: { weeklyDownloads: npmDownloads.downloads ?? null },
          github: { stars: githubData.stars ?? null, issues: githubData.issues ?? null },
          bootstrap: {
            score: bootstrapScore,
            maxScore: bootstrapMax,
            grade: bootstrapGrade,
            topFix: bootstrapTopFix,
          },
        }, null, 2))
        return
      }

      // ── Formatted dashboard ──
      const versionTag = latestVersion
        ? (isLatest ? GREEN(' (latest ✓)') : YELLOW(` (update: ${latestVersion})`))
        : DIM(' (offline)')

      const fmtNum = (n: number): string => n.toLocaleString()

      process.stderr.write('\n')
      process.stderr.write(`  ${AMETHYST('◉')} ${chalk.bold('Kernel Status')}\n`)
      process.stderr.write(line + '\n')
      process.stderr.write(`  ${chalk.bold('Version')}     ${VERSION}${versionTag}\n`)
      process.stderr.write(`  ${chalk.bold('Tools')}       ${fmtNum(toolCount)} ${DIM('|')} ${chalk.bold('Agents')} 23\n`)
      process.stderr.write(`  ${chalk.bold('Cognitive')}   ${cognitiveCount}/${cognitiveCount} modules active\n`)
      process.stderr.write(line + '\n')

      // Learning
      const tokensSavedStr = stats.totalTokensSaved > 0 ? fmtNum(stats.totalTokensSaved) + ' tokens saved' : 'learning...'
      process.stderr.write(`  ${chalk.bold('Learning')}    ${fmtNum(stats.patternsCount)} patterns ${DIM('|')} ${fmtNum(stats.solutionsCount)} solutions ${DIM('|')} ${tokensSavedStr}\n`)

      // Collective
      const collectiveEnabled = collectiveState.enabled ? GREEN('enabled') : DIM('disabled')
      const signalsSent = fmtNum(collectiveState.total_signals_sent || 0)
      process.stderr.write(`  ${chalk.bold('Collective')}  ${collectiveEnabled} ${DIM('|')} ${signalsSent} signals sent\n`)
      process.stderr.write(line + '\n')

      // npm
      if (npmDownloads.downloads !== undefined) {
        process.stderr.write(`  ${chalk.bold('npm')}         ${CYAN(fmtNum(npmDownloads.downloads))} downloads/week\n`)
      } else {
        process.stderr.write(`  ${chalk.bold('npm')}         ${DIM('unavailable')}\n`)
      }

      // GitHub
      if (githubData.stars !== undefined) {
        const starStr = `${fmtNum(githubData.stars!)} star${githubData.stars === 1 ? '' : 's'}`
        const issueStr = `${fmtNum(githubData.issues!)} issue${githubData.issues === 1 ? '' : 's'}`
        process.stderr.write(`  ${chalk.bold('GitHub')}      ${starStr} ${DIM('|')} ${issueStr}\n`)
      } else {
        process.stderr.write(`  ${chalk.bold('GitHub')}      ${DIM('unavailable')}\n`)
      }

      // Bootstrap
      if (bootstrapMax > 0) {
        const pct = Math.round((bootstrapScore / bootstrapMax) * 100)
        const gradeColor = pct >= 80 ? GREEN : pct >= 60 ? YELLOW : RED
        const distStr = distributionPct ? ` ${DIM('— distribution at')} ${distributionPct}` : ''
        process.stderr.write(`  ${chalk.bold('Bootstrap')}   ${bootstrapScore}/${bootstrapMax} (${gradeColor(bootstrapGrade)})${distStr}\n`)
      }

      process.stderr.write(line + '\n')

      // Next action (top fix from bootstrap)
      if (bootstrapTopFix) {
        process.stderr.write(`  ${chalk.bold('Next:')} ${bootstrapTopFix}\n`)
      }

      process.stderr.write('\n')
    })

  program
    .command('immune')
    .description('Self-audit — kbot\'s immune system scans its own code for bugs, security holes, and bad decisions')
    .option('--file <path>', 'Audit a specific file instead of the full scan')
    .option('--security', 'Focus on security (blocklist bypasses, injection vectors)')
    .action(async (opts: { file?: string; security?: boolean }) => {
      const { runAgent } = await import('./agent.js')
      const chalk = (await import('chalk')).default
      process.stderr.write(`\n  ${chalk.hex('#DC143C')('🛡 Immune Agent')} — Self-Audit\n\n`)

      const target = opts.file
        ? `Read and audit this specific file: ${opts.file}`
        : 'Audit the core files: src/tools/forge.ts, src/autopoiesis.ts, src/tool-pipeline.ts, src/planner.ts, src/auth.ts'

      const focus = opts.security
        ? 'Focus exclusively on security: blocklist bypasses, injection vectors, privilege escalation, data leakage.'
        : 'Find all real bugs: security holes, logic errors, and silent degradation bugs (wrong results without crashing).'

      const prompt = `You are the Immune agent running a self-audit. ${target}. ${focus} For each bug: state the file, line, severity (HIGH/MEDIUM/LOW), what's wrong, and the exact fix. Only report REAL bugs, not style issues.`

      try {
        const response = await runAgent(prompt, {
          agent: 'immune',
          stream: true,
        })
        if (!response.streamed) {
          process.stderr.write(response.content)
        }
        process.stderr.write(`\n\n  ${chalk.dim(`${response.toolCalls} tool calls · ${response.model}`)}\n\n`)
      } catch (err) {
        printError(`Audit failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

  program
    .command('bootstrap')
    .description('Measure the gap between what your project IS and what the world SEES')
    .option('--json', 'Output as JSON')
    .option('--markdown', 'Output as shareable Markdown')
    .option('--share', 'Share the report as a GitHub Gist')
    .action(async (opts: { json?: boolean; markdown?: boolean; share?: boolean }) => {
      const { runBootstrap, formatBootstrapReport, formatBootstrapMarkdown } = await import('./bootstrap.js')
      process.stderr.write('\n')
      printInfo('kbot Bootstrap — Measuring your project\'s visibility...')
      try {
        const report = await runBootstrap()
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2))
        } else if (opts.markdown) {
          console.log(formatBootstrapMarkdown(report))
        } else {
          process.stderr.write(formatBootstrapReport(report))
        }
        if (opts.share) {
          try {
            const { createGist } = await import('./share.js')
            const md = formatBootstrapMarkdown(report)
            const url = createGist(md, `kbot-bootstrap-${report.project}.md`, `kbot Bootstrap: ${report.project}`, true)
            if (url?.startsWith('http')) printSuccess(`Shared! ${url}`)
          } catch { printInfo('Could not create Gist. Install GitHub CLI: brew install gh') }
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
    })

  program
    .command('collective')
    .description('Collective learning — join 4,000+ kbot users sharing anonymized intelligence')
    .option('--enable', 'Opt in to collective learning')
    .option('--disable', 'Opt out of collective learning')
    .option('--status', 'Show collective learning status')
    .option('--pull', 'Pull latest collective patterns')
    .option('--diagnose', 'Run end-to-end health check on collective connectivity')
    .option('--insights', 'Show what the collective knows (hints table + top patterns)')
    .action(async (opts: { enable?: boolean; disable?: boolean; status?: boolean; pull?: boolean; diagnose?: boolean; insights?: boolean }) => {
      const { setOptIn, getCollectiveStats, pullCollectiveHints, pullCollectivePatterns, getOptInState, sendSignal, getSignalQueueSize } = await import('./collective.js')

      if (opts.enable) {
        setOptIn(true)
        printSuccess('Collective learning enabled!')
        printInfo('kbot will share anonymized routing signals (never code, never files, never identity).')
        printInfo('Run `kbot collective --status` to see stats.')
        return
      }

      if (opts.disable) {
        setOptIn(false)
        printSuccess('Collective learning disabled. Your data stays local.')
        return
      }

      if (opts.pull) {
        printInfo('Pulling collective intelligence...')
        const [hints, patterns] = await Promise.all([pullCollectiveHints(), pullCollectivePatterns()])
        printSuccess(`Pulled ${hints.length} routing hints and ${patterns.length} patterns from the collective.`)
        return
      }

      if (opts.diagnose) {
        console.log()
        printInfo('Collective Health Check')
        printInfo('─'.repeat(40))

        // 1. Opt-in status
        const state = getOptInState()
        if (state.enabled) {
          printSuccess(`Opt-in: enabled (since ${state.opted_in_at || 'unknown'})`)
        } else {
          printWarn('Opt-in: disabled — enable with `kbot collective --enable`')
        }

        // 2. Test signal
        printInfo('Sending test signal...')
        // Temporarily need opt-in for sendSignal to work
        const wasEnabled = state.enabled
        if (!wasEnabled) setOptIn(true)
        const testSignal = {
          message_hash: 'test',
          message_category: 'diagnostic',
          message_length: 4,
          routed_agent: 'kernel',
          classifier_confidence: 1.0,
          was_rerouted: false,
          response_quality: 1.0,
          tool_sequence: ['diagnostic_ping'],
          strategy: 'health_check',
          source: 'kbot' as const,
        }
        const signalOk = await sendSignal(testSignal)
        if (!wasEnabled) setOptIn(false) // Restore original state
        if (signalOk) {
          printSuccess('Signal send: OK — endpoint accepted the test signal')
        } else {
          printError('Signal send: FAILED — endpoint unreachable or rejected the signal')
        }

        // 3. Pull hints
        printInfo('Pulling routing hints...')
        try {
          const hints = await pullCollectiveHints()
          if (hints.length > 0) {
            printSuccess(`Hints pull: OK — ${hints.length} routing hints available`)
          } else {
            printWarn('Hints pull: empty — no routing hints available yet')
          }
        } catch {
          printError('Hints pull: FAILED — could not retrieve hints')
        }

        // 4. Pull patterns
        printInfo('Pulling collective patterns...')
        try {
          const patterns = await pullCollectivePatterns()
          if (patterns.length > 0) {
            printSuccess(`Patterns pull: OK — ${patterns.length} patterns available`)
          } else {
            printWarn('Patterns pull: empty — no patterns available yet')
          }
        } catch {
          printError('Patterns pull: FAILED — could not retrieve patterns')
        }

        // 5. Signal queue status
        const queueSize = getSignalQueueSize()
        if (queueSize === 0) {
          printSuccess('Signal queue: empty (all signals flushed)')
        } else {
          printInfo(`Signal queue: ${queueSize} signal(s) pending flush`)
        }

        // Summary
        console.log()
        printInfo(`Total signals sent: ${state.total_signals_sent}`)
        printInfo(`Last signal: ${state.last_signal_at || 'never'}`)
        console.log()
        return
      }

      if (opts.insights) {
        console.log()
        printInfo('Collective Intelligence Insights')
        printInfo('═'.repeat(50))

        // Pull fresh data
        const [hints, patterns] = await Promise.all([pullCollectiveHints(), pullCollectivePatterns()])

        // Routing hints table
        console.log()
        printInfo('Routing Hints')
        printInfo('─'.repeat(50))
        if (hints.length === 0) {
          printWarn('No routing hints available yet. The collective needs more signals.')
        } else {
          // Table header
          const catW = 18, agentW = 14, confW = 12, sampW = 8
          console.log(
            chalk.bold('  ' +
              'Category'.padEnd(catW) +
              'Best Agent'.padEnd(agentW) +
              'Confidence'.padEnd(confW) +
              'Samples'.padEnd(sampW)
            )
          )
          console.log('  ' + '─'.repeat(catW + agentW + confW + sampW))
          for (const h of hints) {
            const conf = (h.confidence * 100).toFixed(0) + '%'
            console.log(
              '  ' +
              h.category.padEnd(catW) +
              h.best_agent.padEnd(agentW) +
              conf.padEnd(confW) +
              String(h.sample_count).padEnd(sampW)
            )
          }
        }

        // Top tool-sequence patterns
        console.log()
        printInfo('Top Tool Sequences')
        printInfo('─'.repeat(50))
        const toolPatterns = patterns
          .filter(p => p.type === 'tool_sequence')
          .sort((a, b) => b.confidence - a.confidence || b.sample_count - a.sample_count)
          .slice(0, 10)

        if (toolPatterns.length === 0) {
          printWarn('No tool-sequence patterns available yet.')
        } else {
          for (let i = 0; i < toolPatterns.length; i++) {
            const p = toolPatterns[i]
            const pat = p.pattern as Record<string, unknown>
            const tools = Array.isArray(pat.tools) ? (pat.tools as string[]).join(' → ') : 'unknown'
            const category = typeof pat.category === 'string' ? pat.category : 'general'
            const conf = (p.confidence * 100).toFixed(0) + '%'
            console.log(
              chalk.dim(`  ${String(i + 1).padStart(2)}.`) +
              ` [${category}] ` +
              chalk.cyan(tools) +
              chalk.dim(` (${conf}, ${p.sample_count} samples)`)
            )
          }
        }

        console.log()
        return
      }

      // Default: show status
      console.log()
      console.log(getCollectiveStats())
      console.log()
      const state = getOptInState()
      if (!state.enabled) {
        printInfo('Enable with: kbot collective --enable')
        printInfo('What gets shared: task categories, agent choices, tool names, success rates.')
        printInfo('What never leaves your machine: code, files, paths, keys, identity.')
      }
    })

  program
    .command('autotelic')
    .description('Self-purpose + self-agency: sense the highest-impact fix and decide what to do')
    .option('--json', 'Output as JSON')
    .option('--loop <count>', 'Run N cycles (default: 1)', '1')
    .action(async (opts: { json?: boolean; loop?: string }) => {
      const { runAutotelic, formatAutotelicCycle } = await import('./bootstrap.js')
      const loops = Math.min(parseInt(opts.loop || '1', 10) || 1, 10)
      for (let i = 0; i < loops; i++) {
        if (loops > 1) printInfo(`Autotelic cycle ${i + 1}/${loops}`)
        try {
          const cycle = await runAutotelic()
          if (opts.json) {
            console.log(JSON.stringify(cycle, null, 2))
          } else {
            process.stderr.write(formatAutotelicCycle(cycle))
          }
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err))
        }
      }
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
    .description('Start HTTP server — expose all 223 tools for kernel.chat or any client')
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
    .command('kbot-local')
    .description('Use kbot local gateway as AI provider')
    .option('--token <token>', 'Gateway auth token')
    .option('--off', 'Disable kbot local mode')
    .action(async (opts: { token?: string; off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('kbot local disabled. Provider disabled.')
        return
      }
      const ok = await setupKbotLocal(opts.token)
      if (ok) {
        printSuccess('kbot local enabled! Connected to local gateway at 127.0.0.1:18789.')
      } else {
        printError('Cannot connect to kbot local gateway. Start it first.')
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

  program
    .command('watch [path]')
    .description('Watch files for changes and analyze them in real-time')
    .option('-e, --extensions <exts>', 'File extensions to watch (comma-separated)', 'ts,js,tsx,jsx,py,rs,go')
    .option('--no-analyze', 'Disable file analysis on changes')
    .action(async (watchPath?: string, watchOpts?: { extensions?: string; analyze?: boolean }) => {
      const { startWatch } = await import('./watch.js')
      const extensions = watchOpts?.extensions?.split(',').map(e => `.${e.trim()}`) || undefined
      await startWatch(watchPath || process.cwd(), {
        extensions,
        analyze: watchOpts?.analyze !== false,
      })
    })

  program
    .command('voice')
    .description('Start kbot with voice mode (text-to-speech output)')
    .option('-v, --voice <name>', 'TTS voice name (macOS: Alex, Samantha, etc.)')
    .option('-r, --rate <wpm>', 'Speech rate in words per minute', '200')
    .action(async (voiceOpts: { voice?: string; rate?: string }) => {
      const { initVoice } = await import('./voice.js')
      const state = initVoice({
        voice: voiceOpts.voice,
        rate: voiceOpts.rate ? parseInt(voiceOpts.rate, 10) : undefined,
        tts: true,
      })
      if (state.enabled) {
        printSuccess(`Voice mode enabled — ${state.voice} at ${state.rate} wpm`)
        // Store voice state globally for the REPL to use
        ;(globalThis as Record<string, unknown>).__kbot_voice = state
      } else {
        printError('Voice mode not available on this platform')
      }
    })

  program
    .command('export <session>')
    .description('Export a saved session to markdown, JSON, or HTML')
    .option('-f, --format <format>', 'Output format: md, json, html', 'md')
    .option('-o, --output <path>', 'Output file path (defaults to stdout)')
    .action(async (sessionId: string, exportOpts: { format?: string; output?: string }) => {
      const { exportSession } = await import('./export.js')
      const format = (exportOpts.format || 'md') as 'md' | 'json' | 'html'
      try {
        const result = exportSession(sessionId, format, exportOpts.output)
        if (exportOpts.output) {
          printSuccess(`Exported session to ${exportOpts.output}`)
        } else {
          process.stdout.write(result)
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
    })

  program
    .command('share [session]')
    .description('Share a conversation as a GitHub Gist — get a public link')
    .option('-t, --title <title>', 'Title for the shared conversation')
    .option('--private', 'Create a secret (unlisted) gist')
    .action(async (sessionId?: string, shareOpts?: { title?: string; private?: boolean }) => {
      const { shareConversation } = await import('./share.js')
      try {
        const result = await shareConversation(sessionId, {
          title: shareOpts?.title,
          public: !shareOpts?.private,
        })
        if (result.method === 'gist') {
          printSuccess(`Shared! ${result.url}`)
          printInfo('Link copied to clipboard.')
        } else if (result.method === 'clipboard') {
          printSuccess('Conversation copied to clipboard as markdown.')
          printInfo('Paste it anywhere — GitHub, Discord, Twitter, etc.')
        } else {
          process.stdout.write(result.markdown)
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
    })

  program
    .command('audit <repo>')
    .description('Full audit of any GitHub repository — security, quality, docs, DevOps')
    .option('--share', 'Share the audit report as a GitHub Gist')
    .action(async (repo: string, auditOpts: { share?: boolean }) => {
      const { auditRepo, formatAuditReport } = await import('./tools/audit.js')
      printInfo(`Auditing ${repo}...`)
      try {
        const result = await auditRepo(repo)
        const report = formatAuditReport(result)
        console.log(report)
        if (auditOpts.share) {
          const { shareConversation } = await import('./share.js')
          // Save as a pseudo-conversation for sharing
          printInfo('Sharing audit report...')
          try {
            const { createGist } = await import('./share.js')
            const url = createGist(report, `kbot-audit-${repo.replace('/', '-')}.md`, `kbot Audit: ${repo}`, true)
            if (url?.startsWith('http')) printSuccess(`Shared! ${url}`)
          } catch { printInfo('Could not create Gist. Install GitHub CLI: brew install gh') }
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
    })

  program
    .command('contribute [repo]')
    .description('Find open source issues and prepare contributions')
    .option('-l, --language <lang>', 'Filter by programming language')
    .option('--label <label>', 'Issue label (default: "good first issue")')
    .option('-i, --issue <number>', 'Specific issue number to work on')
    .action(async (repo?: string, contribOpts?: { language?: string; label?: string; issue?: string }) => {
      if (!repo) {
        // Search for issues
        const { registerContributeTools } = await import('./tools/contribute.js')
        const { executeTool } = await import('./tools/index.js')
        printInfo('Searching for contribution opportunities...')
        const result = await executeTool({
          id: 'cli',
          name: 'find_issues',
          arguments: {
            language: contribOpts?.language || '',
            label: contribOpts?.label || 'good first issue',
          },
        })
        console.log(result.result)
      } else if (contribOpts?.issue) {
        // Prepare contribution for specific issue
        printInfo(`Preparing contribution for ${repo}#${contribOpts.issue}...`)
        const { registerContributeTools } = await import('./tools/contribute.js')
        const { executeTool } = await import('./tools/index.js')
        const result = await executeTool({
          id: 'cli',
          name: 'prepare_contribution',
          arguments: { repo, issue: Number(contribOpts.issue) },
        })
        console.log(result.result)
      } else {
        // Scan for quick wins
        const { registerContributeTools } = await import('./tools/contribute.js')
        const { executeTool } = await import('./tools/index.js')
        printInfo(`Scanning ${repo} for contribution opportunities...`)
        const result = await executeTool({
          id: 'cli',
          name: 'find_quick_wins',
          arguments: { repo },
        })
        console.log(result.result)
      }
    })

  program
    .command('plugins')
    .description('Manage kbot plugins')
    .argument('[action]', 'Action: list, search, install, uninstall, update')
    .argument('[target]', 'Plugin name, query, or URL')
    .action(async (action?: string, target?: string) => {
      const { searchPlugins, installPlugin, uninstallPlugin, listInstalled, updatePlugin, formatRegistryResults, formatInstalledList } = await import('./marketplace.js')
      switch (action) {
        case 'search': {
          if (!target) { printError('Usage: kbot plugins search <query>'); return }
          const results = await searchPlugins(target)
          console.log(formatRegistryResults(results))
          break
        }
        case 'install': {
          if (!target) { printError('Usage: kbot plugins install <name>'); return }
          printInfo(`Installing ${target}...`)
          try {
            const installed = await installPlugin(target)
            printSuccess(`Installed ${installed.name} v${installed.version}`)
          } catch (err) {
            printError(err instanceof Error ? err.message : String(err))
          }
          break
        }
        case 'uninstall': {
          if (!target) { printError('Usage: kbot plugins uninstall <name>'); return }
          const ok = uninstallPlugin(target)
          if (ok) printSuccess(`Uninstalled ${target}`)
          else printError(`Plugin not found: ${target}`)
          break
        }
        case 'update': {
          if (!target) { printError('Usage: kbot plugins update <name>'); return }
          const updated = await updatePlugin(target)
          if (updated) printSuccess(`Updated ${updated.name} to v${updated.version}`)
          else printError(`Plugin not found or update failed: ${target}`)
          break
        }
        default: {
          const plugins = listInstalled()
          console.log(formatInstalledList(plugins))
          if (plugins.length === 0) {
            printInfo('')
            printInfo('  kbot plugins search <query>  — Find plugins')
            printInfo('  kbot plugins install <name>  — Install a plugin')
          }
        }
      }
    })

  program
    .command('changelog')
    .description('Generate a changelog from git history (outputs markdown to stdout)')
    .option('--since <ref>', 'Git ref to start from (tag, commit, branch)')
    .action(async (changelogOpts: { since?: string }) => {
      const { generateChangelog } = await import('./changelog.js')
      const md = generateChangelog({ since: changelogOpts.since, format: 'markdown' })
      process.stdout.write(md)
    })

  // ── Automate subcommands ──
  const automateCmd = program
    .command('automate')
    .description('Event-driven automations — file watchers, schedules, git hooks, webhooks')

  automateCmd
    .command('list')
    .description('List all configured automations')
    .action(async () => {
      const { listAutomations, formatAutomationList } = await import('./automations.js')
      const automations = listAutomations()
      process.stderr.write(formatAutomationList(automations) + '\n')
    })

  automateCmd
    .command('add')
    .description('Create a new automation')
    .requiredOption('--trigger <trigger>', 'Trigger spec (e.g., "file:src/**/*.ts:change", "schedule:every 5m", "git:pre-commit", "webhook:/deploy")')
    .requiredOption('--agent <agent>', 'Agent to run (e.g., coder, researcher, guardian)')
    .requiredOption('--prompt <prompt>', 'Prompt to send to the agent')
    .option('--name <name>', 'Human-readable name for the automation')
    .option('--tools <tools>', 'Comma-separated list of tools to enable')
    .action(async (addOpts: { trigger: string; agent: string; prompt: string; name?: string; tools?: string }) => {
      try {
        const { createAutomation, parseTriggerString } = await import('./automations.js')
        const trigger = parseTriggerString(addOpts.trigger)
        const automation = createAutomation({
          name: addOpts.name || `${trigger.type}:${addOpts.agent}`,
          trigger,
          action: {
            agent: addOpts.agent,
            prompt: addOpts.prompt,
            tools: addOpts.tools ? addOpts.tools.split(',').map((t) => t.trim()) : undefined,
          },
        })
        printSuccess(`Automation created: ${automation.name} (${automation.id})`)
        printInfo(`  Trigger: ${addOpts.trigger}`)
        printInfo(`  Agent: ${addOpts.agent}`)
        if (trigger.type === 'git') {
          printInfo('  Git hooks installed.')
        }
        if (trigger.type === 'file' || trigger.type === 'schedule') {
          printInfo('  Run `kbot automate start` to activate the daemon.')
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  automateCmd
    .command('remove')
    .description('Remove an automation by ID')
    .argument('<id>', 'Automation ID')
    .action(async (id: string) => {
      const { removeAutomation } = await import('./automations.js')
      const removed = removeAutomation(id)
      if (removed) {
        printSuccess(`Automation "${id}" removed.`)
      } else {
        printError(`Automation "${id}" not found.`)
        process.exit(1)
      }
    })

  automateCmd
    .command('run')
    .description('Manually trigger an automation')
    .argument('<id>', 'Automation ID')
    .action(async (id: string) => {
      const { runAutomation, getAutomation } = await import('./automations.js')
      const automation = getAutomation(id)
      if (!automation) {
        printError(`Automation "${id}" not found.`)
        process.exit(1)
      }
      printInfo(`Running automation: ${automation.name}...`)
      const result = await runAutomation(id)
      if (result.success) {
        printSuccess(`Automation completed successfully.`)
        if (result.output) {
          process.stderr.write('\n' + result.output + '\n')
        }
      } else {
        printError(`Automation failed: ${result.error}`)
        process.exit(1)
      }
    })

  automateCmd
    .command('start')
    .description('Start the automation daemon (file watchers + schedule timers)')
    .action(async () => {
      const { startAutomationDaemon, listAutomations } = await import('./automations.js')
      const automations = listAutomations()
      if (automations.length === 0) {
        printError('No automations configured. Use `kbot automate add` first.')
        process.exit(1)
      }
      printInfo('Starting automation daemon...')
      const { running } = startAutomationDaemon({
        log: (msg) => process.stderr.write(msg + '\n'),
      })
      if (running) {
        printSuccess('Daemon running. Press Ctrl+C to stop.')
        // Keep the process alive
        await new Promise(() => {})
      }
    })

  program
    .command('spec <description>')
    .description('Generate a formal specification with requirements + acceptance criteria before coding')
    .option('--implement', 'Generate spec then pass to coder agent for implementation')
    .option('--agent <name>', 'Override the default architect agent', 'architect')
    .option('--output <path>', 'Custom output path for the spec file')
    .action(async (description: string, specOpts: { implement?: boolean; agent?: string; output?: string }) => {
      const { generateSpec } = await import('./spec.js')
      const parentOpts = program.opts()
      try {
        await generateSpec(description, {
          agent: specOpts.agent,
          output: specOpts.output,
          implement: specOpts.implement,
          agentOpts: {
            model: parentOpts.model,
            stream: parentOpts.stream ?? true,
            thinking: parentOpts.thinking || false,
            thinkingBudget: parentOpts.thinkingBudget ? (parseInt(parentOpts.thinkingBudget, 10) || 10000) : undefined,
          },
        })
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  program
    .command('completions')
    .description('Generate shell tab-completion script (bash, zsh, fish)')
    .argument('<shell>', 'Shell type: bash, zsh, or fish')
    .action(async (shell: string) => {
      const validShells = ['bash', 'zsh', 'fish'] as const
      if (!validShells.includes(shell as typeof validShells[number])) {
        printError(`Unknown shell: ${shell}. Use: bash, zsh, or fish`)
        process.exit(1)
      }
      const { generateCompletions } = await import('./completions.js')
      process.stdout.write(generateCompletions(shell as 'bash' | 'zsh' | 'fish'))
    })

  program.parse(process.argv)

  const opts = program.opts()
  const promptArgs = program.args

  // Quiet mode: suppress banners, spinners, status messages
  if (opts.quiet) setQuiet(true)

  // If a sub-command was run, we're done
  if (['byok', 'auth', 'ide', 'local', 'ollama', 'kbot-local', 'pull', 'doctor', 'serve', 'agents', 'watch', 'voice', 'export', 'plugins', 'changelog', 'completions', 'automate', 'status', 'spec'].includes(program.args[0])) return

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
      const [ollamaResult, lmstudioResult, janResult, kbotLocalResult] = await Promise.allSettled([
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
        // Check kbot local
        (async () => {
          try {
            const res = await fetch('http://127.0.0.1:18789/health', { signal: AbortSignal.timeout(1500) })
            if (!res.ok) return null
            const ok = await setupKbotLocal()
            return ok ? { provider: 'kbot-local' as const } : null
          } catch { return null }
        })(),
      ])

      // Prefer Ollama > LM Studio > Jan > kbot local
      const ollamaOk = ollamaResult.status === 'fulfilled' && ollamaResult.value
      const lmstudioOk = lmstudioResult.status === 'fulfilled' && lmstudioResult.value
      const janOk = janResult.status === 'fulfilled' && janResult.value
      const kbotLocalOk = kbotLocalResult.status === 'fulfilled' && kbotLocalResult.value

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
      } else if (kbotLocalOk) {
        byokActive = true
        localActive = true
        printSuccess('Auto-configured kbot local gateway. Ready — $0 cost!')
      } else {
        // Priority 3: Embedded llama.cpp — always available, no external service needed
        try {
          setupEmbedded()
          byokActive = true
          localActive = true
          printSuccess('Using embedded AI engine. Ready — $0 cost, fully private!')
          printInfo('Lightweight model — for better quality: install Ollama (https://ollama.com) or run kbot auth')
        } catch {
          // Embedded not available — fall through to guided setup
        }
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

  // Parallel startup: register core tools (fast), gather context, check updates, cloud sync
  const toolOpts = { computerUse: opts.computerUse }
  const [, context, , syncMsg] = await Promise.all([
    registerCoreTools(toolOpts),
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

  // Determine if we're in one-shot or REPL mode
  const isOneShot = promptArgs.length > 0 &&
    !['byok', 'auth', 'ide', 'ollama', 'kbot-local', 'pull', 'doctor', 'spec'].includes(promptArgs[0])
  const isStdinOnly = !process.stdin.isTTY && promptArgs.length === 0

  if (isOneShot || isStdinOnly || opts.pipe) {
    // One-shot / pipe mode: start lazy tools in background (non-blocking).
    // The agent loop will await them via ensureLazyToolsLoaded() if needed.
    startLazyToolRegistration(toolOpts).catch(() => {})
  } else {
    // REPL mode: wait for all tools before first prompt
    await ensureLazyToolsLoaded(toolOpts)
  }

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
    plan: opts.plan || false,
  }

  // Enable self-evaluation if requested
  if (opts.selfEval) {
    const { setSelfEvalEnabled } = await import('./self-eval.js')
    setSelfEvalEnabled(true)
  }

  // ── Checkpoint recovery: detect and offer to resume crashed sessions ──
  if (!opts.pipe && !opts.json) {
    try {
      const { CheckpointManager } = await import('./checkpoint.js')
      const cpManager = new CheckpointManager()
      const incomplete = await cpManager.listIncomplete()
      if (incomplete.length > 0) {
        const latest = incomplete[0]
        const age = Date.now() - latest.timestamp
        if (age < 24 * 60 * 60 * 1000) { // less than 24 hours old
          const ageMinutes = Math.round(age / 60_000)
          const ageStr = ageMinutes < 60
            ? `${ageMinutes}m ago`
            : `${Math.round(ageMinutes / 60)}h ago`
          printInfo(`Found interrupted session (${ageStr}, ${latest.toolCallCount} tool calls, iteration ${latest.iteration})`)

          // Auto-resume in non-interactive mode, prompt in interactive
          if (process.stdin.isTTY) {
            const rl = createInterface({ input: process.stdin, output: process.stdout })
            const answer = await new Promise<string>(resolve => {
              rl.question('  Resume? (y/N) ', resolve)
            })
            rl.close()
            if (answer.toLowerCase().startsWith('y')) {
              const response = await runAgentFromCheckpoint(latest, agentOpts)
              printInfo(`Resumed session completed (${response.toolCalls} tool calls)`)
              return
            }
          }
        }
      }
      // Cleanup old checkpoints in the background (non-blocking)
      cpManager.cleanup().catch(() => {})
    } catch {
      // Checkpoint recovery is non-critical — don't block startup
    }
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
  if (promptArgs.length > 0 && !['byok', 'auth', 'ide', 'ollama', 'kbot-local', 'pull', 'doctor', 'spec'].includes(promptArgs[0])) {
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
  printInfo('Supported providers (20):')
  printInfo('  Anthropic (Claude)    OpenAI (GPT)       Google (Gemini)')
  printInfo('  Mistral AI            xAI (Grok)         DeepSeek')
  printInfo('  Groq                  Together AI        Fireworks AI')
  printInfo('  Perplexity            Cohere             NVIDIA NIM')
  printInfo('  SambaNova             Cerebras           OpenRouter')
  printInfo('  Ollama (local, free)  LM Studio (local)  Embedded llama.cpp')
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
  printInfo('All 290 tools + 23 agents + learning system = yours.')
  console.log()
  printSuccess('Ready. Run `kbot` to start.')
}

/** Guided setup for first-time users who have no AI experience */
async function guidedSetup(): Promise<{ local: boolean } | null> {
  console.log(banner(VERSION))
  console.log()
  console.log(chalk.bold('  Hey! I\'m kbot — your AI assistant for the terminal.'))
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

    // Ollama not running or not installed — fall back to embedded llama.cpp
    printInfo('No Ollama found. Setting up embedded AI engine (no install needed)...')
    console.log()
    try {
      setupEmbedded()
      printSuccess('Embedded AI engine ready. You\'re good to go — $0, fully private!')
      printInfo('Lightweight model — for better quality: install Ollama (https://ollama.com) or run kbot auth')
      return { local: true }
    } catch {
      // Embedded also failed — give Ollama instructions as last resort
      console.log(chalk.bold('  To run AI locally, install Ollama (free, 1 minute):'))
      console.log()
      console.log(`  ${chalk.bold('Step 1:')} Download Ollama from ${chalk.underline('https://ollama.com')}`)
      console.log(`  ${chalk.bold('Step 2:')} Open the Ollama app (it runs in the background)`)
      console.log(`  ${chalk.bold('Step 3:')} Run: ${chalk.cyan('kbot')} again — it will auto-detect Ollama`)
      console.log()
      return null
    }
  }

  if (choice === '2' || choice === 'cloud' || choice === 'api') {
    console.log()
    console.log(chalk.dim('  Paste your API key below. kbot will auto-detect which service it\'s from.'))
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

/** Scan cwd for project signals and return contextual example prompts */
async function detectProjectSuggestions(): Promise<string[]> {
  const cwd = process.cwd()
  const dir = basename(cwd)
  const has = (f: string) => existsSync(join(cwd, f))

  // Detect project type and return relevant suggestions
  if (has('package.json')) {
    const suggestions = [`"explain this project"`, `"find bugs in src/"`]
    if (has('tsconfig.json')) {
      suggestions.push(`"write tests for the main module"`)
    } else {
      suggestions.push(`"add TypeScript to this project"`)
    }
    if (has('.github')) {
      suggestions.push(`"review my CI pipeline"`)
    } else {
      suggestions.push(`"set up GitHub Actions CI"`)
    }
    return suggestions
  }

  if (has('Cargo.toml')) {
    return [
      `"explain the crate structure"`,
      `"find unsafe blocks in src/"`,
      `"write tests for lib.rs"`,
      `"check for common Rust pitfalls"`,
    ]
  }

  if (has('pyproject.toml') || has('setup.py') || has('requirements.txt')) {
    return [
      `"explain this Python project"`,
      `"find potential bugs in the code"`,
      `"add type hints to the main module"`,
      `"write pytest tests"`,
    ]
  }

  if (has('go.mod')) {
    return [
      `"explain the package structure"`,
      `"find error handling issues"`,
      `"write table-driven tests"`,
      `"check for goroutine leaks"`,
    ]
  }

  if (has('Dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml')) {
    return [
      `"review my Docker setup"`,
      `"optimize the Dockerfile"`,
      `"add health checks"`,
      `"set up multi-stage builds"`,
    ]
  }

  if (has('.git')) {
    return [
      `"explain this project"`,
      `"summarize recent changes"`,
      `"find TODO comments"`,
      `"search arxiv for transformer architectures"`,
    ]
  }

  // No project detected — show general capabilities
  return []
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
    } else if (provider === 'kbot-local') {
      printInfo('kbot local · local · free')
    }
  } else if (byokActive) {
    const config = loadConfig()
    const p = config?.byok_provider ? PROVIDERS[config.byok_provider] : null
    if (p) printInfo(`${p.name}`)
  }

  const sessionCount = incrementSessions()

  // Three-tier memory: run synthesis on every 10th session (or first time with enough data)
  if (sessionCount % 10 === 0 || sessionCount === 1) {
    try {
      const insightCount = maybeSynthesize()
      if (insightCount > 0) {
        printInfo(`Memory synthesis: ${insightCount} insights generated`)
      }
    } catch { /* synthesis is non-critical */ }
  }

  // Return-visit greeting — show kbot's growth
  if (sessionCount > 1) {
    const stats = getExtendedStats()
    const synthStats = getSynthesisStats()
    const parts: string[] = []
    if (stats.patternsCount > 0) parts.push(`${stats.patternsCount} patterns learned`)
    if (stats.solutionsCount > 0) parts.push(`${stats.solutionsCount} solutions cached`)
    if (stats.knowledgeCount > 0) parts.push(`${stats.knowledgeCount} facts remembered`)
    if (synthStats.insightCount > 0) parts.push(`${synthStats.insightCount} insights synthesized`)
    if (parts.length > 0) {
      printInfo(`Session ${stats.sessions} · ${parts.join(' · ')}`)
    }
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: kbotPrompt(),
  })

  // First time? Show what kbot can do + project context
  if (sessionCount <= 1) {
    // Auto-detect project and show relevant suggestions
    const suggestions = await detectProjectSuggestions()
    console.log()
    console.log(chalk.dim('  ┌─────────────────────────────────────────────────┐'))
    console.log(chalk.dim('  │') + chalk.bold('  23 agents. 290 tools. Just say what you need.  ') + chalk.dim(' │'))
    console.log(chalk.dim('  │                                                 │'))
    if (suggestions.length > 0) {
      for (const s of suggestions.slice(0, 4)) {
        console.log(chalk.dim('  │') + `  ${s}`.padEnd(49) + chalk.dim('  │'))
      }
    } else {
      console.log(chalk.dim('  │') + '  "explain this project"                        ' + chalk.dim('  │'))
      console.log(chalk.dim('  │') + '  "find bugs in src/"                           ' + chalk.dim('  │'))
      console.log(chalk.dim('  │') + '  "write tests for auth.ts"                     ' + chalk.dim('  │'))
      console.log(chalk.dim('  │') + '  "search arxiv for transformer architectures"  ' + chalk.dim('  │'))
    }
    console.log(chalk.dim('  │                                                 │'))
    console.log(chalk.dim('  │') + chalk.dim('  /help — commands  ·  /agent — specialists       ') + chalk.dim(' │'))
    if (!localActive && byokActive) {
      console.log(chalk.dim('  │') + chalk.dim('  kbot auth — switch provider or add API key      ') + chalk.dim(' │'))
    }
    console.log(chalk.dim('  └─────────────────────────────────────────────────┘'))
    console.log()

    // First-run collective learning nudge
    try {
      const { isCollectiveEnabled } = await import('./collective.js')
      if (!isCollectiveEnabled()) {
        printInfo('Join 4,000+ developers making kbot smarter for everyone:')
        printInfo('  kbot collective --enable')
        printInfo('  (anonymized — never shares code, files, or identity)')
        console.log()
      }
    } catch { /* collective module not available — skip silently */ }
  } else if (sessionCount <= 5) {
    // Sessions 2-5: rotate useful tips they might not know
    const tips = [
      'Tip: Use your own API key for unlimited messages — run kbot auth',
      'Tip: kbot picks the right specialist for you. Try asking about science, code, or writing.',
      'Tip: Type /save to keep this conversation. /resume to pick it up later.',
      'Tip: kbot learns from you. The more you use it, the better it gets.',
      'Tip: Run models locally for $0 — kbot local --embedded (no Ollama needed)',
    ]
    printInfo(tips[Math.min(sessionCount - 2, tips.length - 1)])
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
      await runTutorial(rl)
      break
    }

    case 'agent':
      if (args[0]) {
        opts.agent = args[0]
        printSuccess(`Agent set to: ${args[0]}`)
      } else {
        printInfo(`Current agent: ${opts.agent || 'auto'}`)
        printInfo('Built-in: kernel, researcher, coder, writer, analyst, aesthete, guardian, curator, strategist, creative, developer')
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

    case 'map-elites':
    case 'elites':
    case 'qd': {
      const { initArchive, getArchiveStats, getArchiveCoverage } = await import('./quality-diversity.js')
      initArchive()
      const stats = getArchiveStats()
      printInfo(`MAP-Elites Archive: ${stats.totalElites} elites, ${(stats.coverage * 100).toFixed(0)}% coverage, avg fitness ${stats.avgFitness.toFixed(3)}`)
      console.log()
      console.log(getArchiveCoverage())
      if (stats.topElites.length > 0) {
        console.log()
        printInfo('Top elites:')
        for (const e of stats.topElites.slice(0, 5)) {
          printInfo(`  fitness=${e.fitness.toFixed(3)} tools=${e.pattern.toolSequence.join('→')} uses=${e.metadata.uses}`)
        }
      }
      break
    }

    case 'evolve': {
      const sub = args[0]
      if (sub === 'status') {
        const { formatEvolutionStatus } = await import('./evolution.js')
        console.log(formatEvolutionStatus())
      } else if (sub === 'diagnose') {
        const { diagnose, formatDiagnosis } = await import('./evolution.js')
        const weaknesses = diagnose()
        console.log(formatDiagnosis(weaknesses))
      } else if (sub === 'log') {
        const { getEvolutionLog } = await import('./evolution.js')
        const log = getEvolutionLog()
        if (log.length === 0) {
          printInfo('No evolution cycles recorded yet. Run /evolve to start one.')
        } else {
          for (const cycle of log.slice(-5)) {
            const applied = cycle.results.filter(r => r.status === 'applied').length
            const rolled = cycle.results.filter(r => r.status === 'rolled-back').length
            printInfo(`${cycle.id}  ${cycle.status}  applied=${applied} rolled-back=${rolled}  ${cycle.startedAt}`)
          }
        }
      } else {
        // Run a full evolution cycle
        printInfo('Starting evolution cycle...')
        const { diagnose, formatDiagnosis, runEvolutionCycle } = await import('./evolution.js')
        const weaknesses = diagnose()
        console.log(formatDiagnosis(weaknesses))
        if (weaknesses.length > 0) {
          printInfo('Proposing improvements...')
          const cycle = await runEvolutionCycle()
          for (const r of cycle.results) {
            const icon = r.status === 'applied' ? '✓' : r.status === 'rolled-back' ? '✗' : '○'
            const msg = `${icon} ${r.weakness.area}: ${r.reason.slice(0, 80)}`
            if (r.status === 'applied') printSuccess(msg)
            else if (r.status === 'rolled-back') printError(msg)
            else printInfo(msg)
          }
          printInfo(`Cycle ${cycle.id} ${cycle.status}`)
        }
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

    case 'changelog': {
      const { generateChangelog } = await import('./changelog.js')
      const since = args[0] || undefined
      const output = generateChangelog({ since, format: 'terminal' })
      console.log(output)
      break
    }

    case 'local':
    case 'ollama': {
      if (args[0] === 'off') {
        disableByok()
        printSuccess('Local AI disabled.')
        break
      }
      const running = await isOllamaRunning()
      if (!running) { printError('No local runtime found. Install Ollama: https://ollama.com'); break }
      if (args[0] === 'list') {
        const models = await listOllamaModels()
        printInfo('Available local models:')
        for (const m of models) printInfo(`  • ${m}`)
        break
      }
      const model = args[0]
      const ok = await setupOllama(model)
      if (ok) {
        const models = await listOllamaModels()
        printSuccess(`Local AI enabled! ${models.length} models available. $0 cost.`)
        printInfo(`Default: ${model || PROVIDERS.ollama.defaultModel}`)
      } else {
        printError('Failed to connect to local runtime.')
      }
      break
    }

    case 'kbot-local': {
      if (args[0] === 'off') {
        disableByok()
        printSuccess('kbot local disabled.')
        break
      }
      const ok = await setupKbotLocal(args[0])
      if (ok) {
        printSuccess('kbot local gateway connected at 127.0.0.1:18789')
      } else {
        printError('Cannot connect to kbot local gateway.')
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
      printInfo('Switch: /local [model] | /kbot-local | kbot byok')
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



    case 'watch': {
      const { startWatch } = await import('./watch.js')
      const watchPath = args[0] || process.cwd()
      printInfo(`Watching ${watchPath} for changes... (Ctrl+C to stop)`)
      await startWatch(watchPath)
      break
    }

    case 'voice': {
      const { initVoice, listVoices, formatVoiceStatus } = await import('./voice.js')
      if (args[0] === 'off') {
        ;(globalThis as Record<string, unknown>).__kbot_voice = undefined
        printSuccess('Voice mode disabled.')
      } else if (args[0] === 'list') {
        const voices = listVoices()
        printInfo(`Available voices: ${voices.join(', ')}`)
      } else {
        const voiceState = (globalThis as Record<string, unknown>).__kbot_voice
        if (voiceState) {
          printInfo(formatVoiceStatus(voiceState as any))
        } else {
          const state = initVoice({ voice: args[0], tts: true })
          ;(globalThis as Record<string, unknown>).__kbot_voice = state
          printSuccess(formatVoiceStatus(state))
        }
      }
      break
    }

    case 'share': {
      const { shareConversation } = await import('./share.js')
      try {
        const sessionId = args[0] || undefined
        const result = await shareConversation(sessionId, {
          title: args.slice(1).join(' ') || undefined,
        })
        if (result.method === 'gist') {
          printSuccess(`Shared! ${result.url}`)
          printInfo('Link copied to clipboard.')
        } else if (result.method === 'clipboard') {
          printSuccess('Conversation copied to clipboard as markdown.')
          printInfo('Paste it anywhere — GitHub, Discord, Twitter, etc.')
          printInfo('For a shareable link, install GitHub CLI: brew install gh')
        } else {
          console.log(result.markdown)
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
      break
    }

    case 'export': {
      const { exportSession } = await import('./export.js')
      const format = (args[1] || 'md') as 'md' | 'json' | 'html'
      if (!args[0]) {
        printError('Usage: /export <session-id> [md|json|html] [output-path]')
        break
      }
      try {
        const result = exportSession(args[0], format, args[2])
        if (args[2]) {
          printSuccess(`Exported to ${args[2]}`)
        } else {
          console.log(result)
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
      break
    }

    case 'plugins': {
      const { formatPluginList } = await import('./plugins.js')
      printInfo(formatPluginList())
      break
    }

    case 'test':
    case 'tests': {
      const { executeTool: execTool } = await import('./tools/index.js')
      printInfo('Running tests...')
      const result = await execTool({ id: 'repl', name: 'run_tests', arguments: { path: args[0] || process.cwd() } })
      console.log(result.result)
      break
    }

    case 'rate-limit':
    case 'ratelimit': {
      const { formatRateLimitStatus } = await import('./rate-limiter.js')
      console.log(formatRateLimitStatus())
      break
    }

    case 'doctor': {
      const { runDoctor, formatDoctorReport } = await import('./doctor.js')
      printInfo('Running diagnostics...')
      const doctorReport = await runDoctor()
      process.stderr.write(formatDoctorReport(doctorReport))
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

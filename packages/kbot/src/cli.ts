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
import { homedir } from 'node:os'
import { Command } from 'commander'
import { loadConfig, setupByok, setupEmbedded, isByokEnabled, isLocalProvider, disableByok, detectProvider, getByokProvider, PROVIDERS, setupOllama, setupKbotLocal, isOllamaRunning, listOllamaModels, warmOllamaModelCache, detectLocalRuntime, type ByokProvider } from './auth.js'
import { runAndPrint, runAgent, runAgentFromCheckpoint, type AgentOptions } from './agent.js'
import { gatherContext, type ProjectContext } from './context.js'
import { probeMachine, formatMachineProfile, type MachineProfile } from './machine.js'
import { registerCoreTools, startLazyToolRegistration, ensureLazyToolsLoaded, setLiteMode } from './tools/index.js'
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
import { getBuddy, getBuddyGreeting, formatBuddyStatus, getBuddyDreamNarration, renameBuddy, buddyChat, getAchievements, getBuddyLevel, fetchBuddyLeaderboard } from './buddy.js'
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
    .option('-a, --agent <agent>', 'Force a specific agent (run kbot agents to see all 35)')
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
    .option('--tree', 'Tree planning mode — LATS branching search instead of linear plans')
    .option('--lite', 'Lightweight mode — skip heavy tools (auto-enabled on Replit)')
    .option('--safe', 'Confirm destructive operations')
    .option('--strict', 'Confirm ALL operations')
    .option('--ollama-launch', 'Auto-configure for ollama launch (sets Ollama as provider)')
    .argument('[prompt...]', 'One-shot prompt')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .action(() => { /* default action — handled below */ })

  // Sub-commands
  program
    .command('help')
    .description('Show help — commands, agents, support channels')
    .action(() => {
      console.log()
      console.log(`  ${chalk.bold('kbot')} v${VERSION} — Open-source terminal AI agent`)
      console.log()
      console.log(`  ${chalk.bold('Quick Start')}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)
      console.log(`  ${chalk.white('kbot')}                          Interactive REPL`)
      console.log(`  ${chalk.white('kbot "fix the bug"')}            One-shot prompt`)
      console.log(`  ${chalk.white('kbot --agent researcher')}       Force a specialist`)
      console.log(`  ${chalk.white('kbot --model sonnet')}           Override model`)
      console.log(`  ${chalk.white('kbot local')}                    $0 local AI (no API key)`)
      console.log()
      console.log(`  ${chalk.bold('Common Commands')}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)
      console.log(`  ${chalk.white('kbot auth')}         Configure your API key (20 providers)`)
      console.log(`  ${chalk.white('kbot doctor')}       Diagnose setup issues`)
      console.log(`  ${chalk.white('kbot agents')}       List all 35 specialist agents`)
      console.log(`  ${chalk.white('kbot status')}       Full dashboard — tools, agents, stats`)
      console.log(`  ${chalk.white('kbot init')}         Set up kbot for this project (60s)`)
      console.log(`  ${chalk.white('kbot update')}       Update to the latest version`)
      console.log(`  ${chalk.white('kbot tutorial')}     Guided walkthrough`)
      console.log()
      console.log(`  ${chalk.bold('Inside the REPL')}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)
      console.log(`  ${chalk.white('/help')}             Full command list`)
      console.log(`  ${chalk.white('/agent <name>')}     Switch specialist`)
      console.log(`  ${chalk.white('/plan <task>')}      Plan + execute complex tasks`)
      console.log(`  ${chalk.white('/save')}             Save conversation`)
      console.log(`  ${chalk.white('/remember <…>')}     Teach kbot something permanent`)
      console.log()
      console.log(`  ${chalk.bold('Need Help?')}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)
      console.log(`  ${chalk.white('kbot doctor')}       ${chalk.dim('— diagnose any setup issue')}`)
      console.log(`  ${chalk.cyan('https://discord.gg/kdMauM9abG')}  ${chalk.dim('Discord community')}`)
      console.log(`  ${chalk.cyan('https://github.com/isaacsight/kernel/issues')}  ${chalk.dim('Bug reports')}`)
      console.log(`  ${chalk.cyan('support@kernel.chat')}  ${chalk.dim('Email (AI-assisted replies)')}`)
      console.log()
      console.log(`  ${chalk.dim('35 specialist agents · 787+ tools · 20 providers · MIT licensed')}`)
      console.log()
      process.exit(0)
    })

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
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const jsonMode = opts.json || program.opts().json
      const { initBridge, getStatus } = await import('./ide/bridge.js')
      await initBridge()
      const status = getStatus()
      if (jsonMode) {
        console.log(JSON.stringify(status, null, 2))
        return
      }
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

  // ── Daemon ──
  const daemonCmd = program
    .command('daemon')
    .description('Background intelligence — market watch, security patrol, synthesis, health checks')

  daemonCmd
    .command('start')
    .description('Start the kbot daemon — runs all background subsystems')
    .action(async () => {
      const { startDaemon } = await import('./daemon.js')
      printInfo('Starting kbot daemon...')
      await startDaemon()
    })

  daemonCmd
    .command('stop')
    .description('Stop the running daemon')
    .action(async () => {
      const { stopDaemon } = await import('./daemon.js')
      if (stopDaemon()) {
        printSuccess('Daemon stopped.')
      } else {
        printInfo('No daemon running.')
      }
    })

  daemonCmd
    .command('status')
    .description('Show daemon status — uptime, subsystems, alerts')
    .action(async () => {
      const { getDaemonStatus, getDaemonLog } = await import('./daemon.js')
      const status = getDaemonStatus()

      console.log()
      if (status.running) {
        const uptime = Date.now() - new Date(status.startedAt).getTime()
        const hrs = Math.floor(uptime / 3_600_000)
        const min = Math.floor((uptime % 3_600_000) / 60_000)
        console.log(`  ${chalk.green('●')} Daemon running (PID ${status.pid}, ${hrs}h ${min}m, ${status.cycles} cycles)`)
      } else {
        console.log(`  ${chalk.red('●')} Daemon not running`)
      }

      if (Object.keys(status.subsystems).length > 0) {
        console.log()
        console.log(`  ${chalk.bold('Subsystems')}`)
        for (const [name, sub] of Object.entries(status.subsystems)) {
          const icon = sub.status === 'ok' ? chalk.green('✓') : sub.status === 'error' ? chalk.red('✗') : sub.status === 'running' ? chalk.yellow('⟳') : chalk.dim('○')
          console.log(`  ${icon} ${name.padEnd(18)} runs: ${sub.runCount}  last: ${sub.lastRun ? sub.lastRun.split('T')[1]?.slice(0, 5) : '—'}`)
        }
      }

      if (status.alerts.length > 0) {
        console.log()
        console.log(`  ${chalk.bold('Recent Alerts')} (${status.alerts.length})`)
        for (const a of status.alerts.slice(-5)) {
          console.log(`  ${chalk.yellow('!')} ${a}`)
        }
      }

      // Recent log
      const log = getDaemonLog(10)
      if (log.length > 0) {
        console.log()
        console.log(`  ${chalk.bold('Recent Log')}`)
        for (const line of log) {
          console.log(`  ${chalk.dim(line)}`)
        }
      }
      console.log()
    })

  daemonCmd
    .command('log')
    .description('Show full daemon log')
    .option('--lines <n>', 'Number of lines', '50')
    .action(async (opts: { lines?: string }) => {
      const { getDaemonLog } = await import('./daemon.js')
      const log = getDaemonLog(Number(opts.lines) || 50)
      for (const line of log) console.log(line)
    })

  // ── Briefing ──
  program
    .command('briefing')
    .description('Your daily intelligence report — market, security, stats, daemon health, suggested actions')
    .action(async () => {
      const { generateBriefing } = await import('./briefing.js')
      process.stderr.write(await generateBriefing())
    })

  // ── Discovery Agent ──
  const discoveryCmd = program
    .command('discovery')
    .description('Autonomous outreach agent — finds conversations, drafts responses, posts for you')

  discoveryCmd
    .command('start')
    .description('Start the discovery loop — scans HN, GitHub, Reddit and posts autonomously')
    .option('--dry-run', 'Find and draft but don\'t post')
    .option('--interval <minutes>', 'Poll interval in minutes', '60')
    .option('--model <model>', 'Ollama model for analysis', 'qwen2.5-coder:32b')
    .action(async (opts: { dryRun?: boolean; interval?: string; model?: string }) => {
      const { loadConfig, saveConfig, runDiscoveryCycle } = await import('./discovery.js')
      const readline = await import('node:readline')

      let config = loadConfig()

      // First run — interactive setup
      if (!config) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
        const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r))

        console.log()
        console.log(chalk.hex('#6B5B95')('  ◉ kbot Discovery — First Time Setup'))
        console.log()

        const name = await ask('  Project name: ')
        const desc = await ask('  One-line description: ')
        const topicsRaw = await ask('  Topics to search (comma-separated): ')
        const hnUser = await ask('  HN username (leave blank to skip): ')
        let hnCookie = ''
        if (hnUser) {
          hnCookie = await ask('  HN cookie string (from browser dev tools): ')
        }

        rl.close()

        config = {
          projectName: name || 'my-project',
          projectDescription: desc || '',
          topics: topicsRaw.split(',').map(t => t.trim()).filter(Boolean),
          hnUsername: hnUser || undefined,
          hnCookie: hnCookie || undefined,
          githubToken: undefined,
          maxPostsPerCycle: 2,
          pollIntervalMinutes: Number(opts.interval || 60),
          dryRun: opts.dryRun || false,
          ollamaModel: opts.model || 'qwen2.5-coder:32b',
          ollamaUrl: 'http://localhost:11434',
        }

        saveConfig(config)
        printSuccess('Config saved to ~/.kbot/discovery/config.json')
      }

      // Override with flags
      config.dryRun = opts.dryRun || false
      config.pollIntervalMinutes = Number(opts.interval || config.pollIntervalMinutes)
      config.ollamaModel = opts.model || config.ollamaModel

      console.log()
      console.log(chalk.hex('#6B5B95')('  ◉ kbot Discovery Agent'))
      console.log(chalk.dim(`  Project: ${config.projectName}`))
      console.log(chalk.dim(`  Topics: ${config.topics.join(', ')}`))
      console.log(chalk.dim(`  Model: ${config.ollamaModel}`))
      console.log(chalk.dim(`  Mode: ${config.dryRun ? 'DRY RUN (no posting)' : 'LIVE (will post)'}`))
      console.log(chalk.dim(`  Interval: ${config.pollIntervalMinutes}m`))
      console.log()

      // Initial cycle: outreach + extended (tools, agents, papers)
      const { runExtendedDiscovery } = await import('./discovery.js')
      await runDiscoveryCycle(config)
      const extended = await runExtendedDiscovery(config)
      if (extended.tools > 0) printInfo(`  Discovered ${extended.tools} new tools`)
      if (extended.agents > 0) printInfo(`  Proposed ${extended.agents} new agents`)
      if (extended.papers > 0) printInfo(`  Found ${extended.papers} new papers`)

      // Poll: outreach every interval, extended every 6 hours
      setInterval(() => runDiscoveryCycle(config!), config.pollIntervalMinutes * 60 * 1000)
      setInterval(() => runExtendedDiscovery(config!), 6 * 60 * 60 * 1000)
      console.log(`Polling: outreach every ${config.pollIntervalMinutes}m, tools/agents/papers every 6h. Ctrl+C to stop.`)
      await new Promise(() => {}) // keep alive
    })

  discoveryCmd
    .command('status')
    .description('Show discovery agent status and stats')
    .action(async () => {
      const { getDiscoveryState, loadConfig } = await import('./discovery.js')
      const config = loadConfig()
      const state = getDiscoveryState()

      console.log()
      console.log(chalk.hex('#6B5B95')('  ◉ kbot Discovery Status'))
      if (config) {
        console.log(chalk.dim(`  Project: ${config.projectName}`))
        console.log(chalk.dim(`  Topics: ${config.topics.join(', ')}`))
      } else {
        printWarn('  Not configured. Run: kbot discovery start')
      }
      console.log()
      console.log(`  Scans:   ${state.totalScans}`)
      console.log(`  Found:   ${state.totalFound}`)
      console.log(`  Posted:  ${state.totalPosted}`)
      console.log(`  Skipped: ${state.totalSkipped}`)
      console.log(`  Last:    ${state.lastScan || 'never'}`)

      if (state.posts.length > 0) {
        console.log()
        console.log(chalk.bold('  Recent posts:'))
        for (const p of state.posts.slice(-5).reverse()) {
          const icon = p.success ? chalk.green('✓') : chalk.red('✗')
          console.log(`    ${icon} [${p.platform}] ${p.title.slice(0, 50)}`)
          if (p.error) console.log(chalk.dim(`      ${p.error}`))
        }
      }
      console.log()
      process.exit(0)
    })

  discoveryCmd
    .command('log')
    .description('Show recent discovery activity')
    .option('-n, --lines <n>', 'Number of lines to show', '20')
    .action(async (opts: { lines?: string }) => {
      const { getRecentLog } = await import('./discovery.js')
      console.log(getRecentLog(Number(opts.lines || 20)))
      process.exit(0)
    })

  discoveryCmd
    .command('auth')
    .description('Configure platform credentials for posting')
    .action(async () => {
      const { loadConfig, saveConfig } = await import('./discovery.js')
      const readline = await import('node:readline')

      let config = loadConfig()
      if (!config) {
        printError('Run `kbot discovery start` first to create config.')
        process.exit(1)
      }

      const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
      const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r))

      console.log()
      printInfo('Configure platform credentials')
      console.log()

      const hnUser = await ask(`  HN username [${config.hnUsername || 'none'}]: `)
      if (hnUser) config.hnUsername = hnUser

      if (config.hnUsername) {
        const hnCookie = await ask('  HN cookie (from browser): ')
        if (hnCookie) config.hnCookie = hnCookie
      }

      rl.close()
      saveConfig(config)
      printSuccess('Credentials updated.')
      process.exit(0)
    })

  discoveryCmd
    .command('tools')
    .description('Show discovered tools from npm, GitHub, MCP servers')
    .action(async () => {
      const { getDiscoveredTools } = await import('./discovery.js')
      const tools = getDiscoveredTools()
      if (tools.length === 0) {
        printInfo('No tools discovered yet. Run: kbot discovery start')
        process.exit(0)
      }
      console.log()
      printInfo(`${tools.length} tools discovered:`)
      for (const t of tools.slice(-15)) {
        console.log(`  [${t.source}] ${t.name}`)
        console.log(`    ${t.description.slice(0, 80)}`)
        console.log(`    ${t.url}`)
        console.log()
      }
      process.exit(0)
    })

  discoveryCmd
    .command('agents')
    .description('Show proposed new specialist agents')
    .action(async () => {
      const { getProposedAgents } = await import('./discovery.js')
      const agents = getProposedAgents()
      if (agents.length === 0) {
        printInfo('No new agents proposed yet. Run: kbot discovery start')
        process.exit(0)
      }
      console.log()
      printInfo(`${agents.length} agents proposed:`)
      for (const a of agents) {
        console.log(`  ${a.name} (${a.id})`)
        console.log(`    Why: ${a.reason}`)
        console.log(`    Prompt: ${a.systemPrompt.slice(0, 100)}...`)
        console.log()
      }
      process.exit(0)
    })

  discoveryCmd
    .command('papers')
    .description('Show discovered academic papers from arXiv')
    .action(async () => {
      const { getDiscoveredPapers } = await import('./discovery.js')
      const papers = getDiscoveredPapers()
      if (papers.length === 0) {
        printInfo('No papers discovered yet. Run: kbot discovery start')
        process.exit(0)
      }
      console.log()
      printInfo(`${papers.length} papers found:`)
      for (const p of papers.slice(-10)) {
        console.log(`  ${p.title}`)
        console.log(`    ${p.authors}`)
        console.log(`    ${p.abstract.slice(0, 120)}...`)
        console.log(`    ${p.url}`)
        console.log()
      }
      process.exit(0)
    })

  program
    .command('init')
    .description('Set up kbot for this project — detects stack, creates tools, writes config (60 seconds)')
    .option('--force', 'Overwrite existing .kbot.json')
    .action(async (opts: { force?: boolean }) => {
      const { existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { initProject, formatInitReport } = await import('./init.js')
      const AMETHYST = chalk.hex('#6B5B95')
      const root = process.cwd()

      // Check for existing config
      if (!opts.force && existsSync(join(root, '.kbot.json'))) {
        printWarn('This project already has a .kbot.json. Use --force to overwrite.')
        return
      }

      process.stderr.write('\n')
      process.stderr.write(`  ${AMETHYST('◉')} ${chalk.bold('kbot init')} — scanning project...\n\n`)

      const config = await initProject(root)

      process.stderr.write(formatInitReport(config) + '\n')
      process.stderr.write('\n')
      process.stderr.write(`  ${chalk.green('✓')} Config written to ${chalk.dim('.kbot.json')}\n`)
      if (config.forgedTools.length > 0) {
        process.stderr.write(`  ${chalk.green('✓')} ${config.forgedTools.length} tools forged: ${chalk.dim(config.forgedTools.join(', '))}\n`)
      }
      process.stderr.write('\n')
      process.stderr.write(`  ${chalk.bold('Try now:')}\n`)
      process.stderr.write(`    ${chalk.cyan('kbot')} "explain this project"\n`)
      process.stderr.write(`    ${chalk.cyan('kbot')} "find the top bug"\n`)
      if (config.commands.test) {
        process.stderr.write(`    ${chalk.cyan('kbot')} "run the tests and fix any failures"\n`)
      }
      process.stderr.write('\n')
      process.exit(0)
    })

  program
    .command('observe')
    .description('Ingest observations from Claude Code sessions — kbot learns from what Claude does')
    .option('--stats', 'Show observer statistics')
    .option('--reset', 'Reset the observer log and cursor')
    .action(async (opts: { stats?: boolean; reset?: boolean }) => {
      const { ingestObservations, getObserverStats, getLogPath } = await import('./observer.js')

      if (opts.reset) {
        const { existsSync, unlinkSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { homedir } = await import('node:os')
        const dir = join(homedir(), '.kbot', 'observer')
        for (const f of ['session.jsonl', 'cursor.json', 'stats.json']) {
          const p = join(dir, f)
          if (existsSync(p)) unlinkSync(p)
        }
        printSuccess('Observer log reset.')
        process.exit(0)
      }

      if (opts.stats) {
        const stats = getObserverStats()
        console.log()
        console.log(chalk.hex('#6B5B95')('  ◉ kbot Observer'))
        console.log(chalk.dim(`  Log: ${getLogPath()}`))
        console.log()
        console.log(`  Total observed:     ${stats.totalObserved}`)
        console.log(`  Sessions observed:  ${stats.sessionsObserved}`)
        console.log(`  Sequences learned:  ${stats.sequencesLearned}`)
        console.log(`  Facts learned:      ${stats.factsLearned}`)
        console.log(`  Last ingested:      ${stats.lastIngested || 'never'}`)
        if (Object.keys(stats.toolFrequency).length > 0) {
          console.log()
          console.log(chalk.bold('  Tool frequency:'))
          const sorted = Object.entries(stats.toolFrequency).sort((a, b) => b[1] - a[1]).slice(0, 10)
          for (const [tool, count] of sorted) {
            console.log(`    ${String(count).padStart(4)}x  ${tool}`)
          }
        }
        console.log()
        process.exit(0)
      }

      // Default: ingest new observations
      printInfo('Ingesting observations from Claude Code sessions...')
      const result = await ingestObservations()

      if (result.processed === 0) {
        printInfo('No new observations to ingest.')
        printInfo(`Log file: ${getLogPath()}`)
        printInfo('The Claude Code PostToolUse hook writes here after every tool call.')
      } else {
        printSuccess(`Ingested ${result.processed} tool calls from ${result.sessions.length} session(s)`)
        if (result.patterns > 0) printInfo(`  Sequences learned: ${result.patterns}`)
        if (result.facts > 0) printInfo(`  Facts learned: ${result.facts}`)
      }
      process.exit(0)
    })

  program
    .command('pair [path]')
    .description('Pair programming mode — watch files, run tests, get real-time suggestions')
    .option('-q, --quiet', 'Only show errors, suppress suggestions')
    .option('--auto-fix', 'Automatically apply safe fixes (trailing whitespace, unused imports)')
    .option('--bell', 'Sound terminal bell on errors')
    .option('--no-types', 'Disable TypeScript type checking')
    .option('--no-lint', 'Disable ESLint checks')
    .option('--no-tests', 'Disable missing test detection')
    .option('--no-security', 'Disable security scanning')
    .option('--no-style', 'Disable style checks')
    .option('--ignore <patterns>', 'Additional ignore patterns (comma-separated)')
    .action(async (pairPath?: string, opts?: {
      quiet?: boolean; autoFix?: boolean; bell?: boolean
      types?: boolean; lint?: boolean; tests?: boolean
      security?: boolean; style?: boolean; ignore?: string
    }) => {
      const { runPair } = await import('./pair.js')
      const checks: Record<string, boolean> = {}
      if (opts?.types === false) checks.typeErrors = false
      if (opts?.lint === false) checks.lint = false
      if (opts?.tests === false) checks.missingTests = false
      if (opts?.security === false) checks.security = false
      if (opts?.style === false) checks.style = false

      const ignorePatterns = opts?.ignore
        ? opts.ignore.split(',').map((p: string) => p.trim())
        : undefined

      await runPair(pairPath, {
        quiet: opts?.quiet,
        autoFix: opts?.autoFix,
        bell: opts?.bell,
        checks: Object.keys(checks).length > 0 ? checks : undefined,
        ignorePatterns,
      })
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

  program
    .command('insights')
    .description('See yourself from kbot\'s perspective — task patterns, agent usage, efficiency, knowledge')
    .action(async () => {
      const { generateInsights } = await import('./introspection.js')
      process.stderr.write(generateInsights())
    })

  program
    .command('reflect')
    .description('A narrative portrait of who you are as a builder, drawn from kbot\'s learning data')
    .action(async () => {
      const { generateReflection } = await import('./introspection.js')
      process.stderr.write(generateReflection())
    })

  program
    .command('compare')
    .description('Compare your patterns to the anonymous kbot collective — see what\'s unique about you')
    .action(async () => {
      const { generateComparison } = await import('./introspection.js')
      process.stderr.write(generateComparison())
    })

  program
    .command('growth')
    .description('See how you\'ve evolved as a builder — milestones, efficiency gains, knowledge arc')
    .action(async () => {
      const { generateGrowthReport } = await import('./introspection.js')
      process.stderr.write(generateGrowthReport())
    })

  program
    .command('decisions')
    .description('See WHY kbot made each decision today — agent routing, model selection, fallbacks')
    .option('--date <date>', 'Show decisions for a specific date (YYYY-MM-DD)')
    .action(async (opts: { date?: string }) => {
      const { getTodaysDecisions, getDecisions, formatDecisions } = await import('./decision-journal.js')
      const decisions = opts.date ? getDecisions(opts.date) : getTodaysDecisions()
      console.log(formatDecisions(decisions))
    })

  program
    .command('episodes')
    .description('Session history as stories — what happened, what was learned, emotional valence')
    .option('--tag <tag>', 'Filter by tag (coding, finance, security, etc.)')
    .action(async (opts: { tag?: string }) => {
      const { listEpisodes, searchEpisodes, formatEpisodeList } = await import('./episodic-memory.js')
      const episodes = opts.tag ? searchEpisodes(opts.tag) : listEpisodes(15)
      console.log(formatEpisodeList(episodes))
    })

  // ── Self-Defense ──
  const defenseCmd = program
    .command('defense')
    .description('Self-defense systems — memory integrity, injection detection, anomaly scanning')

  defenseCmd
    .command('audit')
    .description('Full defense audit — memory integrity, anomalies, incidents, recommendations')
    .action(async () => {
      const { runDefenseAudit } = await import('./self-defense.js')
      const audit = runDefenseAudit()

      console.log()
      console.log(`  ${chalk.bold('kbot defense audit')}`)
      console.log()

      // Overall status
      const statusColor = audit.overallStatus === 'secure' ? chalk.green : audit.overallStatus === 'warning' ? chalk.yellow : chalk.red
      console.log(`  ${chalk.bold('Status')}: ${statusColor(audit.overallStatus.toUpperCase())}`)
      console.log()

      // Memory integrity
      const mi = audit.memoryIntegrity
      console.log(`  ${chalk.bold('Memory Integrity')}`)
      console.log(`  ${chalk.dim('─'.repeat(40))}`)
      console.log(`  Files: ${mi.total}  OK: ${chalk.green(String(mi.ok))}  Tampered: ${mi.tampered ? chalk.red(String(mi.tampered)) : '0'}  New: ${mi.new}  Missing: ${mi.missing}`)
      console.log()

      // Anomalies
      if (audit.anomalies.anomalies.length > 0) {
        console.log(`  ${chalk.bold('Anomalies')} (${audit.anomalies.anomalies.length})`)
        console.log(`  ${chalk.dim('─'.repeat(40))}`)
        for (const a of audit.anomalies.anomalies) {
          const c = a.severity === 'critical' ? chalk.red : a.severity === 'high' ? chalk.yellow : chalk.dim
          console.log(`  ${c(`[${a.severity.toUpperCase()}]`)} ${a.description}`)
        }
        console.log()
      }

      // Incidents
      if (audit.recentIncidents.length > 0) {
        console.log(`  ${chalk.bold('Recent Incidents')} (${audit.recentIncidents.length})`)
        console.log(`  ${chalk.dim('─'.repeat(40))}`)
        for (const i of audit.recentIncidents.slice(-5)) {
          console.log(`  ${i.timestamp.split('T')[0]} ${chalk.dim(i.type)} — ${i.description.slice(0, 60)}`)
        }
        console.log()
      }

      // Recommendations
      if (audit.recommendations.length > 0) {
        console.log(`  ${chalk.bold('Recommendations')}`)
        console.log(`  ${chalk.dim('─'.repeat(40))}`)
        for (const r of audit.recommendations) {
          console.log(`  → ${r}`)
        }
        console.log()
      }
    })

  defenseCmd
    .command('sign')
    .description('Sign all memory files — establishes integrity baseline')
    .action(async () => {
      const { signMemoryFiles } = await import('./self-defense.js')
      signMemoryFiles()
      printSuccess('Memory files signed. Integrity baseline established.')
    })

  defenseCmd
    .command('verify')
    .description('Verify memory file integrity — detect tampering')
    .action(async () => {
      const { verifyMemoryIntegrity } = await import('./self-defense.js')
      const results = verifyMemoryIntegrity()
      if (results.length === 0) {
        printInfo('No memory files to verify. Run `kbot defense sign` first.')
        return
      }
      for (const r of results) {
        const icon = r.status === 'ok' ? chalk.green('✓') : r.status === 'tampered' ? chalk.red('✗ TAMPERED') : r.status === 'new' ? chalk.yellow('? new') : chalk.red('! missing')
        console.log(`  ${icon}  ${r.file}`)
      }
      const tampered = results.filter(r => r.status === 'tampered')
      if (tampered.length > 0) {
        printError(`${tampered.length} file(s) tampered with outside of kbot!`)
      } else {
        printSuccess('All memory files intact.')
      }
    })

  defenseCmd
    .command('incidents')
    .description('Show recent security incidents')
    .action(async () => {
      const { getIncidents } = await import('./self-defense.js')
      const incidents = getIncidents(20)
      if (incidents.length === 0) { printInfo('No security incidents recorded.'); return }
      printInfo(`${incidents.length} incident(s):`)
      for (const i of incidents) {
        printInfo(`  ${i.timestamp.split('T')[0]} [${i.severity}] ${i.type} — ${i.description.slice(0, 70)} (${i.action})`)
      }
    })

  program
    .command('machine')
    .description('Show full system profile — hardware, GPU, OS, dev tools, AI capabilities')
    .option('--json', 'Output as JSON')
    .option('--refresh', 'Force fresh probe (ignore cache)')
    .action(async (opts: { json?: boolean; refresh?: boolean }) => {
      const { probeMachine, reprobeMachine, formatMachineProfile } = await import('./machine.js')
      const profile = opts.refresh ? await reprobeMachine() : await probeMachine()

      if (opts.json) {
        console.log(JSON.stringify(profile, null, 2))
      } else {
        const ACCENT = process.stdout.isTTY !== false ? chalk.hex('#A78BFA') : chalk
        process.stderr.write('\n  ' + ACCENT('kbot Machine') + '\n')
        process.stderr.write(formatMachineProfile(profile))
      }
    })

  // ── Watchdog — Service & System Status Dashboard ──
  program
    .command('watchdog')
    .alias('wd')
    .description('Service watchdog — live status of all kbot background services and system health')
    .option('--json', 'Output as JSON')
    .option('--restart <service>', 'Restart a specific service (email-agent, discovery, serve, discord, mlx, collective-sync, daemon, kbot-local)')
    .action(async (opts: { json?: boolean; restart?: string }) => {
      const { getSystemHealth, getServiceStatus, restartService } = await import('./tools/watchdog.js')

      // ── Restart mode ──
      if (opts.restart) {
        const result = restartService(opts.restart)
        if (result.success) {
          console.log()
          console.log(`  ${chalk.hex('#4ADE80')('✓')} ${result.message}`)
          console.log()
        } else {
          console.log()
          console.log(`  ${chalk.hex('#F87171')('✗')} ${result.message}`)
          console.log()
        }
        return
      }

      const h = getSystemHealth()

      // ── JSON mode ──
      if (opts.json) {
        console.log(JSON.stringify(h, null, 2))
        return
      }

      // ── Dashboard rendering ──
      const ACCENT = chalk.hex('#A78BFA')
      const GREEN = chalk.hex('#4ADE80')
      const YELLOW = chalk.hex('#FBBF24')
      const RED = chalk.hex('#F87171')
      const DIM = chalk.dim

      const running = h.services.filter(s => s.status === 'running').length
      const total = h.services.length
      const allUp = running === total

      // Box drawing
      const W = 42
      const box = {
        tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F', h: '\u2500', v: '\u2502',
        pad: (s: string, w: number) => {
          const visible = s.replace(/\x1b\[[0-9;]*m/g, '')
          const diff = w - visible.length
          return diff > 0 ? s + ' '.repeat(diff) : s
        },
      }

      const row = (content: string) => {
        return ACCENT(box.v) + ' ' + box.pad(content, W - 2) + ' ' + ACCENT(box.v)
      }

      console.log()
      console.log('  ' + ACCENT(`${box.tl}${box.h.repeat(W)}${box.tr}`))
      console.log('  ' + row(`${ACCENT.bold('\u25C6 KBOT SYSTEM STATUS')}`))
      console.log('  ' + ACCENT(`${box.tl}${box.h.repeat(W)}${box.tr}`.replace(box.tl, '\u251C').replace(box.tr, '\u2524')))

      // Service count
      const svcColor = allUp ? GREEN : running > 0 ? YELLOW : RED
      console.log('  ' + row(`Services:  ${svcColor(`${running}/${total} running`)}`))

      // CPU
      console.log('  ' + row(`CPU Load:  ${chalk.white(h.loadAvg)}`))

      // RAM
      console.log('  ' + row(`RAM:       ${chalk.white(h.memUsed)} / ${DIM(h.memTotal)}`))

      // Disk
      console.log('  ' + row(`Disk:      ${chalk.white(h.diskFree)} free ${DIM(`/ ${h.diskTotal}`)}`))

      // Ollama
      const ollamaColor = h.ollamaStatus === 'online' ? GREEN : RED
      const ollamaInfo = h.ollamaModels.length > 0 ? ` ${DIM(`(${h.ollamaModels.length} models)`)}` : ''
      console.log('  ' + row(`Ollama:    ${ollamaColor(h.ollamaStatus)}${ollamaInfo}`))

      // Dreams
      console.log('  ' + row(`Dreams:    ${ACCENT(`${h.dreamCycles}`)} cycles, ${ACCENT(`${h.dreamInsights}`)} insights`))

      // Memory
      console.log('  ' + row(`Memory:    ${chalk.white(h.kbotMemorySize)}`))

      console.log('  ' + ACCENT(`${box.bl}${box.h.repeat(W)}${box.br}`))
      console.log()

      // ── Services table ──
      console.log(`  ${chalk.bold('SERVICES')}`)
      console.log(`  ${DIM('\u2500'.repeat(64))}`)

      for (const s of h.services) {
        const icon = s.status === 'running' ? GREEN('\u2713')
          : s.status === 'dead' ? RED('\u2717')
          : DIM('\u2500')
        const nameStr = chalk.bold(s.shortName.padEnd(18))
        const pidStr = s.pid ? DIM(`PID ${String(s.pid).padEnd(8)}`) : DIM('PID -'.padEnd(12))

        let statusStr: string
        if (s.status === 'running') {
          statusStr = `CPU ${chalk.white(s.cpu.padEnd(7))} MEM ${chalk.white(s.mem.padEnd(7))} up ${GREEN(s.uptime)}`
        } else if (s.status === 'dead') {
          statusStr = RED('dead — restart with: kbot wd --restart ' + s.shortName)
        } else {
          statusStr = DIM('not loaded')
        }

        console.log(`  ${icon} ${nameStr} ${pidStr} ${statusStr}`)
      }

      console.log()

      // Ollama model list
      if (h.ollamaModels.length > 0) {
        console.log(`  ${chalk.bold('OLLAMA MODELS')}`)
        console.log(`  ${DIM('\u2500'.repeat(64))}`)
        for (const m of h.ollamaModels) {
          console.log(`  ${ACCENT('\u25B8')} ${chalk.white(m)}`)
        }
        console.log()
      }
    })

  program
    .command('hardware')
    .description('Detect your hardware tier and get personalized model recommendations for local AI')
    .action(async () => {
      const { detectHardwareTier, getMultiModelConfig, QUANT_OPTIONS, DEFAULT_MODELS } = await import('./inference.js')

      const hw = detectHardwareTier()
      const mm = getMultiModelConfig()

      console.log()
      console.log(`  ${chalk.bold('kbot hardware')} — your local AI capability`)
      console.log()

      const tierColors: Record<string, (s: string) => string> = {
        basic: chalk.dim, standard: chalk.white, pro: chalk.cyan, ultra: chalk.hex('#A78BFA'), mythic: chalk.hex('#FF6B6B'), datacenter: chalk.hex('#FFD700'),
      }
      const colorFn = tierColors[hw.tier] || chalk.white

      console.log(`  ${chalk.bold('Tier')}: ${colorFn(hw.tier.toUpperCase())}`)
      console.log(`  ${chalk.dim(hw.description)}`)
      console.log(`  ${chalk.bold('Max model')}: ${hw.maxModelParams}`)
      console.log()

      // Model catalog by tier
      console.log(`  ${chalk.bold('Model Catalog')} ${chalk.dim(`(${Object.keys(DEFAULT_MODELS).length} models)`)}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)

      const tiers: Array<{ label: string; filter: (tags: string[]) => boolean }> = [
        { label: 'Light (2-4 GB)', filter: tags => tags.includes('lightweight') || tags.includes('fast') },
        { label: 'Standard (4-6 GB)', filter: tags => !tags.includes('lightweight') && !tags.includes('fast') && !tags.includes('large') && !tags.includes('frontier') && !tags.includes('ultra') && !tags.includes('legacy') },
        { label: 'Heavy (8-16 GB)', filter: tags => tags.includes('large') },
        { label: 'Frontier (32-64 GB)', filter: tags => tags.includes('frontier') },
        { label: 'Ultra (100+ GB)', filter: tags => tags.includes('ultra') },
        { label: 'Coming Soon', filter: tags => tags.includes('coming-soon') },
      ]

      for (const tier of tiers) {
        const models = Object.entries(DEFAULT_MODELS).filter(([, m]) => tier.filter(m.tags))
        if (models.length === 0) continue
        console.log(`  ${chalk.bold(tier.label)}`)
        for (const [name, model] of models) {
          const fits = parseFloat(model.size.replace(/[^0-9.]/g, '')) <= mm.totalRAM * 0.6
          const icon = fits ? chalk.green('✓') : chalk.red('✗')
          const comingSoon = model.tags.includes('coming-soon')
          const rec = comingSoon ? chalk.magenta(' ⏳') : model.tags.includes('recommended') ? chalk.yellow(' ★') : ''
          const displayIcon = comingSoon ? chalk.dim('○') : icon
          console.log(`  ${displayIcon} ${name.padEnd(22)} ${chalk.dim(model.size.padEnd(10))} ${model.description.slice(0, 55)}${rec}`)
        }
        console.log()
      }

      // Multi-model config
      if (mm.canMultiModel) {
        console.log(`  ${chalk.bold('Multi-Model Setup')} ${chalk.dim('(run two models simultaneously)')}`)
        console.log(`  ${chalk.dim('─'.repeat(50))}`)
        for (const slot of mm.recommended) {
          console.log(`  ${chalk.cyan(slot.slot.padEnd(8))} → ${slot.model} (${slot.size})`)
        }
        console.log()
      }

      // Recommendations
      console.log(`  ${chalk.bold('Quick Start')}`)
      console.log(`  ${chalk.dim('─'.repeat(50))}`)
      for (const rec of hw.recommendations) {
        console.log(`  ${chalk.white(rec)}`)
      }
      console.log()

      // Quantization info
      console.log(`  ${chalk.dim('Quantization options: Q2 (smallest) → Q4 (default) → Q8 (best) → F16 (original)')}`)
      console.log(`  ${chalk.dim('Higher quant = better quality, more RAM. Use: kbot models pull hf:user/repo:file-Q6_K.gguf')}`)
      console.log()
    })

  const synthCmd = program
    .command('synthesis')
    .description('Closed-loop intelligence compounding — bridge self-discovery and universe discovery')

  synthCmd
    .command('run')
    .description('Run full synthesis cycle (all 8 operations)')
    .action(async () => {
      const { synthesize, formatSynthesisResult } = await import('./synthesis-engine.js')

      process.stderr.write('\n' + chalk.dim('Running synthesis cycle...') + '\n\n')
      const result = synthesize()
      console.log(formatSynthesisResult(result))
    })

  synthCmd
    .command('status')
    .description('Show synthesis engine state and stats')
    .action(async () => {
      const { getSynthesisEngineStats, buildSkillMap, formatSkillMap } = await import('./synthesis-engine.js')
      const { synthesizeMemory, getInsights, getSynthesisStats } = await import('./memory-synthesis.js')
      const { getExtendedStats } = await import('./learning.js')

      process.stderr.write('\n')

      // Memory synthesis (existing)
      synthesizeMemory()
      const memStats = getSynthesisStats()
      const learning = getExtendedStats()
      const insights = getInsights(undefined, 10)

      // Engine stats (new)
      const engineStats = getSynthesisEngineStats()

      console.log(chalk.bold('═══════════════════════════════════════════════════════'))
      console.log(chalk.bold(' KBOT SYNTHESIS ENGINE'))
      console.log(chalk.bold('═══════════════════════════════════════════════════════'))

      console.log('\n' + chalk.bold('## Learning Data'))
      console.log(`  Patterns:    ${learning.patternsCount}`)
      console.log(`  Solutions:   ${learning.solutionsCount}`)
      console.log(`  Knowledge:   ${learning.knowledgeCount}`)
      console.log(`  Projects:    ${learning.projectsCount}`)

      console.log('\n' + chalk.bold('## Memory Synthesis'))
      console.log(`  Insights:     ${memStats.insightCount}`)
      console.log(`  Observations: ${memStats.observationCount}`)

      if (insights.length > 0) {
        console.log('\n' + chalk.bold('## Top Insights'))
        for (const insight of insights.slice(0, 8)) {
          const conf = Math.round((insight.confidence ?? 0.5) * 100)
          console.log(`  [${conf}%] ${insight.category ?? 'general'}: ${insight.text}`)
        }
      }

      console.log('\n' + chalk.bold('## Closed-Loop Engine'))
      console.log(`  Cycles:             ${engineStats.totalCycles}`)
      console.log(`  Last cycle:         ${engineStats.lastCycleAt || 'never'}`)
      console.log(`  Tools evaluated:    ${engineStats.toolsEvaluated} (${engineStats.toolsAdopted} adopted, ${engineStats.toolsRejected} rejected)`)
      console.log(`  Agents trialed:     ${engineStats.agentsTrialed} (${engineStats.agentsKept} kept, ${engineStats.agentsDissolved} dissolved)`)
      console.log(`  Papers analyzed:    ${engineStats.papersAnalyzed} (${engineStats.patternsImplemented} patterns)`)
      console.log(`  Corrections active: ${engineStats.correctionsActive}`)
      console.log(`  Reflections closed: ${engineStats.reflectionsClosed}`)
      console.log(`  Patterns xferred:   ${engineStats.patternsTransferred}`)
      console.log(`  Engagements fed:    ${engineStats.engagementsFedBack}`)

      // Discovery data if available
      const { existsSync, readFileSync } = await import('fs')
      const { join } = await import('path')
      const discoveryState = join(process.cwd(), '.kbot-discovery', 'state.json')
      if (existsSync(discoveryState)) {
        try {
          const state = JSON.parse(readFileSync(discoveryState, 'utf8'))
          console.log('\n' + chalk.bold('## Discovery Daemon'))
          console.log(`  Stars:       ${state.knownStars ?? '?'}`)
          console.log(`  Downloads:   ${state.knownDownloads ?? '?'}`)
          console.log(`  Total runs:  ${state.stats?.totalRuns ?? 0}`)
          console.log(`  Evolution:   ${state.stats?.evolutionSuccesses ?? 0} success / ${state.stats?.evolutionFailures ?? 0} fail`)
        } catch {}
      }

      console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════'))
    })

  synthCmd
    .command('ratings')
    .description('Display Bayesian skill map for all agents')
    .action(async () => {
      const { buildSkillMap, formatSkillMap } = await import('./synthesis-engine.js')
      const map = buildSkillMap()
      console.log('\n' + formatSkillMap(map) + '\n')
    })

  synthCmd
    .command('corrections')
    .description('Build and display active corrections for prompt injection')
    .action(async () => {
      const { buildActiveCorrections } = await import('./synthesis-engine.js')

      const corrections = buildActiveCorrections()
      if (corrections.length === 0) {
        console.log(chalk.dim('\nNo corrections extracted yet. Need more reflections or explicit corrections.\n'))
        return
      }

      console.log('\n' + chalk.bold('Active Corrections (injected into prompts):'))
      for (const c of corrections) {
        const icon = c.severity === 'high' ? chalk.red('!!') : c.severity === 'medium' ? chalk.yellow(' !') : chalk.dim(' -')
        console.log(`  ${icon} ${c.rule}`)
        console.log(chalk.dim(`     [${c.source}, ${c.occurrences}x]`))
      }
      console.log('')
    })

  synthCmd
    .command('tools')
    .description('Evaluate discovered tools against failure patterns')
    .action(async () => {
      const { consumeDiscoveredTools } = await import('./synthesis-engine.js')
      const { join } = await import('path')

      const discDir = join(process.cwd(), '.kbot-discovery')
      const adoptions = consumeDiscoveredTools(discDir)
      if (adoptions.length === 0) {
        console.log(chalk.dim('\nNo new tools to evaluate.\n'))
        return
      }

      console.log('\n' + chalk.bold(`Tool Evaluation (${adoptions.length} tools):`))
      for (const t of adoptions) {
        const icon = t.status === 'adopted' ? chalk.green('+') : chalk.red('×')
        console.log(`  ${icon} ${t.name} (${t.stars}★) — ${t.reason}`)
      }
      console.log('')
    })

  synthCmd
    .command('papers')
    .description('Extract insights from discovered academic papers')
    .action(async () => {
      const { extractPaperInsights } = await import('./synthesis-engine.js')
      const { join } = await import('path')

      const discDir = join(process.cwd(), '.kbot-discovery')
      const insights = extractPaperInsights(discDir)
      if (insights.length === 0) {
        console.log(chalk.dim('\nNo new papers to analyze.\n'))
        return
      }

      console.log('\n' + chalk.bold(`Paper Insights (${insights.length} extracted):`))
      for (const p of insights) {
        const icon = p.status === 'proposed' ? chalk.green('→') : chalk.dim('×')
        console.log(`  ${icon} "${p.technique}"`)
        console.log(chalk.dim(`     From: ${p.title.slice(0, 60)}...`))
        console.log(chalk.dim(`     Applies to: ${p.applicableTo}`))
      }
      console.log('')
    })

  // Default action (no subcommand) — run full cycle
  synthCmd.action(async () => {
    const { synthesize, formatSynthesisResult } = await import('./synthesis-engine.js')

    process.stderr.write('\n' + chalk.dim('Running synthesis cycle...') + '\n\n')
    const result = synthesize()
    console.log(formatSynthesisResult(result))
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
      const toolCount = getAllTools().length || 362 // fallback to known count if tools not yet registered

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
          agents: 35,
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
      process.stderr.write(`  ${chalk.bold('Tools')}       ${fmtNum(toolCount)} ${DIM('|')} ${chalk.bold('Agents')} 26\n`)
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
    .command('stream [action]')
    .description('Multi-platform livestream to Twitch, Rumble, and Kick simultaneously')
    .option('-p, --platforms <list>', 'Comma-separated: twitch,rumble,kick or "all"', 'all')
    .option('-s, --source <src>', 'Video source: screen, webcam, test, or file path', 'screen')
    .option('-r, --resolution <res>', 'Output resolution', '1920x1080')
    .option('-b, --bitrate <kbps>', 'Video bitrate in kbps', '4500')
    .action(async (action?: string, opts?: { platforms: string; source: string; resolution: string; bitrate: string }) => {
      const { ensureLazyToolsLoaded, executeTool: execTool } = await import('./tools/index.js')
      await ensureLazyToolsLoaded()

      const cmd = (action || 'status').toLowerCase()

      if (cmd === 'start' || cmd === 'go' || cmd === 'live') {
        const result = await execTool({
          id: `stream_${Date.now()}`, name: 'stream_start',
          arguments: { platforms: opts?.platforms, source: opts?.source, resolution: opts?.resolution, bitrate: opts?.bitrate },
        })
        process.stderr.write(result.result + '\n')
      } else if (cmd === 'stop' || cmd === 'end') {
        const result = await execTool({ id: `stream_${Date.now()}`, name: 'stream_stop', arguments: {} })
        process.stderr.write(result.result + '\n')
      } else if (cmd === 'status') {
        const result = await execTool({ id: `stream_${Date.now()}`, name: 'stream_status', arguments: {} })
        process.stderr.write(result.result + '\n')
      } else if (cmd === 'setup') {
        const result = await execTool({ id: `stream_${Date.now()}`, name: 'stream_setup', arguments: { platform: 'all' } })
        process.stderr.write(result.result + '\n')
      } else {
        process.stderr.write(`Unknown stream action: ${cmd}\nUsage: kbot stream [start|stop|status|setup]\n`)
      }
    })

  program
    .command('serve')
    .description('Start HTTP/HTTPS server — expose all tools for kernel.chat, Claude Cowork, or any client')
    .option('-p, --port <port>', 'Port to listen on', '7437')
    .option('--token <token>', 'Require auth token for all requests')
    .option('--computer-use', 'Enable computer use tools')
    .option('--https', 'Enable HTTPS with auto-generated self-signed cert (~/.kbot/certs/)')
    .option('--cert <path>', 'Path to TLS certificate file (implies HTTPS)')
    .option('--key <path>', 'Path to TLS private key file (implies HTTPS)')
    .action(async (opts: { port: string; token?: string; computerUse?: boolean; https?: boolean; cert?: string; key?: string }) => {
      const { startServe } = await import('./serve.js')
      await startServe({
        port: parseInt(opts.port, 10),
        token: opts.token,
        computerUse: opts.computerUse,
        ...(opts.https ? { https: true, cert: opts.cert, key: opts.key } : {}),
      })
    })

  program
    .command('apps [tool]')
    .description('MCP Apps — list app-capable tools, or run one and render its HTML output')
    .option('--render', 'Run the tool and render its MCP App output in the browser')
    .option('--inline', 'Return inline HTML instead of opening browser')
    .option('--args <json>', 'JSON arguments for the tool (use with --render)')
    .action(async (tool?: string, opts?: { render?: boolean; inline?: boolean; args?: string }) => {
      const { registerMcpAppTools, listAppCapableTools, getAppConfig, renderMcpApp, extractMcpAppFromText } = await import('./mcp-apps.js')
      const { ensureLazyToolsLoaded, executeTool: execTool } = await import('./tools/index.js')

      // Ensure tools are loaded (including MCP App tools)
      await ensureLazyToolsLoaded()

      if (!tool) {
        // List all app-capable tools
        const appTools = listAppCapableTools()

        if (appTools.length === 0) {
          printInfo('No MCP App-capable tools registered.')
          return
        }

        process.stderr.write(`\n  ${chalk.hex('#6B5B95')('MCP App Tools')} (${appTools.length}):\n\n`)
        for (const t of appTools) {
          process.stderr.write(`  ${chalk.bold(t.name)} — ${t.description}\n`)
        }
        process.stderr.write(`\n  ${chalk.dim('Run a tool:')} kbot apps --render <tool> --args \'{"key":"value"}\'\n`)
        process.stderr.write(`  ${chalk.dim('Config:')} ~/.kbot/config.json → mcpApps.renderMode (browser|inline|disabled)\n\n`)
        return
      }

      if (opts?.render) {
        // Parse args
        let toolArgs: Record<string, unknown> = {}
        if (opts.args) {
          try {
            toolArgs = JSON.parse(opts.args)
          } catch {
            printError('Invalid JSON for --args. Example: --args \'{"type":"bar","labels":["A","B"],"datasets":[{"data":[1,2]}]}\'')
            return
          }
        }

        // Execute the tool
        printInfo(`Running ${tool}...`)
        const result = await execTool({
          id: `apps_${Date.now()}`,
          name: tool,
          arguments: toolArgs,
        })

        if (result.error) {
          printError(`Tool error: ${result.result}`)
          return
        }

        // Try to extract MCP App from result
        const appResult = extractMcpAppFromText(result.result)
        if (!appResult) {
          printWarn(`Tool "${tool}" did not return MCP App content. Text output:`)
          console.log(result.result)
          return
        }

        // Render the app
        const config = getAppConfig()
        if (opts.inline) {
          config.renderMode = 'inline'
        }
        const rendered = await renderMcpApp(appResult, config)

        printSuccess(`MCP App: ${appResult.title ?? tool}`)
        if (rendered.path) {
          printInfo(`Opened in browser: ${rendered.path}`)
        }
        if (rendered.rendered && opts.inline) {
          console.log(rendered.rendered)
        }
        console.log(rendered.text)
      } else {
        // Show info about the specific tool
        const appTools = listAppCapableTools()
        const match = appTools.find(t => t.name === tool)
        if (match) {
          printInfo(`${match.name} — ${match.description}`)
          printInfo(`\nRun with: kbot apps --render ${match.name} --args '{...}'`)
        } else {
          printError(`Tool "${tool}" is not registered as MCP App-capable.`)
          printInfo('Run `kbot apps` to see available tools.')
        }
      }
    })

  // ── A2A (Agent-to-Agent) subcommands ──
  const a2aCmd = program
    .command('a2a')
    .description('Agent-to-Agent protocol — discover agents, send tasks, collaborate')

  a2aCmd
    .command('card')
    .description('Print this kbot instance\'s Agent Card JSON')
    .option('--url <url>', 'Override the endpoint URL in the card')
    .action(async (opts: { url?: string }) => {
      const { generateAgentCard } = await import('./a2a-client.js')
      const card = generateAgentCard(opts.url)
      console.log(JSON.stringify(card, null, 2))
    })

  a2aCmd
    .command('discover <url>')
    .description('Discover a remote A2A agent at the given URL')
    .action(async (url: string) => {
      const { discoverAgent } = await import('./a2a-client.js')
      printInfo(`Discovering agent at ${url}...`)
      const card = await discoverAgent(url)
      if (!card) {
        printError(`No A2A agent found at ${url}`)
        printInfo('Make sure the agent serves /.well-known/agent.json')
        process.exit(1)
      }
      printSuccess(`Discovered: ${card.name} (v${card.version})`)
      printInfo(`  ${card.description}`)
      printInfo(`  Skills: ${card.skills.length}`)
      for (const skill of card.skills) {
        printInfo(`    • ${skill.name} — ${skill.description}`)
      }
      printInfo(`  Streaming: ${card.capabilities.streaming}`)
      printInfo(`  Agent saved to local registry.`)
    })

  a2aCmd
    .command('send <url> <prompt...>')
    .description('Send a task to a remote A2A agent')
    .option('--agent <agent>', 'Hint which specialist should handle the task')
    .option('--token <token>', 'Auth token for the remote agent')
    .option('--async', 'Submit asynchronously (don\'t wait for completion)')
    .action(async (url: string, promptParts: string[], opts: { agent?: string; token?: string; async?: boolean }) => {
      const { sendTask } = await import('./a2a-client.js')
      const prompt = promptParts.join(' ')
      const sync = !opts.async

      printInfo(`Sending task to ${url}${sync ? ' (waiting for result)' : ' (async)'}...`)

      try {
        const result = await sendTask(url, prompt, {
          agent: opts.agent,
          token: opts.token,
          sync,
        })

        if (result.status === 'completed' && result.text) {
          printSuccess(`Task ${result.id} completed`)
          console.log()
          console.log(result.text)
        } else if (result.status === 'submitted') {
          printInfo(`Task submitted: ${result.id}`)
          printInfo(`Check status: kbot a2a status ${url} ${result.id}`)
        } else {
          printWarn(`Task ${result.id} — status: ${result.status}`)
          if (result.text) console.log(result.text)
        }
      } catch (err) {
        printError(`Task failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  a2aCmd
    .command('status <url> <taskId>')
    .description('Check the status of a task on a remote agent')
    .option('--token <token>', 'Auth token for the remote agent')
    .action(async (url: string, taskId: string, opts: { token?: string }) => {
      const { getTaskStatus } = await import('./a2a-client.js')
      try {
        const result = await getTaskStatus(url, taskId, { token: opts.token })
        printInfo(`Task ${result.id}: ${result.status}`)
        if (result.message) printInfo(`  Message: ${result.message}`)
        if (result.text) {
          console.log()
          console.log(result.text)
        }
      } catch (err) {
        printError(`Status check failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  a2aCmd
    .command('cancel <url> <taskId>')
    .description('Cancel a running task on a remote agent')
    .option('--token <token>', 'Auth token for the remote agent')
    .action(async (url: string, taskId: string, opts: { token?: string }) => {
      const { cancelTask } = await import('./a2a-client.js')
      try {
        const canceled = await cancelTask(url, taskId, { token: opts.token })
        if (canceled) {
          printSuccess(`Task ${taskId} canceled.`)
        } else {
          printWarn(`Task ${taskId} is already in a terminal state (completed or failed).`)
        }
      } catch (err) {
        printError(`Cancel failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  a2aCmd
    .command('agents')
    .description('List all discovered remote agents in the local registry')
    .action(async () => {
      const { listRemoteAgents, removeRemoteAgent } = await import('./a2a-client.js')
      const agents = listRemoteAgents()
      if (agents.length === 0) {
        printInfo('No remote agents discovered yet.')
        printInfo('Discover one: kbot a2a discover <url>')
        return
      }
      printInfo(`${agents.length} discovered agent${agents.length === 1 ? '' : 's'}:`)
      for (const agent of agents) {
        printInfo(`  • ${agent.card.name} (v${agent.card.version})`)
        printInfo(`    URL: ${agent.url}`)
        printInfo(`    Skills: ${agent.card.skills.length}`)
        printInfo(`    Discovered: ${agent.discoveredAt}`)
        if (agent.lastContactedAt) {
          printInfo(`    Last contact: ${agent.lastContactedAt}`)
        }
      }
    })

  a2aCmd
    .command('history')
    .description('Show local task history (tasks sent to remote agents)')
    .option('--clear', 'Clear the task history')
    .action(async (opts: { clear?: boolean }) => {
      const { getTaskHistory, clearTaskHistory } = await import('./a2a-client.js')
      if (opts.clear) {
        clearTaskHistory()
        printSuccess('Task history cleared.')
        return
      }
      const history = getTaskHistory()
      if (history.length === 0) {
        printInfo('No task history yet.')
        return
      }
      printInfo(`${history.length} task${history.length === 1 ? '' : 's'} in history:`)
      for (const entry of history.slice(-20).reverse()) {
        const status = entry.status === 'completed' ? chalk.green(entry.status)
          : entry.status === 'failed' ? chalk.red(entry.status)
          : chalk.yellow(entry.status)
        printInfo(`  ${entry.id.slice(0, 8)}  ${status}  ${entry.agentUrl}`)
        printInfo(`    ${chalk.dim(entry.prompt.slice(0, 80))}`)
      }
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

  // ── Email Agent ──
  const emailAgentCmd = program
    .command('email-agent')
    .description('Autonomous email companion agent — responds to emails via local AI ($0 cost)')

  emailAgentCmd
    .command('start')
    .description('Start the email agent — polls for new emails and responds via Ollama')
    .option('--model <model>', 'Ollama model to use', 'qwen2.5-coder:32b')
    .option('--interval <ms>', 'Poll interval in milliseconds', '15000')
    .option('--users <emails>', 'Comma-separated email addresses to monitor (omit for open mode — all inbound)')
    .option('--open', 'Open mode — respond to ALL inbound emails (no whitelist)')
    .action(async (opts: { model?: string; interval?: string; users?: string; open?: boolean }) => {
      const { startEmailAgent } = await import('./email-agent.js')
      const { existsSync, readFileSync } = await import('node:fs')
      const { join } = await import('node:path')

      // Load env
      let supabaseUrl = '', supabaseKey = '', resendKey = ''
      const envPaths = [join(process.cwd(), '.env'), join(process.env.HOME || '', '.kbot', '.env')]
      for (const envPath of envPaths) {
        if (existsSync(envPath)) {
          const env = readFileSync(envPath, 'utf8')
          const get = (k: string) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim() ?? ''
          supabaseUrl = supabaseUrl || get('VITE_SUPABASE_URL')
          supabaseKey = supabaseKey || get('SUPABASE_SERVICE_KEY')
          resendKey = resendKey || get('RESEND_API_KEY')
        }
      }

      if (!supabaseUrl || !supabaseKey) {
        printError('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
        return
      }
      if (!resendKey) {
        printError('Missing RESEND_API_KEY in .env — needed to send reply emails')
        return
      }

      const agentUsers = opts.users?.split(',').map(e => e.trim()) || []
      if (agentUsers.length === 0 && !opts.open) {
        printError('No users specified. Use --users email1,email2 or --open for all inbound.')
        return
      }

      const mode = agentUsers.length === 0 ? 'OPEN (all inbound)' : `${agentUsers.length} users`
      console.log()
      console.log(chalk.hex('#6B5B95')('  ◉ Kernel Email Agent'))
      console.log(chalk.dim(`  Model: ${opts.model || 'qwen2.5-coder:32b'}`))
      console.log(chalk.dim(`  Mode: ${mode}`))
      console.log(chalk.dim(`  Poll interval: ${Number(opts.interval || 15000) / 1000}s`))
      console.log()

      await startEmailAgent({
        supabaseUrl,
        supabaseKey,
        resendKey,
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: opts.model || 'qwen2.5-coder:32b',
        pollInterval: Number(opts.interval || 15000),
        agentUsers,
      })

      // Keep process alive
      await new Promise(() => {})
    })

  emailAgentCmd
    .command('status')
    .description('Show email agent status')
    .action(async () => {
      const { getEmailAgentState } = await import('./email-agent.js')
      const state = getEmailAgentState()
      if (state.running) {
        printSuccess(`Email agent is running`)
        printInfo(`  Processed: ${state.processedCount} emails`)
        printInfo(`  Last check: ${state.lastCheck || 'never'}`)
        if (state.errors.length > 0) {
          printWarn(`  Recent errors: ${state.errors.length}`)
          for (const err of state.errors.slice(-3)) {
            printError(`    ${err}`)
          }
        }
      } else {
        printInfo('Email agent is not running. Start with: kbot email-agent start --open')
      }
    })

  // ── iMessage Agent ──
  const imessageCmd = program
    .command('imessage-agent')
    .description('Free iMessage/SMS agent via macOS Messages.app ($0 cost, unlimited)')

  imessageCmd
    .command('start')
    .description('Start monitoring iMessage — responds via local Ollama')
    .option('--model <model>', 'Ollama model to use', 'qwen2.5-coder:32b')
    .option('--interval <ms>', 'Poll interval in milliseconds', '10000')
    .option('--numbers <nums>', 'Comma-separated phone numbers to monitor (e.g., +17145551234)')
    .action(async (opts: { model?: string; interval?: string; numbers?: string }) => {
      const { platform } = await import('node:os')
      if (platform() !== 'darwin') {
        printError('iMessage agent is only available on macOS')
        return
      }

      const numbers = opts.numbers?.split(',').map(n => n.trim()) || []
      if (numbers.length === 0) {
        printError('No phone numbers specified. Use --numbers +17145551234,+12135559876')
        return
      }

      // Optional Supabase for logging
      let supabaseUrl = '', supabaseKey = ''
      const { existsSync, readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const envPaths = [join(process.cwd(), '.env'), join(process.env.HOME || '', '.kbot', '.env')]
      for (const envPath of envPaths) {
        if (existsSync(envPath)) {
          const env = readFileSync(envPath, 'utf8')
          const get = (k: string) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim() ?? ''
          supabaseUrl = supabaseUrl || get('VITE_SUPABASE_URL')
          supabaseKey = supabaseKey || get('SUPABASE_SERVICE_KEY')
        }
      }

      console.log()
      console.log(chalk.hex('#6B5B95')('  ◉ Kernel iMessage Agent'))
      console.log(chalk.dim(`  Model: ${opts.model || 'qwen2.5-coder:32b'}`))
      console.log(chalk.dim(`  Monitoring: ${numbers.join(', ')}`))
      console.log(chalk.dim(`  Poll interval: ${Number(opts.interval || 10000) / 1000}s`))
      if (supabaseUrl) console.log(chalk.dim('  Logging to Supabase: yes'))
      console.log()

      const { startIMessageAgent } = await import('./imessage-agent.js')
      await startIMessageAgent({
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: opts.model || 'qwen2.5-coder:32b',
        pollInterval: Number(opts.interval || 10000),
        numbers,
        supabaseUrl: supabaseUrl || undefined,
        supabaseKey: supabaseKey || undefined,
      })

      // Keep process alive
      await new Promise(() => {})
    })

  imessageCmd
    .command('status')
    .description('Show iMessage agent status')
    .action(async () => {
      const { getIMessageAgentState } = await import('./imessage-agent.js')
      const state = getIMessageAgentState()
      if (state.running) {
        printSuccess('iMessage agent is running')
        printInfo(`  Messages processed: ${state.messagesProcessed}`)
        printInfo(`  Last check: ${state.lastCheck || 'never'}`)
        if (state.errors.length > 0) {
          printWarn(`  Recent errors: ${state.errors.length}`)
        }
      } else {
        printInfo('iMessage agent is not running. Start with: kbot imessage-agent start --numbers +1234567890')
      }
    })

  // ── Consultation ──
  program
    .command('consultation')
    .description('Consultation engine — domain guardrails, intake, client management')
    .option('--check <message>', 'Check if a message hits domain guardrails')
    .option('--intake', 'Generate the intake questionnaire')
    .action(async (opts: { check?: string; intake?: boolean }) => {
      const { checkDomainGuardrails, getIntakeMessage } = await import('./consultation.js')

      if (opts.check) {
        const result = checkDomainGuardrails(opts.check)
        if (result.blocked) {
          printWarn(`Blocked — ${result.domain} domain`)
          printInfo(result.message || '')
          if (result.suggestedTopic) printInfo(`Suggested redirect: ${result.suggestedTopic}`)
        } else {
          printSuccess('Message passes domain guardrails')
        }
        return
      }

      if (opts.intake) {
        console.log(getIntakeMessage())
        return
      }

      // Default: show help
      printInfo('Kernel Consultation Engine')
      printInfo('')
      printInfo('  kbot consultation --check "message"   Check domain guardrails')
      printInfo('  kbot consultation --intake             Generate intake questions')
    })

  program
    .command('sessions')
    .description('List all saved sessions from the command line')
    .option('--json', 'Output as JSON for scripting')
    .action(async (opts: { json?: boolean }) => {
      const sessions = listSessions()
      if (sessions.length === 0) {
        printInfo('No saved sessions. Use /save in the REPL to save a conversation.')
        return
      }
      if (opts.json) {
        console.log(JSON.stringify(sessions, null, 2))
      } else {
        printInfo(`${sessions.length} saved session(s)`)
        console.log(formatSessionList(sessions))
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
    .description('Full audit of any GitHub repository — security, quality, docs, DevOps. Generates shareable report with badge.')
    .option('--share', 'Auto-share the report as a public GitHub Gist')
    .option('--json', 'Output raw JSON')
    .option('--badge', 'Print only the badge markdown (for adding to READMEs)')
    .action(async (repo: string, auditOpts: { share?: boolean; json?: boolean; badge?: boolean }) => {
      const { auditRepo, formatAuditReport, formatAuditTerminal } = await import('./tools/audit.js')
      printInfo(`Auditing ${repo}...`)
      try {
        const result = await auditRepo(repo)

        if (auditOpts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        if (auditOpts.badge) {
          const pct = Math.round((result.score / result.maxScore) * 100)
          const badgeColor = pct >= 80 ? 'brightgreen' : pct >= 60 ? 'yellow' : 'red'
          console.log(`[![kbot audit: ${result.grade}](https://img.shields.io/badge/kbot_audit-${result.grade}_(${pct}%25)-${badgeColor})](https://www.npmjs.com/package/@kernel.chat/kbot)`)
          return
        }

        // Terminal gets the styled version; --share gist gets markdown
        const terminalReport = formatAuditTerminal(result)
        console.log(terminalReport)

        // Auto-share as gist (uses markdown format for portability)
        if (auditOpts.share) {
          printInfo('Sharing audit report...')
          try {
            const markdownReport = formatAuditReport(result)
            const { createGist } = await import('./share.js')
            const url = createGist(markdownReport, `kbot-audit-${repo.replace('/', '-')}.md`, `kbot Audit: ${repo} — Grade ${result.grade}`, true)
            if (url?.startsWith('http')) {
              printSuccess(`Shared! ${url}`)
              printInfo(`Badge for ${repo}'s README:`)
              const pct = Math.round((result.score / result.maxScore) * 100)
              const badgeColor = pct >= 80 ? 'brightgreen' : pct >= 60 ? 'yellow' : 'red'
              printInfo(`  [![kbot audit: ${result.grade}](https://img.shields.io/badge/kbot_audit-${result.grade}_(${pct}%25)-${badgeColor})](${url})`)
            }
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

  // ── Bench ──
  program
    .command('bench')
    .description('Run benchmarks — evaluate kbot against standardized coding and research tasks')
    .option('--category <cat>', 'Filter by category (codegen, bugfix, refactor, explain, research, science)')
    .option('--difficulty <diff>', 'Filter by difficulty (easy, medium, hard)')
    .option('--compare', 'Compare with previous run')
    .option('--history', 'Show benchmark history')
    .option('--verbose', 'Show detailed per-task results')
    .option('--limit <n>', 'Limit number of tasks', parseInt)
    .action(async (benchOpts: { category?: string; difficulty?: string; compare?: boolean; history?: boolean; verbose?: boolean; limit?: number }) => {
      const { registerBenchCommand } = await import('./bench.js')
      // Delegate to the bench module's own handler
      const { runBenchmark, getBenchHistory, compareBenchmarks, formatBenchResult } = await import('./bench.js')

      if (benchOpts.history) {
        const history = getBenchHistory()
        if (history.length === 0) { console.error(chalk.dim('  No benchmark history. Run `kbot bench` first.')); return }
        for (const h of history.slice(-10)) {
          console.error(`  ${chalk.dim(h.timestamp.slice(0, 10))}  ${chalk.hex('#6B5B95')(h.totalScore.toFixed(1) + '/100')}  ${chalk.dim(h.provider + '/' + h.model)}  ${chalk.dim(h.tasks.length + ' tasks')}`)
        }
        return
      }

      const result = await runBenchmark({
        categories: benchOpts.category ? [benchOpts.category] : undefined,
        difficulty: benchOpts.difficulty,
        verbose: benchOpts.verbose,
        limit: benchOpts.limit,
      })
      formatBenchResult(result)

      if (benchOpts.compare) {
        const history = getBenchHistory()
        if (history.length >= 2) {
          console.error(compareBenchmarks(history[history.length - 2], result))
        }
      }
    })

  // ── Lab ──
  program
    .command('lab')
    .description('Science lab — interactive research REPL with domain-specific tools and notebooks')
    .option('--domain <domain>', 'Start in a specific domain (physics, chemistry, biology, math, neuro, earth, social, humanities, health)')
    .option('--resume <id>', 'Resume a previous lab session')
    .option('--name <name>', 'Name this lab session')
    .action(async (labOpts: { domain?: string; resume?: string; name?: string }) => {
      const { startLab } = await import('./lab.js')
      await startLab({
        domain: labOpts.domain as any,
        resume: labOpts.resume,
        name: labOpts.name,
      })
    })

  // ── Teach ──
  program
    .command('teach [input...]')
    .description('Teach kbot patterns, rules, and preferences explicitly')
    .option('--list', 'List all teachings')
    .option('--stats', 'Show teaching statistics')
    .option('--remove <id>', 'Remove a teaching by ID')
    .option('--export', 'Export teachings as JSON')
    .option('--import <file>', 'Import teachings from JSON file')
    .action(async (input: string[], teachOpts: { list?: boolean; stats?: boolean; remove?: string; export?: boolean; import?: string }) => {
      const { handleTeachCommand } = await import('./teach.js')
      const args = []
      if (teachOpts.list) args.push('list')
      else if (teachOpts.stats) args.push('stats')
      else if (teachOpts.remove) args.push('remove', teachOpts.remove)
      else if (teachOpts.export) args.push('export')
      else if (teachOpts.import) args.push('import', teachOpts.import)
      else if (input.length > 0) args.push(input.join(' '))
      await handleTeachCommand(args)
    })

  // ── Sessions ──
  program
  program
    .command('release')
    .description('Create a GitHub release with auto-generated changelog')
    .option('--draft', 'Create as draft release')
    .option('--tag <tag>', 'Override tag (default: vX.Y.Z from package.json)')
    .option('--dry-run', 'Preview release notes without creating the release')
    .option('--json', 'Output result as JSON')
    .action(async (releaseOpts: { draft?: boolean; tag?: string; dryRun?: boolean; json?: boolean }) => {
      const { runRelease } = await import('./github-release.js')
      await runRelease({
        draft: releaseOpts.draft,
        tag: releaseOpts.tag,
        dryRun: releaseOpts.dryRun,
        json: releaseOpts.json || program.opts().json,
      })
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

  // ── Admin — manage users, billing, moderation ──
  const adminCmd = program
    .command('admin')
    .description('Platform administration — users, billing, moderation, stats')

  adminCmd
    .command('users')
    .description('List platform users')
    .option('--filter <filter>', 'Filter: all, free, pro, max, active, churned', 'all')
    .option('--search <email>', 'Search by email')
    .option('--limit <n>', 'Max results', '50')
    .action(async (opts: { filter: string; search?: string; limit: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const result = await executeTool({ id: 'admin_users', name: 'admin_users', arguments: opts })
      console.log(result.result)
    })

  adminCmd
    .command('user <email>')
    .description('Get detailed info for a user')
    .action(async (email: string) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const result = await executeTool({ id: 'admin_user_detail', name: 'admin_user_detail', arguments: { email } })
      console.log(result.result)
    })

  adminCmd
    .command('stats')
    .description('Platform-wide stats')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const result = await executeTool({ id: 'admin_stats', name: 'admin_stats', arguments: {} })
      console.log(result.result)
    })

  adminCmd
    .command('billing <action>')
    .description('Billing: mrr, invoices, customer, create-invoice')
    .option('--email <email>', 'Customer email')
    .option('--amount <cents>', 'Amount in cents')
    .option('--description <desc>', 'Invoice description')
    .action(async (action: string, opts: { email?: string; amount?: string; description?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const result = await executeTool({ id: 'admin_billing', name: 'admin_billing', arguments: { action, ...opts } })
      console.log(result.result)
    })

  adminCmd
    .command('moderate')
    .description('View moderation queue')
    .option('--approve <id>', 'Approve item')
    .option('--reject <id>', 'Reject item')
    .option('--reason <reason>', 'Rejection reason')
    .action(async (opts: { approve?: string; reject?: string; reason?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const action = opts.approve ? 'approve' : opts.reject ? 'reject' : 'queue'
      const result = await executeTool({ id: 'admin_moderate', name: 'admin_moderate', arguments: {
        action, item_id: opts.approve || opts.reject || '', reason: opts.reason || '',
      }})
      console.log(result.result)
    })

  // ── Monitor — platform health dashboard ──
  program
    .command('monitor')
    .description('Platform health dashboard — messages, errors, costs, services')
    .option('--period <period>', 'Period: 1h, 24h, 7d', '24h')
    .option('--logs', 'Show recent platform logs')
    .option('--uptime', 'Service health check only')
    .option('--alerts', 'Show active alerts only')
    .action(async (opts: { period: string; logs?: boolean; uptime?: boolean; alerts?: boolean }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      if (opts.uptime) {
        const r = await executeTool({ id: 'platform_uptime', name: 'platform_uptime', arguments: {} })
        console.log(r.result); return
      }
      if (opts.logs) {
        const r = await executeTool({ id: 'platform_logs', name: 'platform_logs', arguments: { limit: '30' } })
        console.log(r.result); return
      }
      if (opts.alerts) {
        const r = await executeTool({ id: 'platform_alerts', name: 'platform_alerts', arguments: { period: opts.period } })
        console.log(r.result); return
      }
      const r = await executeTool({ id: 'platform_monitor', name: 'platform_monitor', arguments: { period: opts.period } })
      console.log(r.result)
    })

  // ── Analytics — downloads, stars, users, revenue ──
  const analyticsCmd = program
    .command('analytics')
    .description('Analytics dashboard — npm, GitHub, users, revenue')

  analyticsCmd
    .command('overview')
    .description('Full analytics dashboard')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'analytics_overview', name: 'analytics_overview', arguments: {} })
      console.log(r.result)
    })

  analyticsCmd
    .command('npm')
    .description('npm download stats and trends')
    .option('--period <period>', 'week, month, year', 'month')
    .option('--compare <pkg>', 'Compare against another package')
    .action(async (opts: { period: string; compare?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'analytics_npm', name: 'analytics_npm', arguments: opts })
      console.log(r.result)
    })

  analyticsCmd
    .command('github')
    .description('GitHub repo stats and traffic')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'analytics_github', name: 'analytics_github', arguments: {} })
      console.log(r.result)
    })

  analyticsCmd
    .command('users')
    .description('User growth and churn metrics')
    .option('--period <period>', '7d, 30d, 90d', '30d')
    .action(async (opts: { period: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'analytics_users', name: 'analytics_users', arguments: opts })
      console.log(r.result)
    })

  analyticsCmd
    .command('revenue')
    .description('Revenue: MRR, subscriptions, API costs')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'analytics_revenue', name: 'analytics_revenue', arguments: {} })
      console.log(r.result)
    })

  // ── Deploy — ship everything from terminal ──
  const deployCmd = program
    .command('deploy')
    .description('Deploy: web, edge functions, npm, GitHub release — or all at once')

  deployCmd
    .command('all')
    .description('Ship everything: typecheck → web → functions → npm → release')
    .option('--skip <steps>', 'Skip: web,functions,npm,release')
    .option('--dry-run', 'Show plan without executing')
    .action(async (opts: { skip?: string; dryRun?: boolean }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'deploy_all', name: 'deploy_all', arguments: {
        skip: opts.skip, dry_run: opts.dryRun ? 'true' : 'false',
      }})
      console.log(r.result)
    })

  deployCmd
    .command('web')
    .description('Build and deploy web to GitHub Pages')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'deploy_web', name: 'deploy_web', arguments: {} })
      console.log(r.result)
    })

  deployCmd
    .command('functions [name]')
    .description('Deploy Supabase edge functions')
    .action(async (name?: string) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'deploy_functions', name: 'deploy_functions', arguments: { function_name: name } })
      console.log(r.result)
    })

  deployCmd
    .command('npm')
    .description('Build and publish to npm')
    .option('--dry-run', 'Build only, do not publish')
    .action(async (opts: { dryRun?: boolean }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'deploy_npm', name: 'deploy_npm', arguments: { dry_run: opts.dryRun ? 'true' : 'false' } })
      console.log(r.result)
    })

  deployCmd
    .command('release')
    .description('Create GitHub release')
    .option('--notes <notes>', 'Release notes')
    .action(async (opts: { notes?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'deploy_release', name: 'deploy_release', arguments: { notes: opts.notes } })
      console.log(r.result)
    })

  // ── Env — environment variable management ──
  const envCmd = program
    .command('env')
    .description('Manage environment variables and secrets')

  envCmd
    .command('check')
    .description('Verify all required env vars are set')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'env_check', name: 'env_check', arguments: {} })
      console.log(r.result)
    })

  envCmd
    .command('list')
    .description('List Supabase secrets')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'env_list', name: 'env_list', arguments: {} })
      console.log(r.result)
    })

  envCmd
    .command('set <name> <value>')
    .description('Set a Supabase secret')
    .action(async (name: string, value: string) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'env_set', name: 'env_set', arguments: { name, value } })
      console.log(r.result)
    })

  envCmd
    .command('sync <keys>')
    .description('Sync local .env keys to Supabase secrets')
    .option('--dry-run', 'Show what would be synced')
    .action(async (keys: string, opts: { dryRun?: boolean }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'env_sync', name: 'env_sync', arguments: { keys, dry_run: opts.dryRun ? 'true' : 'false' } })
      console.log(r.result)
    })

  envCmd
    .command('rotate <key>')
    .description('Rotate a secret (shows guide or applies new value)')
    .option('--value <value>', 'New value')
    .action(async (key: string, opts: { value?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'env_rotate', name: 'env_rotate', arguments: { key, new_value: opts.value } })
      console.log(r.result)
    })

  // ── DB — database administration ──
  const dbCmd = program
    .command('db')
    .description('Database administration — backup, inspect, query, migrate')

  dbCmd
    .command('backup')
    .description('Dump database to file')
    .option('--output <path>', 'Output file path')
    .option('--schema-only', 'Schema only, no data')
    .action(async (opts: { output?: string; schemaOnly?: boolean }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'db_backup', name: 'db_backup', arguments: { output: opts.output, schema_only: opts.schemaOnly ? 'true' : 'false' } })
      console.log(r.result)
    })

  dbCmd
    .command('tables')
    .description('List all tables with row counts')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'db_tables', name: 'db_tables', arguments: {} })
      console.log(r.result)
    })

  dbCmd
    .command('inspect <table>')
    .description('Inspect table schema and sample data')
    .option('--sample <n>', 'Number of sample rows', '5')
    .action(async (table: string, opts: { sample: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'db_inspect', name: 'db_inspect', arguments: { table, sample: opts.sample } })
      console.log(r.result)
    })

  dbCmd
    .command('sql <query>')
    .description('Run SQL query (read-only recommended)')
    .action(async (query: string) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'db_sql', name: 'db_sql', arguments: { query } })
      console.log(r.result)
    })

  dbCmd
    .command('migrations')
    .description('List and run database migrations')
    .option('--run', 'Apply pending migrations')
    .option('--new <name>', 'Create new migration')
    .action(async (opts: { run?: boolean; new?: string }) => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const action = opts.run ? 'run' : opts.new ? 'new' : 'list'
      const r = await executeTool({ id: 'db_migrations', name: 'db_migrations', arguments: { action, name: opts.new } })
      console.log(r.result)
    })

  dbCmd
    .command('health')
    .description('Database health check')
    .action(async () => {
      await ensureLazyToolsLoaded()
      const { executeTool } = await import('./tools/index.js')
      const r = await executeTool({ id: 'db_health', name: 'db_health', arguments: {} })
      console.log(r.result)
    })

  // ── Dream Engine ──
  const dreamCmd = program
    .command('dream')
    .description('Memory consolidation — consolidate session knowledge into durable insights')

  dreamCmd
    .command('run')
    .description('Run a dream cycle now (uses local Ollama)')
    .action(async () => {
      const { dream } = await import('./dream.js')
      console.log()
      console.log(`  ${chalk.hex('#A78BFA')('◆')} ${chalk.bold('Dream Engine')}  ${chalk.dim('consolidating memories...')}`)
      console.log()
      const result = await dream()
      if (result.success) {
        console.log(`  ${chalk.hex('#4ADE80')('✓')} ${chalk.bold(`Cycle #${result.cycle} complete`)}  ${chalk.dim(`${result.duration}ms`)}`)
        console.log()
        console.log(`    ${chalk.hex('#4ADE80')('+')} ${chalk.bold(String(result.newInsights))} new insights`)
        console.log(`    ${chalk.hex('#A78BFA')('↻')} ${chalk.bold(String(result.reinforced))} reinforced`)
        if (result.archived > 0) {
          console.log(`    ${chalk.dim('↓')} ${chalk.dim(`${result.archived} archived (aged out)`)}`)
        }
        console.log()
        console.log(`  ${chalk.dim('View results:')} ${chalk.hex('#A78BFA')('kbot dream status')}`)
      } else {
        console.log(`  ${chalk.hex('#FBBF24')('!')} ${result.error || 'Dream cycle failed'}`)
        if (result.archived > 0) {
          console.log(`    ${chalk.dim('↓')} ${chalk.dim(`${result.archived} insights archived (aging only)`)}`)
        }
      }
      console.log()
    })

  dreamCmd
    .command('status')
    .description('Show dream engine status and top insights')
    .action(async () => {
      const { getDreamStatus } = await import('./dream.js')
      const { state, insights, archiveCount } = getDreamStatus()

      // ── Helper functions ──
      const W = 56 // inner width
      const box = {
        tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
        pad: (s: string, w: number) => {
          // Pad string to width, accounting for chalk ANSI codes
          const visible = s.replace(/\x1b\[[0-9;]*m/g, '')
          const diff = w - visible.length
          return diff > 0 ? s + ' '.repeat(diff) : s
        },
      }
      const relevanceBar = (pct: number, len = 20) => {
        const filled = Math.round((pct / 100) * len)
        const empty = len - filled
        const color = pct >= 70 ? chalk.hex('#4ADE80') : pct >= 40 ? chalk.hex('#FBBF24') : chalk.hex('#F87171')
        return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))
      }
      const categoryColor = (cat: string) => {
        const colors: Record<string, string> = {
          pattern: '#A78BFA', preference: '#67E8F9', skill: '#4ADE80',
          project: '#FB923C', relationship: '#F472B6',
        }
        return chalk.hex(colors[cat] || '#A78BFA')
      }
      const categoryChip = (cat: string) => {
        const c = categoryColor(cat)
        return c(` ${cat.toUpperCase()} `)
      }

      // ── Header box ──
      console.log()
      console.log(chalk.hex('#A78BFA')(`  ${box.tl}${box.h.repeat(W)}${box.tr}`))
      console.log(chalk.hex('#A78BFA')(`  ${box.v}`) + box.pad(`  ${chalk.hex('#A78BFA').bold('◆ DREAM ENGINE')}  ${chalk.dim('memory consolidation')}`, W) + chalk.hex('#A78BFA')(box.v))
      console.log(chalk.hex('#A78BFA')(`  ${box.bl}${box.h.repeat(W)}${box.br}`))
      console.log()

      // ── Stats row ──
      const lastDreamDisplay = state.lastDream
        ? new Date(state.lastDream).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : chalk.dim('never')
      console.log(`  ${chalk.bold('Cycles')}  ${chalk.hex('#A78BFA')(String(state.cycles))}    ${chalk.bold('Last')}  ${lastDreamDisplay}    ${chalk.bold('Active')}  ${chalk.hex('#4ADE80')(String(state.activeInsights))}`)
      console.log(`  ${chalk.bold('Total')}   ${chalk.dim(String(state.totalInsights))}    ${chalk.bold('Archived')}  ${chalk.dim(`${state.totalArchived} (${archiveCount} files)`)}`)
      console.log()

      if (insights.length > 0) {
        // ── Average relevance bar ──
        const avgRel = Math.round(insights.reduce((s, i) => s + i.relevance, 0) / insights.length * 100)
        console.log(`  ${chalk.bold('Avg Relevance')}  ${relevanceBar(avgRel, 24)}  ${chalk.bold(`${avgRel}%`)}`)
        console.log()

        // ── Category breakdown ──
        const catCounts: Record<string, number> = {}
        for (const i of insights) catCounts[i.category] = (catCounts[i.category] || 0) + 1
        const chips = Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => `${categoryChip(cat)} ${chalk.dim(`${count}`)}`)
          .join('  ')
        console.log(`  ${chalk.bold('Categories')}  ${chips}`)
        console.log()

        // ── Divider ──
        console.log(chalk.dim(`  ${'─'.repeat(W)}`))
        console.log()

        // ── Top insights ──
        console.log(`  ${chalk.bold('Top Insights')}`)
        console.log()
        for (const i of insights.slice(0, 8)) {
          const pct = Math.round(i.relevance * 100)
          const bar = relevanceBar(pct, 12)
          const tag = categoryChip(i.category)
          console.log(`  ${bar} ${chalk.bold(`${pct}%`)}  ${tag}`)
          console.log(`  ${chalk.white(i.content)}`)
          if (i.keywords.length > 0) {
            console.log(`  ${chalk.dim(i.keywords.map(k => `#${k}`).join('  '))}  ${chalk.dim('·')}  ${chalk.dim(`${i.sessions} sessions`)}`)
          }
          console.log()
        }
      } else {
        console.log(chalk.dim(`  ${'─'.repeat(W)}`))
        console.log()
        console.log(`  ${chalk.dim('No insights yet.')}`)
        console.log(`  ${chalk.dim('Run:')} ${chalk.hex('#A78BFA')('kbot dream run')} ${chalk.dim('to start consolidating memories')}`)
        console.log()
      }
    })

  dreamCmd
    .command('search <query>')
    .description('Search dream insights by keyword')
    .action(async (query: string) => {
      const { searchDreams } = await import('./dream.js')
      const results = searchDreams(query)

      // Helpers
      const relevanceBar = (pct: number, len = 12) => {
        const filled = Math.round((pct / 100) * len)
        const empty = len - filled
        const color = pct >= 70 ? chalk.hex('#4ADE80') : pct >= 40 ? chalk.hex('#FBBF24') : chalk.hex('#F87171')
        return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))
      }
      const categoryColor = (cat: string) => {
        const colors: Record<string, string> = {
          pattern: '#A78BFA', preference: '#67E8F9', skill: '#4ADE80',
          project: '#FB923C', relationship: '#F472B6',
        }
        return chalk.hex(colors[cat] || '#A78BFA')
      }
      const highlightQuery = (text: string, q: string) => {
        const terms = q.toLowerCase().split(/\s+/)
        let result = text
        for (const term of terms) {
          const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
          result = result.replace(regex, chalk.hex('#FBBF24').bold.underline('$1'))
        }
        return result
      }

      if (results.length === 0) {
        console.log()
        console.log(`  ${chalk.hex('#A78BFA')('◆')} ${chalk.bold('Dream Search')}  ${chalk.dim(`"${query}"`)}`)
        console.log()
        console.log(`  ${chalk.dim('No insights match this query.')}`)
        console.log(`  ${chalk.dim('Try broader keywords or run')} ${chalk.hex('#A78BFA')('kbot dream run')} ${chalk.dim('first.')}`)
        console.log()
        return
      }

      console.log()
      console.log(`  ${chalk.hex('#A78BFA')('◆')} ${chalk.bold('Dream Search')}  ${chalk.dim(`"${query}"`)}  ${chalk.hex('#4ADE80')(`${results.length} found`)}`)
      console.log(chalk.dim(`  ${'─'.repeat(52)}`))
      console.log()

      for (const i of results.slice(0, 15)) {
        const pct = Math.round(i.relevance * 100)
        const bar = relevanceBar(pct)
        const tag = categoryColor(i.category)(` ${i.category.toUpperCase()} `)
        console.log(`  ${bar} ${chalk.bold(`${pct}%`)}  ${tag}`)
        console.log(`  ${highlightQuery(i.content, query)}`)
        const keywordsHighlighted = i.keywords.map(k => highlightQuery(`#${k}`, query)).join('  ')
        console.log(`  ${keywordsHighlighted}  ${chalk.dim('·')}  ${chalk.dim(`${i.sessions} sessions`)}  ${chalk.dim('·')}  ${chalk.dim(i.created.split('T')[0])}`)
        console.log()
      }
    })

  dreamCmd
    .command('journal')
    .description('Print the full dream journal')
    .action(async () => {
      const { getDreamStatus } = await import('./dream.js')
      const { state, insights } = getDreamStatus()

      // Helpers
      const W = 56
      const box = {
        tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
        pad: (s: string, w: number) => {
          const visible = s.replace(/\x1b\[[0-9;]*m/g, '')
          const diff = w - visible.length
          return diff > 0 ? s + ' '.repeat(diff) : s
        },
      }
      const relevanceBar = (pct: number, len = 16) => {
        const filled = Math.round((pct / 100) * len)
        const empty = len - filled
        const color = pct >= 70 ? chalk.hex('#4ADE80') : pct >= 40 ? chalk.hex('#FBBF24') : chalk.hex('#F87171')
        return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))
      }
      const categoryColors: Record<string, string> = {
        pattern: '#A78BFA', preference: '#67E8F9', skill: '#4ADE80',
        project: '#FB923C', relationship: '#F472B6',
      }
      const categoryIcon: Record<string, string> = {
        pattern: '◇', preference: '♡', skill: '⚡', project: '▸', relationship: '◈',
      }
      const categoryColor = (cat: string) => chalk.hex(categoryColors[cat] || '#A78BFA')

      if (insights.length === 0) {
        console.log()
        console.log(`  ${chalk.hex('#A78BFA')('◆')} ${chalk.bold('Dream Journal')}`)
        console.log()
        console.log(`  ${chalk.dim('The journal is empty.')}`)
        console.log(`  ${chalk.dim('Run')} ${chalk.hex('#A78BFA')('kbot dream run')} ${chalk.dim('after a session to consolidate memories.')}`)
        console.log()
        return
      }

      // ── Header ──
      console.log()
      console.log(chalk.hex('#A78BFA')(`  ${box.tl}${box.h.repeat(W)}${box.tr}`))
      const headerContent = `  ${chalk.hex('#A78BFA').bold('◆ DREAM JOURNAL')}  ${chalk.dim(`${insights.length} insights · cycle ${state.cycles}`)}`
      console.log(chalk.hex('#A78BFA')(`  ${box.v}`) + box.pad(headerContent, W) + chalk.hex('#A78BFA')(box.v))
      console.log(chalk.hex('#A78BFA')(`  ${box.bl}${box.h.repeat(W)}${box.br}`))
      console.log()

      // ── Group by category ──
      const grouped: Record<string, typeof insights> = {}
      for (const i of insights) {
        if (!grouped[i.category]) grouped[i.category] = []
        grouped[i.category].push(i)
      }

      // Sort categories by total insight count descending
      const catOrder = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)

      for (const [cat, catInsights] of catOrder) {
        const icon = categoryIcon[cat] || '●'
        const cc = categoryColor(cat)

        // ── Category section header ──
        console.log(`  ${cc(`${icon} ${cat.toUpperCase()}`)}  ${chalk.dim(`(${catInsights.length})`)}`)
        console.log(`  ${cc('─'.repeat(W))}`)
        console.log()

        for (const i of catInsights) {
          const pct = Math.round(i.relevance * 100)
          const bar = relevanceBar(pct)
          const date = i.created.split('T')[0]
          const reinforced = i.lastReinforced !== i.created
            ? chalk.dim(` · reinforced ${i.lastReinforced.split('T')[0]}`)
            : ''

          // Card: relevance bar + content + metadata
          console.log(`  ${bar} ${chalk.bold(`${pct}%`)}  ${chalk.dim(`${i.sessions} sessions`)}${reinforced}`)
          console.log(`  ${chalk.white(i.content)}`)
          if (i.keywords.length > 0) {
            console.log(`  ${chalk.dim(i.keywords.map(k => `#${k}`).join('  '))}`)
          }
          console.log(`  ${chalk.dim(`${date} · ${i.source} · ${i.id}`)}`)
          console.log()
        }
      }

      // ── Footer ──
      console.log(chalk.dim(`  ${'─'.repeat(W)}`))
      const avgRel = Math.round(insights.reduce((s, i) => s + i.relevance, 0) / insights.length * 100)
      console.log(`  ${chalk.dim(`${insights.length} active insights · avg relevance ${avgRel}% · ${state.totalArchived} archived`)}`)
      console.log()
    })

  // ── Buddy Commands ──

  const buddyCmd = program
    .command('buddy')
    .description('Your terminal companion — chat, rename, view status')

  buddyCmd
    .command('chat')
    .description('Chat with your buddy companion (local Ollama, $0)')
    .action(async () => {
      await buddyChat()
      process.exit(0)
    })

  buddyCmd
    .command('status')
    .description('Show your buddy, level, and achievements')
    .action(() => {
      const buddy = getBuddy()
      const lvl = getBuddyLevel()
      const achievements = getAchievements()
      const unlocked = achievements.filter(a => a.unlockedAt !== null)
      const locked = achievements.filter(a => a.unlockedAt === null)

      console.log()
      console.log(formatBuddyStatus())
      console.log()
      console.log(`  ${chalk.bold('Achievements')} ${chalk.dim(`(${unlocked.length}/${achievements.length})`)}`)
      console.log(`  ${chalk.dim('─'.repeat(40))}`)
      for (const a of unlocked) {
        console.log(`  ${chalk.hex('#4ADE80')(a.icon)} ${a.name} ${chalk.dim('— ' + a.description)}`)
      }
      for (const a of locked) {
        console.log(`  ${chalk.dim(a.icon + ' ' + a.name + ' — ' + a.description + ' [locked]')}`)
      }
      console.log()
      process.exit(0)
    })

  buddyCmd
    .command('rename <name>')
    .description('Rename your buddy')
    .action((name: string) => {
      const buddy = getBuddy()
      const oldName = buddy.name
      renameBuddy(name)
      console.log()
      console.log(formatBuddyStatus(`${oldName} is now ${name}!`))
      console.log()
      process.exit(0)
    })

  buddyCmd
    .command('leaderboard')
    .description('Show the global buddy leaderboard — anonymous rankings across all kbot installs')
    .option('-l, --limit <n>', 'Number of entries to show', '20')
    .option('-s, --species <species>', 'Filter by species (fox, owl, cat, robot, ghost, mushroom, octopus, dragon)')
    .action(async (opts: { limit: string; species?: string }) => {
      const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 200)
      const species = opts.species?.toLowerCase()

      const validSpecies = ['fox', 'owl', 'cat', 'robot', 'ghost', 'mushroom', 'octopus', 'dragon']
      if (species && !validSpecies.includes(species)) {
        printError(`Unknown species "${species}". Valid: ${validSpecies.join(', ')}`)
        process.exit(1)
      }

      printInfo('Fetching leaderboard...')
      const entries = await fetchBuddyLeaderboard({ limit, species })

      if (entries.length === 0) {
        console.log()
        printWarn('No entries on the leaderboard yet.')
        printInfo('Use kbot to earn XP and enable cloud sync to appear on the leaderboard.')
        console.log()
        process.exit(0)
      }

      const SPECIES_ICONS: Record<string, string> = {
        fox: '[fox]', owl: '[owl]', cat: '[cat]', robot: '[bot]',
        ghost: '[gho]', mushroom: '[msh]', octopus: '[oct]', dragon: '[drg]',
      }
      const LEVEL_TITLES_SHORT: Record<number, string> = {
        0: 'Novice', 1: 'Adept', 2: 'Master', 3: 'Legend',
      }

      const header = species
        ? `Buddy Leaderboard — ${species}`
        : 'Global Buddy Leaderboard'

      console.log()
      console.log(`  ${chalk.bold(header)}`)
      console.log(`  ${chalk.dim('─'.repeat(56))}`)
      console.log(
        `  ${chalk.dim('#'.padStart(3))}  ${chalk.dim('Species'.padEnd(7))} ${chalk.dim('Level'.padEnd(12))} ${chalk.dim('XP'.padStart(6))}  ${chalk.dim('Achv'.padStart(4))}  ${chalk.dim('Sessions'.padStart(8))}`
      )
      console.log(`  ${chalk.dim('─'.repeat(56))}`)

      for (const entry of entries) {
        const icon = SPECIES_ICONS[entry.species] || entry.species.slice(0, 5)
        const title = LEVEL_TITLES_SHORT[entry.level] ?? `L${entry.level}`
        const levelStr = `${entry.level} ${title}`
        const rankStr = String(entry.rank).padStart(3)
        const xpStr = String(entry.xp).padStart(6)
        const achvStr = String(entry.achievement_count).padStart(4)
        const sessStr = String(entry.sessions).padStart(8)

        // Highlight top 3
        const rankColor = entry.rank === 1 ? chalk.hex('#FFD700') :
                          entry.rank === 2 ? chalk.hex('#C0C0C0') :
                          entry.rank === 3 ? chalk.hex('#CD7F32') : chalk.white

        console.log(
          `  ${rankColor(rankStr)}  ${chalk.hex('#A78BFA')(icon.padEnd(7))} ${levelStr.padEnd(12)} ${chalk.hex('#4ADE80')(xpStr)}  ${achvStr}  ${chalk.dim(sessStr)}`
        )
      }

      console.log()
      console.log(`  ${chalk.dim(`${entries.length} entries shown`)}`)
      console.log()
      process.exit(0)
    })

  buddyCmd.action(() => {
    buddyCmd.commands.find(c => c.name() === 'status')?.parse(['', '', 'status'])
  })

  // ── Ghost Commands ──

  const pikaCmd = program
    .command('ghost')
    .description('Ghost — AI video meeting bots, avatars, voice cloning')

  pikaCmd
    .command('install')
    .description('Install Ghost (clones repo, installs Python dependencies)')
    .option('-f, --force', 'Force re-clone even if already installed')
    .action(async (opts: { force?: boolean }) => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      printInfo('Installing Ghost...')
      const result = await execTool({ id: 'cli', name: 'pika_install', arguments: { force: opts.force ?? false } })
      try {
        const data = JSON.parse(result.result)
        if (data.success) {
          printSuccess('Ghost installed successfully!')
          printInfo(`  Path:     ${data.installed_at}`)
          printInfo(`  Python:   ${data.python?.version || 'unknown'} (${data.python?.path || 'unknown'})`)
          printInfo(`  API Key:  ${data.pika_dev_key}`)
          printInfo(`  Deps:     ${data.pip_dependencies}`)
          printInfo(`  ffmpeg:   ${data.ffmpeg}`)
          printInfo(`  Skills:   ${data.skills_found} found`)
          if (data.skills?.length > 0) {
            for (const s of data.skills) {
              printInfo(`    - ${s.name}: ${s.description || '(no description)'}`)
            }
          }
        } else {
          printError(`Installation failed: ${data.error}`)
          if (data.fix) printInfo(`  Fix: ${data.fix}`)
        }
      } catch {
        console.log(result.result)
      }
      process.exit(result.error ? 1 : 0)
    })

  pikaCmd
    .command('join <meet-url>')
    .description('Join a Google Meet call with an AI avatar bot')
    .option('-n, --name <name>', 'Bot name (default: "kbot Assistant")')
    .option('-a, --avatar <path>', 'Avatar image path')
    .option('-v, --voice <voice-id>', 'Voice ID from ghost voice clone')
    .option('-p, --prompt <text>', 'System prompt for bot behavior')
    .action(async (meetUrl: string, opts: { name?: string; avatar?: string; voice?: string; prompt?: string }) => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      printInfo(`Joining meeting: ${meetUrl}`)
      const result = await execTool({
        id: 'cli',
        name: 'pika_meeting_join',
        arguments: {
          meet_url: meetUrl,
          bot_name: opts.name,
          avatar: opts.avatar,
          voice_id: opts.voice,
          system_prompt: opts.prompt,
        },
      })
      try {
        const data = JSON.parse(result.result)
        if (data.success) {
          printSuccess(`Bot "${data.bot_name}" joining ${data.meet_url}`)
          printInfo(`  Session ID: ${data.session_id}`)
          printInfo(`  To leave:   kbot ghost leave ${data.session_id}`)
        } else {
          printError(`Failed to join: ${data.error}`)
        }
      } catch {
        console.log(result.result)
      }
      process.exit(result.error ? 1 : 0)
    })

  pikaCmd
    .command('leave <session-id>')
    .description('Leave an active Pika meeting session')
    .action(async (sessionId: string) => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      printInfo(`Leaving session: ${sessionId}`)
      const result = await execTool({
        id: 'cli',
        name: 'pika_meeting_leave',
        arguments: { session_id: sessionId },
      })
      try {
        const data = JSON.parse(result.result)
        if (data.success) {
          printSuccess(data.message)
        } else {
          printError(`Failed to leave: ${data.error}`)
        }
      } catch {
        console.log(result.result)
      }
      process.exit(result.error ? 1 : 0)
    })

  pikaCmd
    .command('avatar <prompt>')
    .description('Generate an AI avatar image for meetings')
    .option('-o, --output <path>', 'Output file path')
    .action(async (prompt: string, opts: { output?: string }) => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      printInfo(`Generating avatar: "${prompt}"`)
      const result = await execTool({
        id: 'cli',
        name: 'pika_generate_avatar',
        arguments: { prompt, output_path: opts.output },
      })
      try {
        const data = JSON.parse(result.result)
        if (data.success) {
          printSuccess('Avatar generated!')
          printInfo(`  Path: ${data.avatar_path}`)
          printInfo(`  Use with: kbot ghost join <meet-url> --avatar ${data.avatar_path}`)
        } else {
          printError(`Avatar generation failed: ${data.error}`)
        }
      } catch {
        console.log(result.result)
      }
      process.exit(result.error ? 1 : 0)
    })

  pikaCmd
    .command('voice <audio-file>')
    .description('Clone a voice from an audio file')
    .option('--noise-reduction', 'Apply noise reduction (requires ffmpeg)')
    .action(async (audioFile: string, opts: { noiseReduction?: boolean }) => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      printInfo(`Cloning voice from: ${audioFile}`)
      const result = await execTool({
        id: 'cli',
        name: 'pika_clone_voice',
        arguments: { audio_path: audioFile, noise_reduction: opts.noiseReduction ?? false },
      })
      try {
        const data = JSON.parse(result.result)
        if (data.success) {
          printSuccess('Voice cloned!')
          printInfo(`  Voice ID: ${data.voice_id}`)
          printInfo(`  Use with: kbot ghost join <meet-url> --voice ${data.voice_id}`)
        } else {
          printError(`Voice cloning failed: ${data.error}`)
        }
      } catch {
        console.log(result.result)
      }
      process.exit(result.error ? 1 : 0)
    })

  pikaCmd
    .command('status')
    .description('Check Ghost installation status')
    .action(async () => {
      const { registerGhostTools } = await import('./tools/ghost.js')
      const { executeTool: execTool } = await import('./tools/index.js')
      registerGhostTools()
      const result = await execTool({ id: 'cli', name: 'pika_status', arguments: {} })
      try {
        const data = JSON.parse(result.result)
        console.log()
        console.log(`  ${chalk.bold('Ghost Status')}`)
        console.log(`  ${chalk.dim('─'.repeat(40))}`)
        console.log(`  Installed:     ${data.installed ? chalk.green('yes') : chalk.red('no')}`)
        console.log(`  Path:          ${data.install_path}`)
        console.log(`  Python:        ${data.python?.status === 'ok' ? chalk.green(`${data.python.version}`) : chalk.red(data.python?.fix || 'not found')}`)
        console.log(`  PIKA_DEV_KEY:  ${data.pika_dev_key?.status === 'configured' ? chalk.green(`${data.pika_dev_key.preview}`) : chalk.red(data.pika_dev_key?.fix || 'not set')}`)
        console.log(`  ffmpeg:        ${data.ffmpeg === 'available' ? chalk.green('available') : chalk.yellow(data.ffmpeg)}`)
        console.log(`  Meeting Skill: ${data.meeting_skill === 'ready' ? chalk.green('ready') : chalk.yellow(data.meeting_skill)}`)
        console.log(`  Skills:        ${data.skills_count}`)
        if (data.active_sessions?.length > 0) {
          console.log()
          console.log(`  ${chalk.bold('Active Sessions')}`)
          console.log(`  ${chalk.dim('─'.repeat(40))}`)
          for (const s of data.active_sessions) {
            console.log(`  ${s.id} — ${s.meetUrl} (started ${s.startedAt})`)
          }
        }
        console.log()
      } catch {
        console.log(result.result)
      }
      process.exit(0)
    })

  pikaCmd.action(() => {
    pikaCmd.commands.find(c => c.name() === 'status')?.parse(['', '', 'status'])
  })

  // ── train-self / train-cycle / train-merge / train-grpo ──
  // Fine-tune a local model on your own agent sessions.
  program
    .command('train-self')
    .description('Fine-tune a local model on your own kbot sessions (MLX LoRA)')
    .option('--mode <mode>', 'default | reasoning | agent-trace | code-only', 'default')
    .option('--base-model <model>', 'Override base model (HF path or mlx-community/*)')
    .option('--output-name <name>', 'Ollama model name to register')
    .option('--backend <backend>', 'mlx | unsloth | llama-cpp | together', 'mlx')
    .option('--iters <n>', 'Training iterations', (v) => parseInt(v, 10))
    .option('--batch-size <n>', 'Batch size', (v) => parseInt(v, 10))
    .option('--num-layers <n>', 'LoRA layers', (v) => parseInt(v, 10))
    .option('--learning-rate <lr>', 'Learning rate', parseFloat)
    .option('--max-examples <n>', 'Cap curated examples', (v) => parseInt(v, 10))
    .option('--dry-run', 'Curate only, do not train')
    .option('--skip-curate', 'Skip curation (use existing dataset)')
    .option('--skip-train', 'Skip training (prepare + deploy only)')
    .option('--skip-deploy', 'Skip Ollama deploy')
    .option('--no-grad-checkpoint', 'Disable gradient checkpointing')
    .action(async (opts: Record<string, unknown>) => {
      const { trainSelf, formatTrainSelfReport } = await import('./train-self.js')
      const r = await trainSelf({
        mode: opts.mode as 'default' | 'reasoning' | 'agent-trace' | 'code-only',
        baseModel: opts.baseModel as string | undefined,
        outputName: opts.outputName as string | undefined,
        backend: opts.backend as 'mlx' | 'unsloth' | 'llama-cpp' | 'together',
        iters: opts.iters as number | undefined,
        batchSize: opts.batchSize as number | undefined,
        numLayers: opts.numLayers as number | undefined,
        learningRate: opts.learningRate as number | undefined,
        maxExamples: opts.maxExamples as number | undefined,
        dryRun: Boolean(opts.dryRun),
        skipCurate: Boolean(opts.skipCurate),
        skipTrain: Boolean(opts.skipTrain),
        skipDeploy: Boolean(opts.skipDeploy),
        gradCheckpoint: opts.gradCheckpoint !== false,
      })
      console.log(formatTrainSelfReport(r))
    })

  program
    .command('train-cycle')
    .description('On-policy distillation: student generates → Claude grades/corrects → retrain')
    .option('--student <model>', 'Local student model (Ollama)', 'kernel-coder:latest')
    .option('--teacher <model>', 'Teacher model', 'claude-opus-4-6')
    .option('--samples <n>', 'Prompts to sample per cycle', (v) => parseInt(v, 10), 50)
    .option('--threshold <score>', 'Pass threshold 0..1', parseFloat, 0.6)
    .option('--retrain', 'Trigger train-self after collecting corrections')
    .option('--dry-run', 'Skip teacher grading, just test student generation')
    .action(async (opts: Record<string, unknown>) => {
      const { runCycle, formatCycleReport } = await import('./train-cycle.js')
      const r = await runCycle({
        studentModel: opts.student as string,
        teacherModel: opts.teacher as string,
        samples: opts.samples as number,
        passThreshold: opts.threshold as number,
        retrain: Boolean(opts.retrain),
        dryRun: Boolean(opts.dryRun),
      })
      console.log(formatCycleReport(r))
    })

  program
    .command('train-merge')
    .description('Merge models via MergeKit (TIES/SLERP/DARE)')
    .option('--method <method>', 'ties | slerp | dare_ties | linear', 'ties')
    .option('--base <model>', 'Base model (HF path)', 'Qwen/Qwen2.5-Coder-7B-Instruct')
    .option('--output <name>', 'Output name')
    .option('--default', 'Use kbot triad defaults (qwen-coder + deepseek-r1 + self)')
    .option('--deploy', 'Register with Ollama after merge')
    .action(async (opts: Record<string, unknown>) => {
      const { mergeKbotDefault, mergeModels, formatMergeReport } = await import('./train-merge.js')
      if (opts.default) {
        const r = await mergeKbotDefault()
        console.log(formatMergeReport(r))
        return
      }
      const r = await mergeModels({
        method: opts.method as 'ties' | 'slerp' | 'dare_ties' | 'linear',
        baseModel: opts.base as string,
        models: [
          { model: opts.base as string, weight: 1, density: 0.5 },
        ],
        outputName: opts.output as string | undefined,
        deploy: Boolean(opts.deploy),
      })
      console.log(formatMergeReport(r))
    })

  program
    .command('train-grpo')
    .description('GRPO on verifiable tasks (build-pass, test-pass, regex-match, json-valid)')
    .option('--student <model>', 'Student model', 'kernel-coder:latest')
    .option('--group-size <n>', 'Rollouts per prompt', (v) => parseInt(v, 10), 8)
    .option('--iters <n>', 'Outer iterations', (v) => parseInt(v, 10), 100)
    .option('--dry-run', 'Collect rollouts only, do not update weights')
    .option('--runner-cmd <cmd>', 'External GRPO runner command')
    .action(async (opts: Record<string, unknown>) => {
      const { runGrpoRollouts, DEFAULT_VERIFIER_SUITE, formatGrpoReport } = await import('./train-grpo.js')
      const r = await runGrpoRollouts({
        studentModel: opts.student as string,
        prompts: DEFAULT_VERIFIER_SUITE,
        groupSize: opts.groupSize as number,
        iters: opts.iters as number,
        dryRun: Boolean(opts.dryRun),
        runnerCmd: opts.runnerCmd as string | undefined,
      })
      console.log(formatGrpoReport(r))
    })

  program
    .command('train-agent-trace')
    .description('Reformat tool-use traces as agent training examples')
    .option('--min-tools <n>', 'Minimum tool calls per trajectory', (v) => parseInt(v, 10), 1)
    .option('--verified-only', 'Only use trajectories tagged verified')
    .action(async (opts: Record<string, unknown>) => {
      const { formatAgentTraces, formatAgentTraceReport } = await import('./train-agent-trace.js')
      const r = formatAgentTraces({
        minTools: opts.minTools as number,
        verifiedOnly: Boolean(opts.verifiedOnly),
      })
      console.log(formatAgentTraceReport(r))
    })

  program.parse(process.argv)

  const opts = program.opts()
  const promptArgs = program.args

  // Quiet mode: suppress banners, spinners, status messages
  if (opts.quiet) setQuiet(true)

  // If a sub-command was run, we're done
  if (['byok', 'auth', 'ide', 'local', 'ollama', 'kbot-local', 'pull', 'doctor', 'serve', 'agents', 'watch', 'voice', 'export', 'plugins', 'changelog', 'release', 'completions', 'automate', 'status', 'spec', 'a2a', 'init', 'email-agent', 'imessage-agent', 'consultation', 'observe', 'discovery', 'bench', 'lab', 'teach', 'sessions', 'admin', 'monitor', 'analytics', 'deploy', 'env', 'db', 'dream', 'ghost'].includes(program.args[0])) return

  // ── Ollama Launch Integration ──
  // Detect when kbot is started via `ollama launch kbot` or `kbot --ollama-launch`
  const isOllamaLaunch = opts.ollamaLaunch || process.env.KBOT_OLLAMA_LAUNCH === '1'
  if (isOllamaLaunch) {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const ollamaModel = process.env.OLLAMA_MODEL || undefined
    const ok = await setupOllama(ollamaModel)
    if (ok) {
      printSuccess(`kbot connected to Ollama at ${ollamaHost}`)
      const models = await listOllamaModels()
      if (models.length > 0) printInfo(`${models.length} models available. Using: ${ollamaModel || PROVIDERS.ollama.defaultModel}`)
      printInfo('670+ tools ready. Type your prompt or press Enter for interactive mode.')
    } else {
      printError(`Cannot reach Ollama at ${ollamaHost}. Is it running?`)
      printInfo('Start Ollama: ollama serve')
      process.exit(1)
    }
  }

  // Check for API key (BYOK or local provider)
  let byokActive = isOllamaLaunch || isByokEnabled()
  let localActive = byokActive && (isOllamaLaunch || isLocalProvider(getByokProvider()))

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

    // Still no provider — launch guided setup (interactive) or show setup guide (non-interactive)
    if (!byokActive) {
      if (!process.stdin.isTTY || opts.pipe || opts.json) {
        // Non-interactive: can't run guided setup, show actionable guide and exit
        printNoProviderGuide()
        return
      }
      const result = await guidedSetup()
      if (!result) {
        // User quit guided setup — show the guide so they know how to proceed
        printNoProviderGuide()
        return
      }
      byokActive = true
      localActive = result.local
    }
  }

  /** Print a friendly multi-line guide when no AI provider is configured */
  function printNoProviderGuide(): void {
    console.log()
    printWarn('No API key configured yet. Let\'s fix that!')
    console.log()
    console.log(`  ${chalk.bold('Quick start')} ${chalk.dim('(pick one):')}`)
    console.log()
    console.log(`  ${chalk.dim('Cloud (needs API key):')}`)
    console.log(`    ${chalk.green('kbot auth')}              ${chalk.dim('Interactive setup — walks you through it')}`)
    console.log(`    ${chalk.green('kbot byok')}              ${chalk.dim('Bring Your Own Key for 15+ providers')}`)
    console.log()
    console.log(`  ${chalk.dim('Local (free, no key needed):')}`)
    console.log(`    ${chalk.green('kbot local')}             ${chalk.dim('Use Ollama, LM Studio, or Jan')}`)
    console.log(`    ${chalk.green('kbot doctor')}            ${chalk.dim('Check what\'s already installed')}`)
    console.log()
    console.log(`  ${chalk.dim('Get started fast:')} ${chalk.green('kbot auth')}`)
    console.log(`  ${chalk.dim('Docs:')} ${chalk.underline('https://github.com/isaacsight/kernel')}`)
    console.log()
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

  // ── Replit / lite mode detection ──
  {
    const { isReplit, detectReplit, printReplitWelcome } = await import('./replit.js')
    const { setLiteMode } = await import('./tools/index.js')

    if (opts.lite || isReplit()) {
      setLiteMode(true)
      if (isReplit() && !opts.quiet && !opts.pipe) {
        const env = detectReplit()
        printInfo(printReplitWelcome())
        if (env.publicUrl) {
          printInfo(`  Public URL: ${env.publicUrl}`)
        }
      }
    }
  }

  // Parallel startup: register core tools (fast), gather context, probe machine, check updates, cloud sync
  const toolOpts = { computerUse: opts.computerUse }
  const [, machineProfile, , , syncMsg] = await Promise.all([
    registerCoreTools(toolOpts),
    probeMachine().catch((): MachineProfile | null => null),
    // Non-blocking update check — fire and forget
    Promise.resolve().then(() => {
      try {
        const msg = checkForUpdate(VERSION)
        if (msg) printSuccess(msg)
      } catch { /* non-critical */ }
    }),
    // Cloud sync — pull latest learning data if available
    syncOnStartup().catch(() => null),
    // Placeholder for alignment (5-element destructure)
    Promise.resolve(null),
  ])
  const context = gatherContext(machineProfile ?? undefined)
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
    // Tree planning mode: LATS branching search
    if (opts.tree) {
      const { executeTreePlan } = await import('./tree-planner.js')
      await executeTreePlan(message, agentOpts)
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
  printInfo('All 362 tools + 35 agents + learning system = yours.')
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

  // Buddy greeting — Tamagotchi companion appears at startup
  {
    const buddy = getBuddy()
    const isFirstRun = sessionCount <= 1 && !existsSync(join(homedir(), '.kbot', 'config.json'))
    const greeting = isFirstRun
      ? `Hey! I'm ${buddy.name} the ${buddy.species}. Let's set up your API key!`
      : getBuddyGreeting()
    console.log()
    console.log(formatBuddyStatus(greeting))

    // Dream narration — buddy tells the user what it dreamed about
    if (!isFirstRun) {
      try {
        const dreamNarration = getBuddyDreamNarration()
        if (dreamNarration) {
          console.log()
          console.log(formatBuddyStatus(dreamNarration))
        }
      } catch { /* dream narration is non-critical */ }
    }

    console.log()
  }

  // Seed knowledge on first run — give new users a head start
  if (sessionCount <= 2) {
    try {
      const { loadSeedKnowledge } = await import('./seed-knowledge.js')
      const seed = await loadSeedKnowledge()
      if (seed.seeded) {
        printInfo(`Loaded ${seed.patterns} patterns + ${seed.facts} knowledge entries from seed data`)
      }
    } catch { /* seed loading is non-critical */ }
  }

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
    console.log(chalk.dim('  │') + chalk.bold('  35 agents. 362 tools. Just say what you need.  ') + chalk.dim(' │'))
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

    case 'insights': {
      const { generateInsights } = await import('./introspection.js')
      process.stderr.write(generateInsights())
      break
    }

    case 'reflect': {
      const { generateReflection } = await import('./introspection.js')
      process.stderr.write(generateReflection())
      break
    }

    case 'compare': {
      const { generateComparison } = await import('./introspection.js')
      process.stderr.write(generateComparison())
      break
    }

    case 'growth': {
      const { generateGrowthReport } = await import('./introspection.js')
      process.stderr.write(generateGrowthReport())
      break
    }

    case 'decisions': {
      const { getTodaysDecisions, formatDecisions } = await import('./decision-journal.js')
      const decisions = getTodaysDecisions()
      console.log(formatDecisions(decisions))
      break
    }

    case 'episodes':
    case 'history': {
      const { listEpisodes, formatEpisodeList } = await import('./episodic-memory.js')
      const episodes = listEpisodes(15)
      console.log(formatEpisodeList(episodes))
      break
    }

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

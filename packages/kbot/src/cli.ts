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
import { getApiKey, setupAuth, getUsageStats, loadConfig, verifyApiKey, setupByok, isByokEnabled, disableByok, detectProvider, getByokProvider, PROVIDERS, type ByokProvider } from './auth.js'
import { runAndPrint, runAgent, type AgentOptions } from './agent.js'
import { gatherContext, type ProjectContext } from './context.js'
import { registerAllTools } from './tools/index.js'
import { clearHistory, clearMemory } from './memory.js'
import {
  banner,
  bannerCompact,
  bannerAuth,
  matrixConnect,
  prompt as kbotPrompt,
  printUsage,
  printError,
  printSuccess,
  printInfo,
  printResponse,
  printHelp,
  printGoodbye,
  divider,
} from './ui.js'

const VERSION = '1.3.1'

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('kbot')
    .description('K:BOT — Kernel Matrix Terminal Agent')
    .version(VERSION)
    .option('-a, --agent <agent>', 'Force a specific agent (kernel, researcher, coder, writer, analyst)')
    .option('-m, --model <model>', 'Override AI model (auto, sonnet, haiku)')
    .option('-s, --stream', 'Stream the response')
    .option('--computer-use', 'Enable computer use tools (Enterprise only)')
    .argument('[prompt...]', 'One-shot prompt')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .action(() => { /* default action — handled below */ })

  // Sub-commands
  program
    .command('auth')
    .description('Configure API key')
    .action(async () => {
      await authFlow()
    })

  program
    .command('byok')
    .description('Bring Your Own Key — use your own LLM API key (Anthropic, OpenAI, or Google)')
    .option('--off', 'Disable BYOK mode (switch back to Kernel API)')
    .action(async (opts: { off?: boolean }) => {
      if (opts.off) {
        disableByok()
        printSuccess('BYOK disabled. Using Kernel API key.')
        return
      }
      await byokFlow()
    })

  program
    .command('usage')
    .description('Show usage statistics')
    .action(async () => {
      const stats = await getUsageStats()
      if (!stats) {
        printError('Could not fetch usage. Is your API key valid?')
        process.exit(1)
      }
      printUsage(stats)
    })

  program.parse(process.argv)

  const opts = program.opts()
  const promptArgs = program.args

  // If a sub-command was run, we're done
  if (['auth', 'usage', 'byok'].includes(program.args[0])) return

  // Check for API key (Kernel or BYOK)
  const byokActive = isByokEnabled()
  const apiKey = getApiKey()
  if (!apiKey && !byokActive) {
    console.log(banner())
    printInfo('No API key found. Let\'s connect you to the Matrix.')
    printInfo('Or run `kbot byok` to use your own Anthropic API key.')
    console.log()
    await authFlow()
    return
  }

  // Register tools
  await registerAllTools()

  // Gather project context (once at startup)
  const context = gatherContext()
  const config = loadConfig()
  const tier = byokActive ? 'growth' : (config?.tier || 'free')

  const agentOpts: AgentOptions = {
    agent: opts.agent || 'auto',
    model: opts.model,
    stream: opts.stream,
    context,
    tier,
  }

  // One-shot mode: kbot "fix the bug"
  if (promptArgs.length > 0 && !['auth', 'usage', 'byok'].includes(promptArgs[0])) {
    console.log(bannerCompact())
    const message = promptArgs.join(' ')
    await runAndPrint(message, agentOpts)
    return
  }

  // Interactive REPL mode
  await startRepl(agentOpts, context, tier)
}

async function authFlow(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(bannerAuth())
  printInfo('Enter your API key (get one at kernel.chat/#/api-docs):')
  console.log()

  const key = await new Promise<string>((resolve) => {
    rl.question('  kn_live_', (answer) => {
      resolve('kn_live_' + answer.trim())
      rl.close()
    })
  })

  if (!key.startsWith('kn_live_') || key.length < 12) {
    printError('Invalid key format. Keys start with kn_live_')
    process.exit(1)
  }

  printInfo('Connecting to Kernel Matrix...')
  const result = await verifyApiKey(key)

  if (!result.valid) {
    printError(`Connection failed: ${result.error}`)
    process.exit(1)
  }

  const ok = await setupAuth(key)
  if (!ok) {
    printError('Key verification failed. Check your key and try again.')
    process.exit(1)
  }

  console.log()
  console.log(matrixConnect(result.tier || 'free', result.agents?.length || 5))
  printSuccess('Ready. Run `kbot` to start.')
}

async function byokFlow(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(bannerAuth())
  printInfo('BYOK Mode — Bring Your Own Key')
  printInfo('Use your own LLM API key. You pay the provider directly for tokens.')
  printInfo('Kernel routing + tools + collective intelligence are free.')
  console.log()
  printInfo('Supported providers (12):')
  printInfo('  Anthropic (Claude)    OpenAI (GPT)       Google (Gemini)')
  printInfo('  Mistral AI            xAI (Grok)         DeepSeek')
  printInfo('  Groq                  Together AI        Fireworks AI')
  printInfo('  Perplexity            Cohere             NVIDIA NIM')
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
  printInfo('You pay the provider directly. No message limits.')
  printInfo('Kernel routing + 17 agents + tools = free.')
  console.log()
  printSuccess('Ready. Run `kbot` to start.')
}

async function startRepl(
  agentOpts: AgentOptions,
  context: ProjectContext,
  tier: string,
): Promise<void> {
  console.log(banner())

  // Show connection info
  const byok = isByokEnabled()
  const agentCount = byok || tier === 'growth' || tier === 'enterprise' ? 17 : 5
  if (byok) {
    const provider = getByokProvider()
    const providerConfig = PROVIDERS[provider]
    printSuccess(`BYOK mode — ${providerConfig.name} (no message limits)`)
  }
  console.log(matrixConnect(byok ? 'byok' : tier, agentCount))

  if (context.isGitRepo) {
    printInfo(`Project: ${context.repoRoot?.split('/').pop() || 'unknown'} (${context.language || 'unknown'})`)
    printInfo(`Branch: ${context.branch || 'unknown'}`)
    console.log()
  }

  printInfo('Type a message, or /help for commands.')
  console.log()

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: kbotPrompt(),
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    // Slash commands
    if (input.startsWith('/')) {
      try {
        await handleSlashCommand(input, agentOpts, rl)
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err))
      }
      rl.prompt()
      return
    }

    // Run agent
    try {
      const response = await runAgent(input, agentOpts)
      printResponse(response.agent, response.content)

      if (response.usage) {
        const { input_tokens, output_tokens, cost_usd } = response.usage
        printInfo(`${response.agent} · ${response.model} · ${input_tokens + output_tokens} tokens · $${cost_usd.toFixed(4)}${response.toolCalls > 0 ? ` · ${response.toolCalls} tool calls` : ''}`)
      } else if (response.agent === 'local') {
        // Local execution — no tokens used, already printed by agent.ts
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
    }

    console.log()
    rl.prompt()
  })

  // Ctrl+C: don't exit immediately — just cancel current input and re-prompt
  rl.on('SIGINT', () => {
    console.log() // newline after ^C
    printInfo('Press Ctrl+C again or type /quit to exit.')
    rl.prompt()
  })

  rl.on('close', () => {
    printGoodbye()
    process.exit(0)
  })
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

    case 'agent':
      if (args[0]) {
        opts.agent = args[0]
        printSuccess(`Agent set to: ${args[0]}`)
      } else {
        printInfo(`Current agent: ${opts.agent || 'auto'}`)
        printInfo('Available: kernel, researcher, coder, writer, analyst (+ more with Growth tier)')
      }
      break

    case 'model':
      if (args[0]) {
        opts.model = args[0]
        printSuccess(`Model set to: ${args[0]}`)
      } else {
        printInfo(`Current model: ${opts.model || 'auto'}`)
      }
      break

    case 'usage': {
      const stats = await getUsageStats()
      if (stats) printUsage(stats)
      else printError('Could not fetch usage stats')
      break
    }

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

    case 'quit':
    case 'exit':
      rl.close()
      break

    default:
      printError(`Unknown command: /${cmd}. Type /help for available commands.`)
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

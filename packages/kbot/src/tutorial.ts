// K:BOT Interactive Tutorial — Step-by-step walkthrough for new users
//
// Triggered by /tutorial in the REPL. Walks through 6 steps covering
// the key features of kbot: asking questions, specialists, tools,
// saving work, local mode, and power features.

import { createInterface } from 'node:readline'
import chalk from 'chalk'
import { printInfo, printSuccess, status, divider } from './ui.js'

// ── Color palette (matches ui.ts) ──
const ACCENT = chalk.hex('#A78BFA')   // soft violet
const GREEN = chalk.hex('#4ADE80')    // success
const CYAN = chalk.hex('#67E8F9')     // code/paths
const DIM = chalk.dim                 // secondary text

// ── Types ──

interface TutorialStep {
  title: string
  body: string[]
  example: string
  tip?: string
}

// ── Steps ──

const STEPS: TutorialStep[] = [
  {
    title: 'Ask kbot anything',
    body: [
      'kbot works two ways:',
      '',
      `  ${chalk.bold('One-shot')} — Run a single command from your terminal:`,
      `  ${CYAN('$ kbot "explain what this project does"')}`,
      '',
      `  ${chalk.bold('Interactive')} — Start a conversation (what you\'re doing now):`,
      `  ${CYAN('$ kbot')}`,
      `  Then just type your question and press Enter.`,
      '',
      'kbot reads your project files, understands context, and gives',
      'answers tailored to whatever you\'re working on.',
    ],
    example: 'what files are in this directory?',
    tip: 'You can pipe output too: kbot "list all functions" | grep async',
  },
  {
    title: 'Meet the specialists',
    body: [
      'kbot has 23 specialist agents. Each one is an expert in a',
      'different area. You don\'t need to pick one — kbot routes your',
      'message to the right specialist automatically.',
      '',
      `  ${chalk.hex('#4ADE80')('coder')}           Write, fix, and explain code`,
      `  ${chalk.hex('#60A5FA')('researcher')}      Find information and explain topics`,
      `  ${chalk.hex('#FB923C')('writer')}          Draft emails, docs, blog posts`,
      `  ${chalk.hex('#F472B6')('analyst')}         Break down data and strategy`,
      `  ${chalk.hex('#8B4513')('guardian')}        Review code for security issues`,
      `  ${chalk.hex('#DAA520')('strategist')}      Business strategy and planning`,
      `  ${chalk.hex('#38BDF8')('infrastructure')}  DevOps, servers, and deployment`,
      `  ${ACCENT('kernel')}          General questions, anything else`,
      `  ${DIM('...and 14 more specialists')}`,
      '',
      'To force a specific agent, use the /agent command:',
      `  ${CYAN('/agent researcher')}`,
    ],
    example: '/agent',
    tip: 'kbot learns which agents you use most and routes faster over time.',
  },
  {
    title: 'Use tools',
    body: [
      'kbot doesn\'t just talk — it can take action. It has 223 built-in',
      'tools for working with your files and system:',
      '',
      `  ${chalk.bold('Files')}     Read, write, search, and edit files`,
      `  ${chalk.bold('Terminal')}  Run shell commands (with safety checks)`,
      `  ${chalk.bold('Git')}       Commit, diff, branch, and manage repos`,
      `  ${chalk.bold('GitHub')}    Create issues, PRs, review code`,
      `  ${chalk.bold('Search')}    Look things up on the web`,
      `  ${chalk.bold('Browser')}   Open and interact with web pages`,
      '',
      'Just describe what you want. kbot picks the right tools:',
      `  ${CYAN('"find all TODO comments in this project"')}`,
      `  ${CYAN('"create a .gitignore for a Node.js project"')}`,
    ],
    example: 'list all files in this directory sorted by size',
    tip: 'kbot asks for confirmation before running anything destructive.',
  },
  {
    title: 'Save your work',
    body: [
      'Every conversation can be saved and picked up later.',
      '',
      `  ${chalk.white('/save')} ${DIM('[name]')}       Save this conversation`,
      `  ${chalk.white('/resume')} ${DIM('<id>')}       Load a saved conversation`,
      `  ${chalk.white('/sessions')}           List all saved conversations`,
      '',
      'You can also teach kbot facts it will remember forever:',
      `  ${CYAN('/remember I prefer TypeScript over JavaScript')}`,
      `  ${CYAN('/remember Our API base URL is https://api.example.com')}`,
      '',
      'kbot also learns automatically — it picks up patterns from',
      'how you work and gets better over time.',
    ],
    example: '/remember This is my first time using kbot',
    tip: 'Use /compact to compress long conversations and save tokens.',
  },
  {
    title: 'Go local',
    body: [
      'kbot can run entirely on your machine — no API key needed,',
      'no data leaves your computer. Great for private work.',
      '',
      `  ${chalk.bold('Ollama')} ${DIM('(recommended)')}`,
      `  ${CYAN('$ kbot local')}           Start with a local model`,
      `  ${CYAN('$ kbot local llama3')}    Use a specific model`,
      `  ${CYAN('/ollama')}                Switch to local in a conversation`,
      '',
      `  ${chalk.bold('K:BOT Local')} ${DIM('(built-in)')}`,
      `  ${CYAN('$ kbot kbot-local')}      Use the built-in local engine`,
      '',
      'Local models are free and private. They\'re great for simple',
      'tasks. For complex work, cloud models are more capable.',
    ],
    example: '/ollama',
    tip: 'First run downloads the model (~4GB). After that, it starts instantly.',
  },
  {
    title: 'Power features',
    body: [
      'Once you\'re comfortable, try these advanced features:',
      '',
      `  ${chalk.white('/plan')} ${DIM('<task>')}       Let kbot plan and execute multi-step tasks`,
      `  ${DIM('  "Plan: refactor the auth module into smaller files"')}`,
      '',
      `  ${chalk.white('/matrix')}             Create your own custom agents`,
      `  ${DIM('  Build an agent that knows your codebase inside out')}`,
      '',
      `  ${chalk.white('/worktree')}           Work in an isolated git branch`,
      `  ${DIM('  Experiment without affecting your main branch')}`,
      '',
      `  ${chalk.white('/mimic')} ${DIM('<style>')}     Code like a specific tool`,
      `  ${DIM('  /mimic claude-code, /mimic cursor, /mimic copilot')}`,
      '',
      `  ${chalk.white('/thinking')}           See how kbot reasons through problems`,
    ],
    example: '/help',
    tip: 'Type /help anytime to see all available commands.',
  },
]

// ── Wait for user input ──

function waitForInput(
  rl: ReturnType<typeof createInterface>,
  promptText: string,
): Promise<string> {
  return new Promise<string>((resolve) => {
    rl.question(promptText, (answer) => resolve(answer.trim()))
  })
}

// ── Render a single step ──

function renderStep(step: TutorialStep, index: number, total: number): void {
  const stepLabel = `Step ${index + 1} of ${total}`

  status()
  divider()
  status()
  status(`  ${ACCENT(stepLabel)}  ${chalk.bold(step.title)}`)
  status()

  for (const line of step.body) {
    status(`  ${line}`)
  }

  status()
  status(`  ${GREEN('Try it:')} ${CYAN(step.example)}`)

  if (step.tip) {
    status(`  ${DIM(`Tip: ${step.tip}`)}`)
  }

  status()
}

// ── Main tutorial runner ──

export async function runTutorial(
  rl: ReturnType<typeof createInterface>,
): Promise<void> {
  status()
  status(`  ${ACCENT('K:BOT Tutorial')}`)
  status(`  ${DIM('A quick tour of what kbot can do. Takes about 3 minutes.')}`)
  status()
  status(`  ${DIM('Press Enter to go to the next step.')}`)
  status(`  ${DIM('Type q to quit anytime.')}`)

  for (let i = 0; i < STEPS.length; i++) {
    renderStep(STEPS[i], i, STEPS.length)

    const promptText = i < STEPS.length - 1
      ? `  ${DIM('[Enter → next step, q → quit]')} `
      : `  ${DIM('[Enter → finish]')} `

    const input = await waitForInput(rl, promptText)

    if (input.toLowerCase() === 'q') {
      status()
      printInfo('Tutorial ended. Type /help to see all commands.')
      status()
      return
    }
  }

  // Finish
  status()
  divider()
  status()
  printSuccess('Tutorial complete!')
  status()
  status(`  ${chalk.bold('You\'re ready to go.')} Here\'s what to do next:`)
  status()
  status(`  ${DIM('•')} Just type a question or task to get started`)
  status(`  ${DIM('•')} Type ${CYAN('/help')} to see all commands`)
  status(`  ${DIM('•')} Type ${CYAN('/save')} to save your work before you leave`)
  status()
  printInfo('The more you use kbot, the smarter it gets. Have fun!')
  status()
}

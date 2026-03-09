#!/usr/bin/env npx tsx
// Thread Generator — Turns an AI news story into a 5-7 tweet thread
//
// Usage:
//   npx tsx tools/thread-gen.ts --from-bot         # Thread from top news story
//   echo '{"headline":"..."}' | npx tsx tools/thread-gen.ts   # From stdin
//   npx tsx tools/thread-gen.ts --topic "GPT-5 just dropped"  # From topic string
//
// Tries OpenClaw (local) first, falls back to template-based generation

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Story {
  headline: string
  source_url?: string
  category?: string
}

// --- Try OpenClaw for smart generation ---
async function generateWithOpenClaw(story: Story): Promise<string[] | null> {
  try {
    const prompt = `Write a Twitter/X thread (5 tweets) about this AI news story. Each tweet max 280 chars. Number them 1/5, 2/5, etc.

Story: ${story.headline}
Category: ${story.category ?? 'AI news'}

Thread structure:
- Tweet 1: Hook — attention-grabbing take on the news
- Tweet 2: Context — why this matters
- Tweet 3: Analysis — what most people are missing
- Tweet 4: Implication — what this means for developers
- Tweet 5: CTA — "Follow @kbot_ai for daily AI signal"

Voice: confident, informed, slightly contrarian. No emoji. Like a senior engineer's Twitter.
${story.source_url ? `\nSource: ${story.source_url}` : ''}

Output ONLY the 5 tweets, separated by ---`

    const res = await fetch('http://127.0.0.1:18789/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1',
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return null
    const data = await res.json() as { response: string }
    const tweets = data.response
      .split(/---|\n\n/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 10 && t.length <= 280)

    return tweets.length >= 4 ? tweets.slice(0, 7) : null
  } catch {
    return null
  }
}

// --- Try Ollama directly ---
async function generateWithOllama(story: Story): Promise<string[] | null> {
  try {
    const prompt = `Write 5 short tweets about: "${story.headline}". Number each 1/5 to 5/5. Max 280 chars each. Separate with ---. Be opinionated, no emoji.`

    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: [
          { role: 'system', content: 'You are a viral AI news Twitter account. Write punchy, opinionated tweet threads. No emoji. Max 280 chars per tweet.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(90_000),
    })

    if (!res.ok) return null
    const data = await res.json() as { message: { content: string } }
    const responseText = data.message.content
    const tweets = responseText
      .split(/---|\n\n/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 10 && t.length <= 280)

    return tweets.length >= 3 ? tweets.slice(0, 7) : null
  } catch (e) {
    console.error('Ollama error:', e instanceof Error ? e.message : e)
    return null
  }
}

// --- Template fallback ---
function generateFromTemplate(story: Story): string[] {
  const h = story.headline
  const url = story.source_url ?? ''
  const cat = story.category ?? 'tools'

  const hooks: Record<string, string> = {
    model_release: 'just dropped and the benchmarks are interesting.',
    open_source: '— and it\'s open source.',
    research: '— this paper is worth reading.',
    funding: '— follow the money.',
    regulation: '— this affects every builder.',
    drama: '— here we go again.',
    tools: '— worth paying attention to.',
  }

  const hook = hooks[cat] ?? '— worth paying attention to.'

  const tweets = [
    // 1: Hook
    `1/5 ${h.slice(0, 230)} ${hook}`.slice(0, 280),
    // 2: Context
    `2/5 Here's why this matters: the AI landscape is shifting faster than most people realize. Every week brings a new model, a new benchmark, a new reason to rethink your stack.`,
    // 3: Analysis
    `3/5 What most people are missing: the gap between open-source and proprietary AI is closing. Fast. The models you can run locally today would have been state-of-the-art 12 months ago.`,
    // 4: Implication
    `4/5 For developers: build the abstraction layer now. Support multiple providers. Don't lock yourself into one API. The best model today won't be the best model in 6 months.`,
    // 5: CTA
    `5/5 I cover AI news daily from a builder's perspective. Follow @kbot_ai for the signal without the hype.${url ? `\n\nSource: ${url}` : ''}`.slice(0, 280),
  ]

  return tweets
}

// --- Get story from news bot ---
async function getTopStory(): Promise<Story> {
  const cwd = join(__dirname, '..')
  const output = execSync('npx tsx tools/ai-news-bot.ts 2>/dev/null', {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    shell: '/bin/zsh',
  })
  const stories = JSON.parse(output)
  if (!stories.length) throw new Error('No stories found')
  return {
    headline: stories[0].headline,
    source_url: stories[0].source_url,
    category: stories[0].category,
  }
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2)
  let story: Story

  if (args.includes('--from-bot')) {
    console.error('Fetching top AI story...')
    story = await getTopStory()
  } else if (args.includes('--topic')) {
    const idx = args.indexOf('--topic') + 1
    story = { headline: args.slice(idx).join(' ') }
  } else {
    // Try reading from stdin
    const chunks: Buffer[] = []
    if (!process.stdin.isTTY) {
      for await (const chunk of process.stdin) chunks.push(chunk)
      const input = Buffer.concat(chunks).toString().trim()
      try {
        story = JSON.parse(input)
      } catch {
        story = { headline: input }
      }
    } else {
      console.error('Usage:')
      console.error('  npx tsx tools/thread-gen.ts --from-bot')
      console.error('  npx tsx tools/thread-gen.ts --topic "GPT-5 launched"')
      console.error('  echo \'{"headline":"..."}\' | npx tsx tools/thread-gen.ts')
      process.exit(1)
    }
  }

  console.error(`Story: ${story.headline}\n`)

  // Try OpenClaw → Ollama → Template
  console.error('Trying OpenClaw...')
  let tweets = await generateWithOpenClaw(story)

  if (!tweets) {
    console.error('OpenClaw unavailable. Trying Ollama...')
    tweets = await generateWithOllama(story)
  }

  if (!tweets) {
    console.error('Ollama unavailable. Using template fallback.')
    tweets = generateFromTemplate(story)
  }

  console.error(`\nGenerated ${tweets.length}-tweet thread:\n`)

  tweets.forEach((tweet, i) => {
    console.log(tweet)
    if (i < tweets.length - 1) console.log('')
  })

  // Also output as JSON for piping
  if (args.includes('--json')) {
    process.stdout.write('\n' + JSON.stringify(tweets, null, 2))
  }
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})

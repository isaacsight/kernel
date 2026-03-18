#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  kbot Social Media Agent — Autonomous posting about kbot
//  Run: npx tsx tools/kbot-social-agent.ts [--platform x|linkedin|all] [--dry-run]
//
//  Posts about kbot releases, tips, tool spotlights, and milestones
//  to X (Twitter) and LinkedIn. Content is generated from the actual
//  codebase — not generic marketing copy.
//
//  Env vars needed:
//    X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (for X)
//    LINKEDIN_ACCESS_TOKEN (for LinkedIn, optional)
// ─────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { createHash, createHmac, randomBytes } from 'crypto'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const PROJECT_ROOT = resolve(__dirname, '..')

// ─── X (Twitter) API ────────────────────────────────────────

const X_API_KEY = process.env.X_API_KEY ?? ''
const X_API_SECRET = process.env.X_API_SECRET ?? ''
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN ?? ''
const X_ACCESS_SECRET = process.env.X_ACCESS_SECRET ?? ''
const TWEET_URL = 'https://api.twitter.com/2/tweets'

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function buildOAuthHeader(method: string, url: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  }
  const sortedParams = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(sortedParams)].join('&')
  const signingKey = `${percentEncode(X_API_SECRET)}&${percentEncode(X_ACCESS_SECRET)}`
  params.oauth_signature = createHmac('sha1', signingKey).update(baseString).digest('base64')
  return `OAuth ${Object.keys(params).sort().map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`).join(', ')}`
}

async function postTweet(text: string): Promise<{ id: string; text: string }> {
  const res = await fetch(TWEET_URL, {
    method: 'POST',
    headers: { Authorization: buildOAuthHeader('POST', TWEET_URL), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`)
  return (await res.json() as { data: { id: string; text: string } }).data
}

async function postThread(tweets: string[]): Promise<string[]> {
  const ids: string[] = []
  let replyTo: string | undefined
  for (const tweet of tweets) {
    const body: Record<string, unknown> = { text: tweet }
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo }
    const res = await fetch(TWEET_URL, {
      method: 'POST',
      headers: { Authorization: buildOAuthHeader('POST', TWEET_URL), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`)
    const data = (await res.json() as { data: { id: string } }).data
    ids.push(data.id)
    replyTo = data.id
    await new Promise(r => setTimeout(r, 1000)) // rate limit safety
  }
  return ids
}

// ─── LinkedIn API ───────────────────────────────────────────

const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN ?? ''
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID ?? ''

async function postLinkedIn(text: string): Promise<string> {
  if (!LINKEDIN_TOKEN || !LINKEDIN_PERSON_ID) throw new Error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_ID not set')
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LINKEDIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      author: `urn:li:person:${LINKEDIN_PERSON_ID}`,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!res.ok) throw new Error(`LinkedIn API ${res.status}: ${await res.text()}`)
  return (await res.json() as { id: string }).id
}

// ─── Data Extractors ────────────────────────────────────────

function getVersion(): string {
  return JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'packages/kbot/package.json'), 'utf-8')).version
}

function getToolCount(): number {
  const dir = resolve(PROJECT_ROOT, 'packages/kbot/src/tools')
  let count = 0
  for (const f of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('test'))) {
    const content = readFileSync(resolve(dir, f), 'utf-8')
    count += (content.match(/registerTool\(\{/g) || []).length
  }
  return count
}

function getToolNames(): string[] {
  const dir = resolve(PROJECT_ROOT, 'packages/kbot/src/tools')
  const names: string[] = []
  for (const f of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('test'))) {
    const content = readFileSync(resolve(dir, f), 'utf-8')
    for (const m of content.matchAll(/registerTool\(\{\s*name:\s*'([^']+)'/g)) names.push(m[1])
  }
  return names
}

function getRecentCommits(n = 5): string[] {
  try {
    return execSync(`git -C "${PROJECT_ROOT}" log --oneline -${n}`, { encoding: 'utf-8' }).trim().split('\n')
  } catch { return [] }
}

function getDownloads(): number {
  try {
    const res = execSync(`curl -s "https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot"`, { encoding: 'utf-8' })
    return JSON.parse(res).downloads || 0
  } catch { return 0 }
}

// ─── State ──────────────────────────────────────────────────

const STATE_PATH = resolve(__dirname, 'daemon-reports', 'social-agent-state.json')

interface SocialState {
  lastPosted: Record<string, string>
  rotationIndex: Record<string, number>
  postedHashes: string[]
  lastVersion: string
  stats: { tweets: number; linkedin: number; threads: number }
}

function loadState(): SocialState {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
  return { lastPosted: {}, rotationIndex: {}, postedHashes: [], lastVersion: '', stats: { tweets: 0, linkedin: 0, threads: 0 } }
}

function saveState(state: SocialState) { writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)) }

function isDuplicate(state: SocialState, text: string): boolean {
  const hash = createHash('md5').update(text.slice(0, 100)).digest('hex')
  return state.postedHashes.includes(hash)
}

function recordPost(state: SocialState, text: string, platform: string) {
  const hash = createHash('md5').update(text.slice(0, 100)).digest('hex')
  state.postedHashes.push(hash)
  if (state.postedHashes.length > 500) state.postedHashes = state.postedHashes.slice(-500)
  state.lastPosted[platform] = new Date().toISOString()
}

function nextIndex(state: SocialState, bank: string, size: number): number {
  const idx = state.rotationIndex[bank] || 0
  state.rotationIndex[bank] = (idx + 1) % size
  return idx
}

// ─── Content Banks ──────────────────────────────────────────

const TWEETS = [
  () => `kbot v${getVersion()} — ${getToolCount()} tools, 22 agents, 20 providers.\n\nWorks on first run. No API key needed.\n\nnpm i -g @kernel.chat/kbot`,
  () => `Your terminal is smarter than your IDE.\n\nkbot has ${getToolCount()} tools built in — git, deploy, database, game dev, web search, research papers.\n\nOne install: npm i -g @kernel.chat/kbot`,
  () => `kbot learns your coding patterns.\n\nNot "remembers your chat." Actually extracts patterns and gets faster over time.\n\nBayesian skill ratings. 22 specialist agents.\n\nnpm i -g @kernel.chat/kbot`,
  () => `20 AI providers. Zero lock-in.\n\nClaude today. GPT tomorrow. Ollama on the airplane.\n\nkbot lets you switch with one command.\n\nnpm i -g @kernel.chat/kbot`,
  () => `Zero-config AI in your terminal:\n\nnpm i -g @kernel.chat/kbot\nkbot "hello"\n\nThat's it. No API key. No setup. Works instantly.`,
  () => `I built a terminal AI agent with ${getToolCount()} tools that runs offline.\n\nEmbedded llama.cpp. No Ollama needed. $0. Fully private.\n\nnpm i -g @kernel.chat/kbot`,
  () => `kbot has 16 game dev tools for 8 engines:\n\nGodot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold\n\nScaffolding, shaders, physics, ECS, netcode, particles.\n\nnpm i -g @kernel.chat/kbot`,
  () => `The cheapest way to use AI in your terminal:\n\n$0.00 — kbot embedded/Ollama\n$0.27/M — DeepSeek\n$0.59/M — Groq\n$0.60/M — Cerebras\n\n20 providers, your choice.\n\nnpm i -g @kernel.chat/kbot`,
  () => { const tools = getToolNames(); const t = tools[Math.floor(Math.random() * tools.length)]; return `kbot tool of the day: \`${t}\`\n\nOne of ${tools.length} built-in tools. All free. All open source.\n\nnpm i -g @kernel.chat/kbot` },
  () => `kbot can be your MCP server.\n\nAdd to Claude Code, Cursor, VS Code, Zed:\n\n{"kbot": {"command": "kbot", "args": ["ide", "mcp"]}}\n\n${getToolCount()} tools in your editor.`,
  () => `git diff | kbot "review this"\ncat error.log | kbot "what happened?"\ncurl api.com | kbot "parse this"\n\nPipe anything into kbot. It just works.`,
  () => `kbot audit scores any GitHub repo:\n\nkbot audit vercel/next.js\n\nSecurity, docs, quality, community, devops, health.\nGrade A-F per category.\n\nOpen source, MIT.`,
  () => `Most AI coding tools forget you between sessions.\n\nkbot doesn't.\n\nIt extracts patterns, learns your preferences, routes tasks faster over time.\n\n73 solutions accumulated. Getting smarter.`,
  () => `kbot v${getVersion()} — shipped today.\n\n${getRecentCommits(3).map(c => '• ' + c.slice(9)).join('\n')}\n\nnpm i -g @kernel.chat/kbot`,
  () => `Deploy from your terminal:\n\nkbot deploy\n\nAuto-detects Vercel, Netlify, Cloudflare, Fly.io, Railway from your config files.\n\nOne command. Zero config.`,
]

const LINKEDIN_POSTS = [
  () => `I've been building kbot — an open-source terminal AI agent that learns your coding patterns.\n\nUnlike most AI tools, kbot extracts patterns from your sessions and uses Bayesian skill ratings to route tasks to the right specialist faster over time.\n\nWhat makes it different:\n• ${getToolCount()} built-in tools (git, deploy, database, game dev, research)\n• 20 AI providers — switch with one command, zero lock-in\n• Runs fully offline with embedded llama.cpp\n• Works on first run — no API key needed\n• Programmatic SDK for building on top\n\nOpen source, MIT licensed, 8 runtime dependencies.\n\nnpm install -g @kernel.chat/kbot\n\n#ai #opensource #developer #terminal #cli`,
  () => `The terminal is the most underrated AI interface.\n\nWhile everyone's building chatbot UIs, kbot puts ${getToolCount()} AI tools directly in your workflow:\n\n→ git diff | kbot "review this"\n→ kbot audit vercel/next.js\n→ kbot --agent researcher "latest papers on RAG"\n→ kbot deploy\n\nNo browser tab. No context switching. Pipe in, get results out.\n\n20 providers. Runs offline. Learns your patterns.\n\nnpm install -g @kernel.chat/kbot\n\n#developertools #ai #productivity`,
  () => `Zero-config AI is here.\n\nI shipped kbot v${getVersion()} today. The biggest change: it works on first run with no API key.\n\nInstall it → run it → get a response. The embedded llama.cpp engine handles it. $0, fully private, no account needed.\n\nWant better quality? Run \`kbot auth\` and add any of 20 providers — Claude, GPT, Gemini, DeepSeek, Groq, or 15 more.\n\nThe friction of "set up your API key first" killed too many first impressions. Now there's no wall.\n\nnpm install -g @kernel.chat/kbot\n\n#ai #opensource #developerexperience`,
]

const THREAD_TEMPLATES = [
  () => {
    const v = getVersion()
    const tools = getToolCount()
    return [
      `I built a terminal AI agent with ${tools} tools that learns how you code.\n\nNot "remembers your chat." Actually extracts patterns and gets faster.\n\nHere's what that looks like 🧵`,
      `kbot has 22 specialist agents that auto-route based on your prompt:\n\n"fix the auth bug" → Coder\n"research JWT tokens" → Researcher\n"review this PR" → Guardian\n"draft a changelog" → Writer\n\nBayesian skill ratings. Smarter with every interaction.`,
      `20 providers, zero lock-in:\n\nFree: Embedded, Ollama, LM Studio, Jan\nCheap: DeepSeek ($0.27/M), Cerebras ($0.60/M)\nPremium: Claude, GPT, Gemini\n\nSwitch with one command.`,
      `The weird part: kbot was built by itself.\n\nClaude Code writes kbot's source while using kbot as an MCP tool in the same session.\n\nThe tools from session N become the tools used in session N+1.\n\n60 versions later: ${tools} tools, learning engine, SDK.`,
      `Zero config. Just install and go.\n\nnpm i -g @kernel.chat/kbot\nkbot "hello"\n\nNo API key. No setup. Embedded AI. $0.\n\nGitHub: github.com/isaacsight/kernel\nDiscord: discord.gg/pYJn3hBqnz`,
    ]
  },
]

// ─── Post Selection ─────────────────────────────────────────

type ContentType = 'tweet' | 'linkedin' | 'thread' | 'release'

function selectContent(state: SocialState, type: ContentType): { text: string | string[]; label: string } | null {
  const version = getVersion()

  // Release tweet if new version
  if (type === 'tweet' && version !== state.lastVersion) {
    state.lastVersion = version
    return { text: `kbot v${version} just shipped.\n\n${getRecentCommits(3).map(c => '• ' + c.slice(9)).join('\n')}\n\nUpgrade: npm i -g @kernel.chat/kbot`, label: `release-${version}` }
  }

  if (type === 'tweet') {
    const idx = nextIndex(state, 'tweets', TWEETS.length)
    return { text: TWEETS[idx](), label: `tweet-${idx}` }
  }

  if (type === 'linkedin') {
    const idx = nextIndex(state, 'linkedin', LINKEDIN_POSTS.length)
    return { text: LINKEDIN_POSTS[idx](), label: `linkedin-${idx}` }
  }

  if (type === 'thread') {
    const idx = nextIndex(state, 'threads', THREAD_TEMPLATES.length)
    return { text: THREAD_TEMPLATES[idx](), label: `thread-${idx}` }
  }

  return null
}

// ─── CLI ────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'all'
const contentType = args.includes('--thread') ? 'thread' as const : args.includes('--release') ? 'release' as const : undefined
const statusFlag = args.includes('--status')

async function main() {
  console.log('🤖 kbot Social Media Agent')
  console.log('═'.repeat(50))

  const state = loadState()

  if (statusFlag) {
    console.log(`\nTweets posted: ${state.stats.tweets}`)
    console.log(`LinkedIn posts: ${state.stats.linkedin}`)
    console.log(`Threads: ${state.stats.threads}`)
    console.log(`Last version: ${state.lastVersion}`)
    console.log('\nRotation:')
    for (const [k, v] of Object.entries(state.rotationIndex)) console.log(`  ${k}: ${v}`)
    console.log('\nLast posted:')
    for (const [k, v] of Object.entries(state.lastPosted)) console.log(`  ${k}: ${v}`)
    return
  }

  const version = getVersion()
  const tools = getToolCount()
  console.log(`\nkbot v${version} | ${tools} tools`)
  if (dryRun) console.log('🧪 DRY RUN\n')

  // ── X (Twitter) ──
  if (platform === 'x' || platform === 'all') {
    if (contentType === 'thread') {
      const content = selectContent(state, 'thread')
      if (content && Array.isArray(content.text)) {
        console.log(`\n📡 X Thread (${content.text.length} tweets):`)
        content.text.forEach((t, i) => console.log(`  ${i + 1}/${content.text.length}: ${t.slice(0, 60)}...`))
        if (!dryRun && X_API_KEY) {
          const ids = await postThread(content.text)
          console.log(`  ✅ Posted: https://twitter.com/i/status/${ids[0]}`)
          state.stats.threads++
          recordPost(state, content.text[0], 'x-thread')
        } else if (!X_API_KEY) {
          console.log('  ⚠ X_API_KEY not set — skipping')
        }
      }
    } else {
      const content = selectContent(state, contentType === 'release' ? 'tweet' : 'tweet')
      if (content && typeof content.text === 'string') {
        if (isDuplicate(state, content.text)) {
          console.log('\n📡 X: ⏭ Skipped (duplicate)')
        } else {
          console.log(`\n📡 X Tweet (${content.text.length}/280):`)
          console.log(`  ${content.text.replace(/\n/g, '\n  ')}`)
          if (!dryRun && X_API_KEY) {
            const result = await postTweet(content.text)
            console.log(`  ✅ Posted: https://twitter.com/i/status/${result.id}`)
            state.stats.tweets++
            recordPost(state, content.text, 'x')
          } else if (!X_API_KEY) {
            console.log('  ⚠ X_API_KEY not set — skipping')
          }
        }
      }
    }
  }

  // ── LinkedIn ──
  if (platform === 'linkedin' || platform === 'all') {
    const content = selectContent(state, 'linkedin')
    if (content && typeof content.text === 'string') {
      if (isDuplicate(state, content.text)) {
        console.log('\n📡 LinkedIn: ⏭ Skipped (duplicate)')
      } else {
        console.log(`\n📡 LinkedIn Post:`)
        console.log(`  ${content.text.slice(0, 100)}...`)
        if (!dryRun && LINKEDIN_TOKEN) {
          const id = await postLinkedIn(content.text)
          console.log(`  ✅ Posted (${id})`)
          state.stats.linkedin++
          recordPost(state, content.text, 'linkedin')
        } else if (!LINKEDIN_TOKEN) {
          console.log('  ⚠ LINKEDIN_ACCESS_TOKEN not set — skipping')
        }
      }
    }
  }

  saveState(state)
  console.log('\n' + '═'.repeat(50))
  console.log(`✅ Done — Tweets: ${state.stats.tweets} | LinkedIn: ${state.stats.linkedin} | Threads: ${state.stats.threads}`)
}

// ─── Export for MCP / programmatic use ──────────────────────

export async function generatePost(platform: 'x' | 'linkedin' | 'thread'): Promise<string | string[]> {
  const state = loadState()
  const content = selectContent(state, platform === 'thread' ? 'thread' : platform === 'x' ? 'tweet' : 'linkedin')
  if (!content) return 'No content available'
  saveState(state)
  return content.text
}

export { loadState as getSocialState }

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })

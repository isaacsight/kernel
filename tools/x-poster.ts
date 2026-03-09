#!/usr/bin/env npx tsx
// X (Twitter) Auto-Poster — Posts tweets via the X API v2
//
// Setup:
//   1. Apply for X Developer account (free): https://developer.twitter.com
//   2. Create a project + app with OAuth 1.0a (Read + Write)
//   3. Set env vars: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//
// Usage:
//   npx tsx tools/x-poster.ts "Your tweet text here"
//   npx tsx tools/x-poster.ts --from-bot          # Auto-post top story from news bot
//   npx tsx tools/x-poster.ts --schedule 08:00    # Schedule for 8am (uses system cron)
//   npx tsx tools/x-poster.ts --dry-run "Tweet"   # Preview without posting

import { createHmac, randomBytes } from 'node:crypto'

// --- Config ---
const API_KEY = process.env.X_API_KEY ?? ''
const API_SECRET = process.env.X_API_SECRET ?? ''
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN ?? ''
const ACCESS_SECRET = process.env.X_ACCESS_SECRET ?? ''
const TWEET_URL = 'https://api.twitter.com/2/tweets'

// --- OAuth 1.0a Signature ---
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&')

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
  return createHmac('sha1', signingKey).update(baseString).digest('base64')
}

function buildOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  }

  oauthParams.oauth_signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET,
    ACCESS_SECRET,
  )

  const header = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${header}`
}

// --- Post Tweet ---
async function postTweet(text: string): Promise<{ id: string; text: string }> {
  const auth = buildOAuthHeader('POST', TWEET_URL)

  const res = await fetch(TWEET_URL, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`X API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { data: { id: string; text: string } }
  return data.data
}

// --- Get top story from news bot ---
async function getTopStoryTweet(): Promise<string> {
  const { execSync } = await import('node:child_process')
  const cwd = new URL('..', import.meta.url).pathname
  const output = execSync(`npx tsx tools/ai-news-bot.ts 2>/dev/null`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
  })
  const stories = JSON.parse(output)
  if (!stories.length) throw new Error('No stories found')
  return stories[0].tweet
}

// --- Schedule via cron ---
function scheduleTweet(time: string, tweet: string) {
  const [hours, minutes] = time.split(':')
  const scriptPath = new URL(import.meta.url).pathname
  const cronLine = `${minutes} ${hours} * * * cd "${new URL('..', import.meta.url).pathname}" && npx tsx "${scriptPath}" --from-bot >> /tmp/kbot-x-poster.log 2>&1`

  console.log('Add this to your crontab (run: crontab -e):\n')
  console.log(cronLine)
  console.log('\nThis will auto-post the top AI story every day at ' + time)
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2)

  // Check config
  if (!API_KEY && !args.includes('--dry-run') && !args.includes('--schedule')) {
    console.error(`
X API credentials not found. Set these env vars:

  export X_API_KEY="your-api-key"
  export X_API_SECRET="your-api-secret"
  export X_ACCESS_TOKEN="your-access-token"
  export X_ACCESS_SECRET="your-access-secret"

Get these from: https://developer.twitter.com
(Free tier supports 1,500 tweets/month — plenty for daily posting)
`)
    process.exit(1)
  }

  // --schedule flag
  if (args.includes('--schedule')) {
    const timeIdx = args.indexOf('--schedule') + 1
    const time = args[timeIdx] ?? '08:00'
    scheduleTweet(time, '')
    return
  }

  // Get tweet text
  let tweet: string

  if (args.includes('--from-bot')) {
    console.log('Fetching top AI story...')
    tweet = await getTopStoryTweet()
  } else {
    tweet = args.filter(a => !a.startsWith('--')).join(' ')
  }

  if (!tweet) {
    console.error('Usage:')
    console.error('  npx tsx tools/x-poster.ts "Your tweet text"')
    console.error('  npx tsx tools/x-poster.ts --from-bot')
    console.error('  npx tsx tools/x-poster.ts --dry-run "Preview tweet"')
    console.error('  npx tsx tools/x-poster.ts --schedule 08:00')
    process.exit(1)
  }

  // Validate length
  if (tweet.length > 280) {
    console.error(`Tweet too long: ${tweet.length}/280 chars. Trimming...`)
    tweet = tweet.slice(0, 277) + '...'
  }

  // --dry-run flag
  if (args.includes('--dry-run')) {
    console.log('=== DRY RUN ===')
    console.log(`Length: ${tweet.length}/280`)
    console.log('---')
    console.log(tweet)
    console.log('---')
    console.log('(not posted)')
    return
  }

  // Post it
  console.log(`Posting tweet (${tweet.length}/280 chars)...`)
  const result = await postTweet(tweet)
  console.log(`Posted: https://twitter.com/i/status/${result.id}`)
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})

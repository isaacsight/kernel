#!/usr/bin/env npx tsx
// AI News Bot — Scrapes top AI stories, generates social media posts
// Run: npx tsx tools/ai-news-bot.ts
// Output: JSON array of stories with tweets, tiktok captions, and revenue actions

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`
const REDDIT_HOT = (sub: string) => `https://www.reddit.com/r/${sub}/hot.json?limit=30`

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'anthropic', 'openai', 'gemini', 'llama',
  'mistral', 'transformer', 'diffusion', 'neural', 'deep learning',
  'machine learning', 'fine-tun', 'inference', 'training', 'embedding',
  'rag', 'token', 'agent', 'copilot', 'chatbot', 'ollama', 'hugging',
  'stable diffusion', 'midjourney', 'sora', 'runway', 'whisper',
  'open source', 'open-source', 'model', 'benchmark', 'context window',
  'multimodal', 'vision', 'reasoning', 'chain of thought', 'rlhf',
  'meta ai', 'google ai', 'nvidia', 'groq', 'perplexity', 'cursor',
]

interface Story {
  title: string
  url: string
  score: number
  source: 'hackernews' | 'reddit'
  subreddit?: string
}

interface NewsPost {
  headline: string
  source_url: string
  source: string
  score: number
  category: string
  tweet: string
  tiktok_caption: string
  revenue_action: string
}

// --- Fetch HackerNews ---
async function fetchHN(): Promise<Story[]> {
  try {
    const res = await fetch(HN_TOP)
    const ids: number[] = await res.json()
    // Fetch top 80 to filter for AI
    const items = await Promise.all(
      ids.slice(0, 80).map(async (id) => {
        try {
          const r = await fetch(HN_ITEM(id))
          return await r.json()
        } catch { return null }
      })
    )
    return items
      .filter((item): item is any => item?.title && item?.url)
      .filter(item => {
        const t = item.title.toLowerCase()
        return AI_KEYWORDS.some(kw => t.includes(kw))
      })
      .map(item => ({
        title: item.title,
        url: item.url,
        score: item.score ?? 0,
        source: 'hackernews' as const,
      }))
  } catch (e) {
    console.error('HN fetch failed:', e)
    return []
  }
}

// --- Fetch Reddit ---
async function fetchReddit(subreddit: string): Promise<Story[]> {
  try {
    const res = await fetch(REDDIT_HOT(subreddit), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    const data = await res.json()
    return (data?.data?.children ?? [])
      .filter((c: any) => c.data?.title && !c.data.stickied)
      .map((c: any) => ({
        title: c.data.title,
        url: c.data.url || `https://reddit.com${c.data.permalink}`,
        score: c.data.score ?? 0,
        source: 'reddit' as const,
        subreddit,
      }))
  } catch (e) {
    console.error(`Reddit r/${subreddit} fetch failed:`, e)
    return []
  }
}

// --- Categorize ---
function categorize(title: string): string {
  const t = title.toLowerCase()
  if (/release|launch|announc|introduc|new model|v\d/.test(t)) return 'model_release'
  if (/open.?source|github|hugging|apache|mit license/.test(t)) return 'open_source'
  if (/paper|research|arxiv|study|benchmark/.test(t)) return 'research'
  if (/raise|fund|valuation|ipo|series [a-d]|acqui/.test(t)) return 'funding'
  if (/regulat|ban|law|eu|congress|safety|alignment/.test(t)) return 'regulation'
  if (/drama|fired|quit|letter|controversy|lawsuit/.test(t)) return 'drama'
  return 'tools'
}

// --- Revenue action mapping ---
function revenueAction(category: string): string {
  const map: Record<string, string> = {
    model_release: 'AFFILIATE: Link to try the model (Replicate, HuggingFace, Together.ai affiliate)',
    open_source: 'FUNNEL: "Run it locally with K:BOT + Ollama" → kernel.chat signup',
    research: 'LEAD MAGNET: "I broke down this paper in my newsletter" → Beehiiv signup',
    funding: 'ENGAGEMENT: Hot take → X Premium revenue share (high reply rate)',
    regulation: 'ENGAGEMENT: Controversial take → X Premium revenue share (high impression count)',
    drama: 'ENGAGEMENT: Commentary → X Premium revenue share (viral potential)',
    tools: 'AFFILIATE: Link to the tool with affiliate/referral code',
  }
  return map[category] ?? 'ENGAGEMENT: Standard post for follower growth'
}

// --- Generate tweet ---
function generateTweet(story: Story, category: string): string {
  const title = story.title.length > 180 ? story.title.slice(0, 177) + '...' : story.title
  const suffixes: Record<string, string[]> = {
    model_release: [
      '\n\nTested it. Thoughts in thread.',
      '\n\nRunning it locally right now. Initial impressions below.',
      '\n\nThe benchmarks look good. Real-world usage is what matters though.',
    ],
    open_source: [
      '\n\nYou can run this locally right now. No API key needed.',
      '\n\nOpen source wins again. This is how it should be.',
      '\n\nAnother reason to own your own stack.',
    ],
    research: [
      '\n\nThis matters more than people realize.',
      '\n\nThe implications here are underrated.',
      '\n\nRead the actual paper before forming an opinion.',
    ],
    funding: [
      '\n\nFollow the money.',
      '\n\nMore money doesn\'t mean better models.',
      '\n\nInteresting bet. Let\'s see if it pays off.',
    ],
    regulation: [
      '\n\nThis affects every builder.',
      '\n\nRegulation is coming whether we like it or not. Better to shape it.',
      '\n\nThe details matter more than the headline.',
    ],
    drama: [
      '\n\nHere we go again.',
      '\n\nThe real story is always in the replies.',
      '\n\nStay focused on building. This too shall pass.',
    ],
    tools: [
      '\n\nWorth trying if you\'re in the space.',
      '\n\nAdded this to the stack. Will report back.',
      '\n\nThe tooling is finally catching up to the models.',
    ],
  }
  const options = suffixes[category] ?? ['\n\nWorth watching.']
  const suffix = options[Math.floor(Math.random() * options.length)]
  const tweet = `${title}${suffix}`
  return tweet.length <= 280 ? tweet : tweet.slice(0, 277) + '...'
}

// --- Generate TikTok caption ---
function generateTikTokCaption(story: Story, category: string): string {
  const title = story.title.length > 80 ? story.title.slice(0, 77) + '...' : story.title
  const tags = '#AI #Tech #OpenSource'
  const caption = `${title} ${tags}`
  return caption.length <= 150 ? caption : caption.slice(0, 147) + '...'
}

// --- Main ---
async function main() {
  console.error('Fetching AI news from HackerNews + Reddit...\n')

  const [hn, ml, llama] = await Promise.all([
    fetchHN(),
    fetchReddit('MachineLearning'),
    fetchReddit('LocalLLaMA'),
  ])

  console.error(`  HackerNews: ${hn.length} AI stories`)
  console.error(`  r/MachineLearning: ${ml.length} posts`)
  console.error(`  r/LocalLLaMA: ${llama.length} posts`)

  const all = [...hn, ...ml, ...llama]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // Dedupe by similar titles
  const seen = new Set<string>()
  const unique = all.filter(s => {
    const key = s.title.toLowerCase().slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)

  const posts: NewsPost[] = unique.map(story => {
    const category = categorize(story.title)
    return {
      headline: story.title,
      source_url: story.url,
      source: story.source === 'reddit' ? `r/${story.subreddit}` : 'HackerNews',
      score: story.score,
      category,
      tweet: generateTweet(story, category),
      tiktok_caption: generateTikTokCaption(story, category),
      revenue_action: revenueAction(category),
    }
  })

  console.error(`\nTop ${posts.length} stories ready:\n`)
  process.stdout.write(JSON.stringify(posts, null, 2))
  console.error('\n\nDone. Copy tweets above and post.')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})

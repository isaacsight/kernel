#!/usr/bin/env npx tsx
// Newsletter Generator — Builds a weekly "The AI Signal" issue from the news bot
//
// Usage:
//   npx tsx tools/newsletter-gen.ts              # Generate this week's issue
//   npx tsx tools/newsletter-gen.ts --preview    # Preview in terminal
//   npx tsx tools/newsletter-gen.ts --html       # Output as HTML for Beehiiv
//
// Workflow:
//   1. Runs ai-news-bot.ts to get top stories
//   2. Formats them into newsletter sections
//   3. Outputs markdown or HTML ready for Beehiiv

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface NewsStory {
  headline: string
  source_url: string
  source: string
  score: number
  category: string
  tweet: string
  tiktok_caption: string
  revenue_action: string
}

async function getStories(): Promise<NewsStory[]> {
  const cwd = join(__dirname, '..')
  const output = execSync(`npx tsx tools/ai-news-bot.ts 2>/dev/null`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    shell: '/bin/zsh',
  })
  return JSON.parse(output)
}

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function generateMarkdown(stories: NewsStory[]): string {
  const week = getWeekNumber()
  const date = formatDate()
  const top3 = stories.slice(0, 3)
  const modelStories = stories.filter(s =>
    s.category === 'model_release' || s.category === 'open_source'
  )
  const toolStory = stories.find(s => s.category === 'tools') ?? stories[3]

  let md = `# The AI Signal — Week ${week}\n\n`
  md += `*${date}*\n\n`
  md += `---\n\n`

  // Section 1: The Signal
  md += `## THE SIGNAL\n\n`
  top3.forEach((s, i) => {
    md += `**${i + 1}. ${s.headline}**\n`
    md += `Source: ${s.source} | Score: ${s.score}\n`
    md += `[Read more](${s.source_url})\n\n`
  })
  md += `---\n\n`

  // Section 2: Model Drop
  if (modelStories.length > 0) {
    md += `## MODEL DROP\n\n`
    md += `| Model/Release | Source | Why It Matters |\n`
    md += `|--------------|--------|----------------|\n`
    modelStories.slice(0, 3).forEach(s => {
      md += `| ${s.headline.slice(0, 50)} | ${s.source} | Score: ${s.score} |\n`
    })
    md += `\n---\n\n`
  }

  // Section 3: Tool of the Week
  if (toolStory) {
    md += `## TOOL OF THE WEEK\n\n`
    md += `**${toolStory.headline}**\n`
    md += `[Check it out](${toolStory.source_url})\n\n`
    md += `---\n\n`
  }

  // Section 4: From the Terminal
  const tips = [
    `**Quick model switching in K:BOT:**\n\n\`\`\`bash\nnpx kbot\n# Inside K:BOT:\n/ollama          # Switch to local models\n/agent coder     # Use the coding specialist\n/agent researcher # Switch to research mode\n\`\`\`\n\nK:BOT auto-detects your Ollama models and picks the best one per task.`,
    `**Custom agents in 10 seconds:**\n\n\`\`\`bash\nnpx kbot\n/matrix create security-expert "You review code for OWASP Top 10 vulnerabilities. Be thorough."\n\`\`\`\n\nNow you have a security specialist on demand. Your custom agents persist across sessions.`,
    `**Save and resume conversations:**\n\n\`\`\`bash\nnpx kbot\n# ... do some work ...\n/save debug-session\n# ... come back later ...\n/resume debug-session\n\`\`\`\n\nK:BOT remembers your full conversation context, including which agent you were using.`,
    `**Run K:BOT with zero cloud dependency:**\n\n\`\`\`bash\nbrew install ollama\nollama pull qwen2.5-coder\nnpx kbot\n/ollama\n\`\`\`\n\n17 AI specialists, fully local, zero API cost. Your code never leaves your machine.`,
  ]
  md += `## FROM THE TERMINAL\n\n`
  md += tips[Math.floor(Math.random() * tips.length)]
  md += `\n\n---\n\n`

  // Section 5: Hot Take
  const takes = [
    `The "AI wrapper" criticism is lazy. Every successful software product is a wrapper around lower-level primitives. Stripe wraps payment APIs. Vercel wraps deployment. The value isn't in the model — it's in the workflow. Build the wrapper. Ship it.`,
    `We're going to look back at 2025-2026 as the period where local AI went from hobby project to production viable — the same way Docker went from novelty to necessity in 2014-2015. The tools are here. The models are good enough. The stack is forming right now.`,
    `If your AI product stops working when OpenAI changes their pricing, you don't have a product. You have a dependency. Build the abstraction layer. Support multiple providers. Own your stack.`,
    `The real AI moat isn't the model — it's the data flywheel. Every company training on the same public datasets converges on similar capabilities. The winners will be the ones with proprietary data from actual users doing actual work.`,
    `Most developers don't need GPT-4 for their daily work. A 7B model handles 80% of coding tasks. The remaining 20% is where you reach for the big models — and even that gap is shrinking every quarter.`,
  ]
  md += `## HOT TAKE\n\n`
  md += takes[Math.floor(Math.random() * takes.length)]
  md += `\n\n---\n\n`

  // Footer
  md += `*The AI Signal is written by the K:BOT team.*\n`
  md += `*Open source terminal AI: \`npx kbot\` | [kernel.chat](https://kernel.chat)*\n`
  md += `*Reply to this email anytime. I read everything.*\n`

  return md
}

function markdownToHtml(md: string): string {
  // Basic markdown → HTML conversion for Beehiiv paste
  let html = md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family: Courier Prime, monospace; color: #6B5B95;">$1</h2>')
    .replace(/^\*\*(\d+)\. (.+)\*\*$/gm, '<h3>$1. $2</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: #f4f0ec; padding: 2px 6px; border-radius: 3px; font-family: Courier Prime, monospace;">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background: #1F1E1D; color: #FAF9F6; padding: 16px; border-radius: 8px; font-family: Courier Prime, monospace; overflow-x: auto;"><code>$2</code></pre>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #6B5B95;">$1</a>')
    .replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e8e4de; margin: 24px 0;">')
    .replace(/^\| (.+)$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => c.trim())
      return '<tr>' + cells.map(c => `<td style="padding: 8px; border-bottom: 1px solid #e8e4de;">${c}</td>`).join('') + '</tr>'
    })

  // Wrap in email-safe container
  return `
<div style="max-width: 600px; margin: 0 auto; font-family: 'EB Garamond', Georgia, serif; color: #1F1E1D; line-height: 1.7;">
${html}
</div>`
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2)

  console.error('Generating newsletter from live AI news...\n')
  const stories = await getStories()

  if (!stories.length) {
    console.error('No stories found. Check your internet connection.')
    process.exit(1)
  }

  const markdown = generateMarkdown(stories)

  if (args.includes('--html')) {
    const html = markdownToHtml(markdown)
    process.stdout.write(html)
    console.error('\n\nHTML output ready — paste into Beehiiv editor (HTML mode)')
  } else {
    process.stdout.write(markdown)
    if (args.includes('--preview')) {
      console.error('\n\n--- Preview complete ---')
    } else {
      console.error('\n\nMarkdown output ready — paste into Beehiiv editor')
    }
  }
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})

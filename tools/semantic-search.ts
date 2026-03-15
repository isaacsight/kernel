#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Semantic Search — find code by meaning, not just keywords
// Uses the embedding index built by the K:BOT daemon
// Usage: npm run search -- "how does agent routing work"
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = join(import.meta.dirname, '..')
const EMB_DIR = join(PROJECT_ROOT, 'tools', 'daemon-reports', 'embeddings')
const OLLAMA_URL = 'http://localhost:11434'

// ANSI colors
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const GRAY = '\x1b[90m'
const RESET = '\x1b[0m'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function scoreBar(score: number): string {
  const width = 20
  const filled = Math.round(score * width)
  const color = score > 0.7 ? GREEN : score > 0.5 ? YELLOW : GRAY
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(width - filled)}${RESET}`
}

async function embedQuery(query: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: query }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Ollama embed error: ${res.status}`)
  const data = await res.json()
  return data.embeddings?.[0] || []
}

function getFilePreview(filePath: string, lines = 3): string {
  try {
    const fullPath = join(PROJECT_ROOT, filePath)
    const content = readFileSync(fullPath, 'utf8')
    return content.split('\n').slice(0, lines).map(l => `    ${DIM}${l.slice(0, 80)}${RESET}`).join('\n')
  } catch {
    return `    ${DIM}(file not readable)${RESET}`
  }
}

async function main() {
  const query = process.argv.slice(2).join(' ')

  if (!query) {
    console.log(`\n${BOLD}Semantic Search${RESET} — find code by meaning\n`)
    console.log(`Usage: ${CYAN}npm run search -- "your question here"${RESET}`)
    console.log(`\nExamples:`)
    console.log(`  npm run search -- "how does agent routing work"`)
    console.log(`  npm run search -- "where are stripe payments handled"`)
    console.log(`  npm run search -- "voice input and speech recognition"`)
    console.log(`  npm run search -- "dark mode theme switching"`)
    console.log('')
    process.exit(0)
  }

  // Check embeddings exist
  if (!existsSync(EMB_DIR)) {
    console.log(`\n${YELLOW}No embedding index found.${RESET}`)
    console.log(`The K:BOT daemon builds this automatically. Run: ${CYAN}npm run daemon${RESET}\n`)
    process.exit(1)
  }

  const embFiles = readdirSync(EMB_DIR).filter(f => f.endsWith('.json'))
  if (embFiles.length === 0) {
    console.log(`\n${YELLOW}Embedding index is empty.${RESET} The daemon is still building it.`)
    console.log(`Check progress: ${CYAN}npm run daemon:log${RESET}\n`)
    process.exit(1)
  }

  console.log(`\n${BOLD}Searching ${embFiles.length} files for:${RESET} "${CYAN}${query}${RESET}"\n`)

  // Embed the query
  let queryEmb: number[]
  try {
    queryEmb = await embedQuery(query)
  } catch {
    console.log(`${YELLOW}Can't reach Ollama.${RESET} Make sure it's running: ${CYAN}ollama serve${RESET}\n`)
    process.exit(1)
  }

  // Score all files
  const results: { file: string; score: number }[] = []

  for (const embFile of embFiles) {
    try {
      const data = JSON.parse(readFileSync(join(EMB_DIR, embFile), 'utf8'))
      const score = cosineSimilarity(queryEmb, data.embedding)
      results.push({ file: data.file, score })
    } catch {
      // Skip corrupted embedding files
    }
  }

  // Sort by score, show top 10
  results.sort((a, b) => b.score - a.score)
  const top = results.slice(0, 10)

  console.log(`${BOLD}Top matches:${RESET}\n`)

  for (let i = 0; i < top.length; i++) {
    const { file, score } = top[i]
    const pct = (score * 100).toFixed(1)
    const rank = `${DIM}${String(i + 1).padStart(2)}.${RESET}`
    console.log(`${rank} ${scoreBar(score)} ${BOLD}${pct}%${RESET}  ${CYAN}${file}${RESET}`)
    console.log(getFilePreview(file))
    console.log('')
  }

  if (results.length > 10) {
    console.log(`${DIM}  ... and ${results.length - 10} more files${RESET}\n`)
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})

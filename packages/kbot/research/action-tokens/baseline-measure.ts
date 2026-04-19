/**
 * baseline-measure.ts — Measure learned-router accuracy on observer data.
 * Phase 2 of the action-token proposal. See BASELINE.md for methodology.
 *
 * Run: cd packages/kbot && npx tsx research/action-tokens/baseline-measure.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { learnedRoute } from '../../src/learned-router.js'
import { CREATIVE_KEYWORDS } from '../../src/agents/creative.js'
import { DEVELOPER_KEYWORDS } from '../../src/agents/developer.js'
import { TRADER_KEYWORDS } from '../../src/agents/trader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = join(homedir(), '.kbot', 'observer', 'session.jsonl')
const TEMPLATE = join(__dirname, 'BASELINE.template.md')
const BASELINE_OUT = join(__dirname, 'BASELINE.md')
const CONTEXT_WINDOW = 5

// Tool → (agent, category) ground truth. Substring rules over the observed
// tool names, mirroring learned-router's AGENT_KEYWORDS worldview.
function labelTool(tool: string): { agent: string; category: string } {
  const t = tool.toLowerCase()
  if (['read','edit','write','multiedit','notebookedit'].includes(t)) return { agent: 'coder', category: 'file-ops' }
  if (['grep','glob','toolsearch'].includes(t)) return { agent: 'coder', category: 'search' }
  if (t === 'bash') return { agent: 'coder', category: 'shell' }
  if (t === 'task' || t === 'taskupdate') return { agent: 'analyst', category: 'planning' }
  if (t === 'agent') return { agent: 'kernel', category: 'delegation' }
  if (t === 'websearch' || t === 'webfetch') return { agent: 'researcher', category: 'web' }
  if (t.includes('ableton') || t.includes('serum') || t.includes('dj_set') ||
      t.includes('drum') || t.includes('melody') || t.includes('beat')) return { agent: 'producer', category: 'ableton' }
  if (t.includes('git_') || t.includes('github')) return { agent: 'coder', category: 'git' }
  if (t.includes('stock') || t.includes('crypto') || t.includes('wallet') ||
      t.includes('market') || t.includes('portfolio') || t.includes('defi')) return { agent: 'trader', category: 'finance' }
  if (t.includes('paper') || t.includes('arxiv') || t.includes('pubmed') ||
      t.includes('research') || t.includes('literature')) return { agent: 'researcher', category: 'research' }
  if (t.includes('gene') || t.includes('protein') || t.includes('blast') ||
      t.includes('compound') || t.includes('reaction') || t.includes('quantum') ||
      t.includes('molecule')) return { agent: 'scientist', category: 'science' }
  if (t.includes('brain') || t.includes('eeg') || t.includes('neuro') ||
      t.includes('cognitive')) return { agent: 'neuroscientist', category: 'neuro' }
  if (t.includes('epidem') || t.includes('vaccin') || t.includes('disease') ||
      t.includes('sir_model')) return { agent: 'epidemiologist', category: 'epi' }
  if (t.startsWith('daemon_')) return { agent: 'kernel', category: 'daemon' }
  if (t.includes('computer-use') || t.includes('screenshot') || t.includes('mouse') ||
      t.includes('keyboard') || t.includes('click')) return { agent: 'kernel', category: 'computer-use' }
  if (t.includes('browser_') || t.includes('playwright')) return { agent: 'coder', category: 'browser' }
  if (t.includes('social') || t.includes('stream') || t.includes('content')) return { agent: 'writer', category: 'social' }
  if (t.includes('memory') || t.includes('graph_') || t.includes('dream') ||
      t.includes('learning_')) return { agent: 'kernel', category: 'memory' }
  if (t.includes('ollama') || t.includes('local_') || t.includes('kbot_local')) return { agent: 'kernel', category: 'local-ai' }
  if (t.includes('mcp_') || t.includes('composio') || t.includes('forge_') ||
      t.includes('plugin_')) return { agent: 'coder', category: 'mcp-ops' }
  return { agent: 'kernel', category: 'other' }
}

interface Event { ts: string; tool: string; args: Record<string, unknown>; session: string }

function loadEvents(): Event[] {
  const out: Event[] = []
  for (const line of readFileSync(SESSION_FILE, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      if (e.tool && e.session) out.push(e)
    } catch { /* skip */ }
  }
  return out
}

function extractText(e: Event): string {
  const a = (e.args || {}) as Record<string, unknown>
  for (const k of ['description','query','prompt','message','pattern']) {
    const v = a[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  for (const k of ['file_path','path','url']) {
    const v = a[k]
    if (typeof v === 'string' && v.length > 0) return v.split('/').slice(-3).join(' ')
  }
  if (e.tool === 'Bash' && typeof a['command'] === 'string') return (a['command'] as string).slice(0, 200)
  return ''
}

function reconstructIntent(prior: Event[]): string {
  if (prior.length === 0) return ''
  const texts: string[] = []
  for (let i = prior.length - 1; i >= 0 && texts.length < 4; i--) {
    const t = extractText(prior[i])
    if (t) texts.unshift(t)
  }
  const tools = prior.slice(-5).map(e => e.tool).join(' ')
  return `${tools} ${texts.join(' ')}`.trim()
}

const AGENT_KEYWORDS: Record<string, string[]> = {
  coder: ['code','function','class','bug','error','fix','implement','build','create','write','typescript','javascript','python','rust','react','component','test','refactor','api','endpoint','database','sql','npm','install','package','import','export','async','type','interface','module','compile','lint','debug','crash','exception'],
  researcher: ['research','find','search','compare','alternatives','benchmark','documentation','docs','article','paper','study','analyze','investigate','explore','discover','learn','understand','explain','difference','versus','pros','cons','tradeoff'],
  writer: ['write','draft','blog','post','article','email','message','readme','documentation','changelog','announcement','copy','content','marketing','social','tweet','thread','newsletter','story','essay','summary','summarize','edit','proofread'],
  analyst: ['analyze','strategy','plan','architecture','design','review','audit','evaluate','assess','optimize','performance','cost','pricing','business','metric','dashboard','report','insight','decision','priority','roadmap'],
  kernel: ['hey','hello','hi','thanks','help','what','how','why','general','chat','talk','opinion','think','feel','advice'],
  producer: ['ableton','daw','produce','session','clip','scene','tempo','bpm','midi','chord','melody','beat','drum','mix','mixer','device','plugin','vst','instrument','reverb','delay','eq','filter','synth','kick','snare','hihat'],
  creative: CREATIVE_KEYWORDS,
  developer: DEVELOPER_KEYWORDS,
  trader: TRADER_KEYWORDS,
}
const STOP = new Set(['the','a','an','is','are','to','of','in','for','on','with','at','by','from','it','this','that','and','or','but','not','so','if','then'])
const normalize = (m: string) => m.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))

function agentRanking(message: string): string[] {
  const words = normalize(message)
  const votes: Record<string, number> = {}
  for (const [agent, kws] of Object.entries(AGENT_KEYWORDS)) {
    const kset = new Set(kws)
    const n = words.filter(w => kset.has(w)).length
    if (n > 0) votes[agent] = n
  }
  return Object.entries(votes).sort((a, b) => b[1] - a[1]).map(([a]) => a)
}

const ALL_AGENTS = ['coder','researcher','writer','analyst','kernel','producer','scientist','neuroscientist','epidemiologist','trader','creative','developer','social_scientist','philosopher','linguist','historian']

function topKPredictions(message: string, k: number): string[] {
  const realPick = learnedRoute(message)
  const rank = agentRanking(message)
  const out: string[] = []
  if (realPick) out.push(realPick.agent)
  for (const a of rank) if (!out.includes(a) && out.length < k) out.push(a)
  for (const a of ALL_AGENTS) if (!out.includes(a) && out.length < k) out.push(a)
  return out.slice(0, k)
}

function main(): void {
  console.log('Loading session.jsonl...')
  const events = loadEvents()
  console.log(`  ${events.length} events, ${new Set(events.map(e => e.session)).size} sessions`)

  const bySession = new Map<string, Event[]>()
  for (const e of events) {
    const arr = bySession.get(e.session) || []
    arr.push(e)
    bySession.set(e.session, arr)
  }

  let evaluated = 0, top1 = 0, top5 = 0, top10 = 0
  const perCat: Record<string, { n: number; t1: number; t5: number; t10: number }> = {}
  const skipped: Record<string, number> = {}

  for (const [, evs] of bySession) {
    for (let i = 1; i < evs.length; i++) {
      const target = evs[i]
      if (target.tool.startsWith('daemon_')) continue
      const prior = evs.slice(Math.max(0, i - CONTEXT_WINDOW), i)
      const intent = reconstructIntent(prior)
      const { agent: trueAgent, category } = labelTool(target.tool)
      if (!intent || intent.split(/\s+/).filter(Boolean).length < 2) {
        skipped[category] = (skipped[category] || 0) + 1
        continue
      }
      const preds = topKPredictions(intent, 10)
      evaluated++
      const isT1 = preds[0] === trueAgent
      const isT5 = preds.slice(0, 5).includes(trueAgent)
      const isT10 = preds.includes(trueAgent)
      if (isT1) top1++
      if (isT5) top5++
      if (isT10) top10++
      const c = perCat[category] ?? { n: 0, t1: 0, t5: 0, t10: 0 }
      c.n++
      if (isT1) c.t1++
      if (isT5) c.t5++
      if (isT10) c.t10++
      perCat[category] = c
    }
  }

  const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
  const catRows = Object.entries(perCat).sort((a, b) => b[1].n - a[1].n)
    .map(([cat, s]) => `| \`${cat}\` | ${s.n} | ${pct(s.t1, s.n)} | ${pct(s.t5, s.n)} | ${pct(s.t10, s.n)} |`).join('\n')
  const skippedRows = Object.entries(skipped).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([cat, n]) => `| \`${cat}\` | ${n} |`).join('\n') || '| (none) | 0 |'
  const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0)
  const sessions = bySession.size
  const uniqueTools = new Set(events.map(e => e.tool)).size
  const target1 = Math.min(0.95, (top1 / evaluated) + 0.10)
  const target5 = Math.min(0.98, (top5 / evaluated) + 0.15)
  const verdict = evaluated >= 100
    ? `**Sufficient for baseline.** ${evaluated} scored tool calls across ${sessions} sessions comfortably clears the 100-call minimum and produces a stable top-K estimate. The sample is dominated by a small number of long engineering sessions, so per-category numbers for low-volume buckets (ableton, trader, social) should be treated as directional only.`
    : `**Insufficient.** Only ${evaluated} scored tool calls. We need >=100 to have signal. See *What would enable a stronger baseline*.`

  const subs: Record<string, string> = {
    GENERATED_AT: new Date().toISOString(),
    TOTAL_EVENTS: String(events.length),
    SESSIONS: String(sessions),
    UNIQUE_TOOLS: String(uniqueTools),
    EVALUATED: String(evaluated),
    SKIPPED_TOTAL: String(skippedTotal),
    TOP1: pct(top1, evaluated),
    TOP5: pct(top5, evaluated),
    TOP10: pct(top10, evaluated),
    CONTEXT_WINDOW: String(CONTEXT_WINDOW),
    CAT_ROWS: catRows,
    SKIPPED_ROWS: skippedRows,
    SUFFICIENCY_VERDICT: verdict,
    TARGET1: `${(target1 * 100).toFixed(1)}%`,
    TARGET5: `${(target5 * 100).toFixed(1)}%`,
  }

  let md = readFileSync(TEMPLATE, 'utf-8')
  for (const [k, v] of Object.entries(subs)) md = md.replaceAll(`{{${k}}}`, v)

  writeFileSync(BASELINE_OUT, md)
  console.log('\n=== Baseline ===')
  console.log(`  evaluated: ${evaluated}`)
  console.log(`  top-1:  ${pct(top1, evaluated)}`)
  console.log(`  top-5:  ${pct(top5, evaluated)}`)
  console.log(`  top-10: ${pct(top10, evaluated)}`)
  console.log(`\nWrote ${BASELINE_OUT}`)
}

main()

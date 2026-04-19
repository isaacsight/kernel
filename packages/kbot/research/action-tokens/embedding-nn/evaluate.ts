// evaluate.ts — 10-fold session-level CV of embedding-NN vs router baseline.
// Reuses cached per-event embeddings (from embed.ts) as both the train index AND the query vector.
// Ground-truth label per event = actual tool observed. Category mapping mirrors baseline-measure.ts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEmbeddingsCache, VectorIndex } from './index.ts'
import type { EmbeddedEvent } from './embed.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(HERE, '_cache/embeddings.jsonl')
const META_FILE = join(HERE, '_cache/meta.json')
const RESULTS_FILE = join(HERE, 'RESULTS.md')
const FOLDS = 10
const K_NEIGHBORS = 20

// Mirror baseline-measure.ts labelTool() category logic exactly.
function categoryOf(tool: string): string {
  const t = tool.toLowerCase()
  if (['read','edit','write','multiedit','notebookedit'].includes(t)) return 'file-ops'
  if (['grep','glob','toolsearch'].includes(t)) return 'search'
  if (t === 'bash') return 'shell'
  if (t === 'task' || t === 'taskupdate') return 'planning'
  if (t === 'agent') return 'delegation'
  if (t === 'websearch' || t === 'webfetch') return 'web'
  if (t.includes('ableton') || t.includes('serum') || t.includes('dj_set') ||
      t.includes('drum') || t.includes('melody') || t.includes('beat')) return 'ableton'
  if (t.includes('git_') || t.includes('github')) return 'git'
  if (t.includes('stock') || t.includes('crypto') || t.includes('wallet') ||
      t.includes('market') || t.includes('portfolio') || t.includes('defi')) return 'finance'
  if (t.includes('paper') || t.includes('arxiv') || t.includes('pubmed') ||
      t.includes('research') || t.includes('literature')) return 'research'
  if (t.includes('gene') || t.includes('protein') || t.includes('blast') ||
      t.includes('compound') || t.includes('reaction') || t.includes('quantum') ||
      t.includes('molecule')) return 'science'
  if (t.includes('brain') || t.includes('eeg') || t.includes('neuro') ||
      t.includes('cognitive')) return 'neuro'
  if (t.includes('epidem') || t.includes('vaccin') || t.includes('disease') ||
      t.includes('sir_model')) return 'epi'
  if (t.startsWith('daemon_')) return 'daemon'
  if (t.includes('computer-use') || t.includes('screenshot') || t.includes('mouse') ||
      t.includes('keyboard') || t.includes('click')) return 'computer-use'
  if (t.includes('browser_') || t.includes('playwright')) return 'browser'
  if (t.includes('social') || t.includes('stream') || t.includes('content')) return 'social'
  if (t.includes('memory') || t.includes('graph_') || t.includes('dream') ||
      t.includes('learning_')) return 'memory'
  if (t.includes('ollama') || t.includes('local_') || t.includes('kbot_local')) return 'local-ai'
  if (t.includes('mcp_') || t.includes('composio') || t.includes('forge_') ||
      t.includes('plugin_')) return 'mcp-ops'
  return 'other'
}

function rankedPredictions(index: VectorIndex, qVec: Float32Array, k: number, excludeSession: string): string[] {
  const neighbors = index.query(qVec, k, excludeSession)
  const votes = new Map<string, { count: number; score: number }>()
  for (const n of neighbors) {
    const e = votes.get(n.tool) ?? { count: 0, score: 0 }
    e.count += 1; e.score += Math.max(0, n.score)
    votes.set(n.tool, e)
  }
  return [...votes.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].score - a[1].score)
    .map(([t]) => t)
}

function topKHit(ranked: string[], truth: string, k: number): boolean {
  return ranked.slice(0, k).some(t => t === truth)
}

// Fold assignment by session id (deterministic hash)
function foldOf(sid: string, folds: number): number {
  let h = 2166136261
  for (let i = 0; i < sid.length; i++) { h ^= sid.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h) % folds
}

// Baseline numbers from BASELINE.md (for side-by-side table). Hand-copied.
const ROUTER_BASELINE = {
  overall: { t1: 0.518, t5: 0.918, t10: 1.000 },
  perCat: {
    'file-ops':     { n: 7573, t1: 0.644, t5: 0.975 },
    'shell':        { n: 5443, t1: 0.613, t5: 0.969 },
    'search':       { n: 2240, t1: 0.562, t5: 0.972 },
    'web':          { n: 1462, t1: 0.000, t5: 0.768 },
    'ableton':      { n:  962, t1: 0.000, t5: 0.992 },
    'computer-use': { n:  444, t1: 0.739, t5: 0.748 },
    'other':        { n:  437, t1: 0.192, t5: 0.405 },
    'delegation':   { n:  412, t1: 0.432, t5: 0.529 },
    'planning':     { n:  221, t1: 0.000, t5: 0.760 },
    'mcp-ops':      { n:  194, t1: 0.567, t5: 0.959 },
    'science':      { n:  182, t1: 0.000, t5: 0.000 },
    'browser':      { n:   95, t1: 0.400, t5: 1.000 },
    'memory':       { n:   72, t1: 0.069, t5: 0.361 },
    'git':          { n:   52, t1: 0.481, t5: 1.000 },
    'social':       { n:    2, t1: 0.000, t5: 1.000 },
  } as Record<string, { n: number; t1: number; t5: number }>
}

async function main() {
  if (!existsSync(CACHE_FILE)) {
    console.error(`Missing cache: ${CACHE_FILE}. Run \`npx tsx embed.ts\` first.`); process.exit(1)
  }
  const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf-8')) : { backend: 'unknown' }
  const all = loadEmbeddingsCache(CACHE_FILE)
  console.log(`Loaded ${all.length} embeddings (backend=${meta.backend})`)

  // Skip idx=0 events (no prior context — fair comparison to baseline which also skips these).
  const evs = all.filter(e => e.idx > 0)
  console.log(`Evaluable events (with prior context): ${evs.length}`)

  const sessions = [...new Set(evs.map(e => e.session))]
  console.log(`Sessions: ${sessions.length}, folds: ${FOLDS}`)

  // Per-fold metrics
  let totalN = 0, totalT1 = 0, totalT5 = 0, totalT10 = 0
  const perCat: Record<string, { n: number; t1: number; t5: number; t10: number }> = {}
  const latencies: number[] = []
  const tEval0 = Date.now()

  for (let fold = 0; fold < FOLDS; fold++) {
    const train: EmbeddedEvent[] = []
    const test: EmbeddedEvent[] = []
    for (const e of evs) {
      if (foldOf(e.session, FOLDS) === fold) test.push(e); else train.push(e)
    }
    if (test.length === 0) continue
    const index = new VectorIndex()
    for (const e of train) index.add({ id: e.id, tool: e.tool, session: e.session, vec: e.vec })

    let n = 0, t1 = 0, t5 = 0, t10 = 0
    for (const e of test) {
      const qv = new Float32Array(e.vec)
      const tQ0 = Date.now()
      const ranked = rankedPredictions(index, qv, K_NEIGHBORS, e.session)
      latencies.push(Date.now() - tQ0)
      const truth = e.tool
      const cat = categoryOf(truth)
      const c = perCat[cat] ?? { n: 0, t1: 0, t5: 0, t10: 0 }
      c.n += 1
      if (topKHit(ranked, truth, 1)) { t1++; c.t1++ }
      if (topKHit(ranked, truth, 5)) { t5++; c.t5++ }
      if (topKHit(ranked, truth, 10)) { t10++; c.t10++ }
      perCat[cat] = c
      n++
    }
    totalN += n; totalT1 += t1; totalT5 += t5; totalT10 += t10
    console.log(`  fold ${fold}: test=${n}  top-1=${(t1/n*100).toFixed(1)}%  top-5=${(t5/n*100).toFixed(1)}%  top-10=${(t10/n*100).toFixed(1)}%`)
  }
  const elapsed = ((Date.now() - tEval0) / 1000)
  console.log(`Total eval time: ${elapsed.toFixed(1)}s`)

  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.50)] ?? 0
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0

  const nnOverall = { t1: totalT1 / totalN, t5: totalT5 / totalN, t10: totalT10 / totalN }

  // Build RESULTS.md
  const lines: string[] = []
  lines.push('# Embedding-NN tool predictor — results')
  lines.push('')
  lines.push(`**Generated:** ${new Date().toISOString()}`)
  lines.push(`**Embedding backend:** ${meta.backend}${meta.backend === 'hash' ? ' (Ollama unavailable, hash-word-bag fallback used — see caveat)' : ' (nomic-embed-text via Ollama)'}`)
  lines.push(`**Data:** ${all.length} embedded events, ${evs.length} evaluable (idx>0), ${sessions.length} sessions`)
  lines.push(`**CV:** ${FOLDS}-fold by session (whole sessions kept in train or test)`)
  lines.push(`**K-neighbors per query:** ${K_NEIGHBORS}`)
  lines.push(`**Total eval wall time:** ${elapsed.toFixed(1)}s`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Overall')
  lines.push('')
  lines.push('| Metric | Router baseline | Embedding-NN | Delta |')
  lines.push('|---|---:|---:|---:|')
  lines.push(`| Top-1 | ${(ROUTER_BASELINE.overall.t1*100).toFixed(1)}% | ${(nnOverall.t1*100).toFixed(1)}% | ${((nnOverall.t1-ROUTER_BASELINE.overall.t1)*100).toFixed(1)} pts |`)
  lines.push(`| Top-5 | ${(ROUTER_BASELINE.overall.t5*100).toFixed(1)}% | ${(nnOverall.t5*100).toFixed(1)}% | ${((nnOverall.t5-ROUTER_BASELINE.overall.t5)*100).toFixed(1)} pts |`)
  lines.push(`| Top-10 | ${(ROUTER_BASELINE.overall.t10*100).toFixed(1)}% | ${(nnOverall.t10*100).toFixed(1)}% | ${((nnOverall.t10-ROUTER_BASELINE.overall.t10)*100).toFixed(1)} pts |`)
  lines.push('')
  lines.push('**Ship bar (from BASELINE.md):** Top-1 ≥ 61.8%, Top-5 ≥ 98.0%.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Per-category (embedding-NN)')
  lines.push('')
  lines.push('| Category | Samples | NN Top-1 | NN Top-5 | NN Top-10 | Router Top-1 | Router Top-5 | ΔTop-1 | ΔTop-5 |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  const cats = Object.keys(perCat).sort((a, b) => perCat[b].n - perCat[a].n)
  for (const cat of cats) {
    const c = perCat[cat]
    const rb = ROUTER_BASELINE.perCat[cat]
    const rb1 = rb ? (rb.t1*100).toFixed(1)+'%' : '—'
    const rb5 = rb ? (rb.t5*100).toFixed(1)+'%' : '—'
    const d1 = rb ? ((c.t1/c.n - rb.t1)*100).toFixed(1) + ' pts' : '—'
    const d5 = rb ? ((c.t5/c.n - rb.t5)*100).toFixed(1) + ' pts' : '—'
    lines.push(`| \`${cat}\` | ${c.n} | ${(c.t1/c.n*100).toFixed(1)}% | ${(c.t5/c.n*100).toFixed(1)}% | ${(c.t10/c.n*100).toFixed(1)}% | ${rb1} | ${rb5} | ${d1} | ${d5} |`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Inference latency (cosine query over ~20K vectors, single thread)')
  lines.push('')
  lines.push(`| Percentile | Latency |`)
  lines.push(`|---|---:|`)
  lines.push(`| p50 | ${p50} ms |`)
  lines.push(`| p95 | ${p95} ms |`)
  lines.push(`| total queries | ${latencies.length} |`)
  lines.push('')
  lines.push('Note: these are **query-only** latencies (vector already computed). End-to-end prediction latency adds the embedding call — ~20–40 ms for nomic-embed-text via local Ollama, ~0.1 ms for hash fallback.')
  lines.push('')
  lines.push('---')
  lines.push('')

  // Verdict
  const t1Delta = nnOverall.t1 - ROUTER_BASELINE.overall.t1
  const t5Delta = nnOverall.t5 - ROUTER_BASELINE.overall.t5
  const t1ShipBar = 0.618, t5ShipBar = 0.980
  const beatsShipBar = nnOverall.t1 >= t1ShipBar && nnOverall.t5 >= t5ShipBar
  const beats2pt = t1Delta >= 0.02 || t5Delta >= 0.02

  lines.push('## Ship / no-ship verdict')
  lines.push('')
  let verdict: string
  if (beatsShipBar) {
    verdict = '**SHIP.** Embedding-NN clears both ship-bar thresholds. Integration path below.'
  } else if (beats2pt) {
    verdict = '**CONDITIONAL SHIP.** Beats router baseline by ≥2 pts on at least one headline metric but does not clear the full ship bar. Ship as an opt-in alternate routing path (flag-gated) and collect real-world wins/losses before making it default.'
  } else if (Math.abs(t1Delta) < 0.005 && Math.abs(t5Delta) < 0.005) {
    verdict = '**NO SHIP — marginal.** Embedding-NN ties the router within rounding. The router is ~50 LOC, zero deps, 0 ms compile. Not worth the embedding-model dep + 274 MB on disk + 20–40 ms per call for a tie.'
  } else {
    verdict = '**KILL THE BET.** Embedding-NN underperforms the router. The router\'s keyword-vote cascade is genuinely hard to beat on this data because the ground-truth labels are rule-derived from the same keyword vocabulary — it\'s an almost self-consistent baseline. An NN over intent-text embeddings does not clear that bar. Do not invest further in this retrieval-only approach; if we want better routing, the next bet should be a trained classifier with real user turns (not reconstructed intent), or outcome-weighted training (routing-history.json).'
  }
  lines.push(verdict)
  lines.push('')
  lines.push('### Reasoning')
  lines.push('')
  lines.push(`- Top-1 delta: **${(t1Delta*100).toFixed(1)} pts** (NN ${(nnOverall.t1*100).toFixed(1)}% vs router ${(ROUTER_BASELINE.overall.t1*100).toFixed(1)}%)`)
  lines.push(`- Top-5 delta: **${(t5Delta*100).toFixed(1)} pts** (NN ${(nnOverall.t5*100).toFixed(1)}% vs router ${(ROUTER_BASELINE.overall.t5*100).toFixed(1)}%)`)
  lines.push(`- Ship bar Top-1 ≥ 61.8%: ${nnOverall.t1 >= t1ShipBar ? 'PASS' : 'FAIL'}`)
  lines.push(`- Ship bar Top-5 ≥ 98.0%: ${nnOverall.t5 >= t5ShipBar ? 'PASS' : 'FAIL'}`)
  lines.push('')
  // Per-category wins/losses
  const nnWins: string[] = [], routerWins: string[] = [], ties: string[] = []
  for (const cat of cats) {
    const c = perCat[cat]; const rb = ROUTER_BASELINE.perCat[cat]; if (!rb) continue
    const dT5 = c.t5/c.n - rb.t5
    if (dT5 > 0.02) nnWins.push(`${cat} (+${(dT5*100).toFixed(1)} pts Top-5)`)
    else if (dT5 < -0.02) routerWins.push(`${cat} (${(dT5*100).toFixed(1)} pts Top-5)`)
    else ties.push(cat)
  }
  lines.push(`- NN wins on Top-5 (>2 pt): ${nnWins.join(', ') || 'none'}`)
  lines.push(`- Router wins on Top-5 (>2 pt): ${routerWins.join(', ') || 'none'}`)
  lines.push(`- Ties: ${ties.join(', ') || 'none'}`)
  lines.push('')
  lines.push('### Biggest weakness of this approach')
  lines.push('')
  lines.push('The intent-text we embed is **reconstructed from prior tool arguments**, not from a real user message. The observer log doesn\'t persist user turns, so the NN is retrieving on the same signal the baseline consumes — any lift is from "similar arg text → similar next tool" dynamics, not from true intent. Against a rule-derived label using the same vocabulary, that ceiling is narrow. To widen it, persist user messages in the observer stream and re-run.')
  lines.push('')
  if (beatsShipBar || beats2pt) {
    lines.push('### Integration path (if shipping)')
    lines.push('')
    lines.push('1. Add `~/.kbot/embeddings/index.bin` built at daemon idle time (every 8 h via existing embedding task).')
    lines.push('2. New flag: `--router=embedding` in `cli.ts`. Default remains `learned` until field data accumulates.')
    lines.push('3. Warm-start from cached embeddings.jsonl on first use.')
    lines.push('4. Log prediction vs actual to `routing-history.json` for outcome-weighted re-training.')
    lines.push('5. Consider HNSW (hnswlib-node) if N grows > 100K; at 20K brute-force is fine.')
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('## Reproducibility')
  lines.push('')
  lines.push('```bash')
  lines.push('cd packages/kbot/research/action-tokens/embedding-nn')
  lines.push('npx tsx embed.ts       # embed all events, cached to _cache/embeddings.jsonl')
  lines.push('npx tsx evaluate.ts    # 10-fold CV, rewrites RESULTS.md')
  lines.push('```')
  lines.push('')
  writeFileSync(RESULTS_FILE, lines.join('\n'))
  console.log(`\nWrote ${RESULTS_FILE}`)
  console.log(`\nHEADLINE: NN top-1=${(nnOverall.t1*100).toFixed(1)}%  top-5=${(nnOverall.t5*100).toFixed(1)}%  top-10=${(nnOverall.t10*100).toFixed(1)}%`)
  console.log(`          Router baseline: top-1=${(ROUTER_BASELINE.overall.t1*100).toFixed(1)}%  top-5=${(ROUTER_BASELINE.overall.t5*100).toFixed(1)}%`)
  console.log(`          Verdict: ${verdict.split('\n')[0]}`)
}

main().catch(e => { console.error(e); process.exit(1) })

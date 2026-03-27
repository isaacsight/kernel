// kbot Learned Router — MasRouter-style Cascaded Routing
//
// Based on MasRouter (ACL 2025): instead of calling an LLM to classify
// intent every time, learn from actual routing outcomes and cascade
// through increasingly expensive classifiers:
//
//   1.   Exact intent match (free, instant)
//   1.5  Bayesian skill rating — OpenSkill mu/sigma per agent per category
//   2.   Keyword voting (free, instant)
//   3.   Category fallback (free, instant)
//   4.   LLM classifier (expensive, last resort)
//
// Over time, steps 1-2 handle 90%+ of messages without any API call.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { CREATIVE_KEYWORDS, CREATIVE_PATTERNS } from './agents/creative.js'
import { DEVELOPER_KEYWORDS, DEVELOPER_PATTERNS } from './agents/developer.js'
import { TRADER_KEYWORDS, TRADER_PATTERNS } from './agents/trader.js'
import { getSkillRatingSystem } from './skill-rating.js'

const ROUTER_DIR = join(homedir(), '.kbot', 'memory')
const HISTORY_FILE = join(ROUTER_DIR, 'routing-history.json')
const MAX_HISTORY = 500

/** A recorded routing decision */
export interface RoutingRecord {
  /** Normalized intent string */
  intent: string
  /** Keywords extracted from the message */
  keywords: string[]
  /** Which agent was selected */
  agent: string
  /** How the route was determined: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm' */
  method: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm'
  /** Was the routing successful (user didn't override) */
  success: boolean
  /** Times this exact route has been used */
  count: number
  /** Last used */
  lastUsed: string
}

/** Routing result from the cascaded classifier */
export interface RouteResult {
  /** Selected agent */
  agent: string
  /** Confidence 0-1 */
  confidence: number
  /** Which cascade level resolved it */
  method: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm'
  /** Was this a cache hit (no LLM needed) */
  cached: boolean
}

function ensureDir(): void {
  if (!existsSync(ROUTER_DIR)) mkdirSync(ROUTER_DIR, { recursive: true })
}

let history: RoutingRecord[] = []
let loaded = false

function loadHistory(): void {
  if (loaded) return
  loaded = true
  try {
    if (existsSync(HISTORY_FILE)) {
      history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
    }
  } catch { history = [] }
}

function saveHistory(): void {
  ensureDir()
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, MAX_HISTORY), null, 2))
  } catch { /* non-critical */ }
}

// ── Stop words for normalization ──
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'it', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'you', 'your', 'he', 'she', 'they',
  'them', 'and', 'or', 'but', 'not', 'so', 'if', 'then', 'please',
])

function normalizeIntent(message: string): string {
  return message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .join(' ')
}

// ── Agent keyword maps ──
// These are the learned keyword→agent associations. They start with
// reasonable defaults and improve as routing history accumulates.

const AGENT_KEYWORDS: Record<string, string[]> = {
  coder: [
    'code', 'function', 'class', 'bug', 'error', 'fix', 'implement', 'build',
    'create', 'write', 'typescript', 'javascript', 'python', 'rust', 'react',
    'component', 'test', 'refactor', 'api', 'endpoint', 'database', 'sql',
    'npm', 'install', 'package', 'import', 'export', 'async', 'type',
    'interface', 'module', 'compile', 'lint', 'debug', 'crash', 'exception',
  ],
  researcher: [
    'research', 'find', 'search', 'compare', 'alternatives', 'benchmark',
    'documentation', 'docs', 'article', 'paper', 'study', 'analyze',
    'investigate', 'explore', 'discover', 'learn', 'understand', 'explain',
    'difference', 'versus', 'pros', 'cons', 'tradeoff', 'best practice',
  ],
  writer: [
    'write', 'draft', 'blog', 'post', 'article', 'email', 'message',
    'readme', 'documentation', 'changelog', 'announcement', 'copy',
    'content', 'marketing', 'social', 'tweet', 'thread', 'newsletter',
    'story', 'essay', 'summary', 'summarize', 'edit', 'proofread',
  ],
  analyst: [
    'analyze', 'strategy', 'plan', 'architecture', 'design', 'review',
    'audit', 'evaluate', 'assess', 'optimize', 'performance', 'cost',
    'pricing', 'business', 'metric', 'dashboard', 'report', 'insight',
    'decision', 'tradeoff', 'priority', 'roadmap',
  ],
  kernel: [
    'hey', 'hello', 'hi', 'thanks', 'help', 'what', 'how', 'why',
    'general', 'chat', 'talk', 'opinion', 'think', 'feel', 'advice',
  ],
  scientist: [
    // Biology
    'gene', 'protein', 'genome', 'dna', 'rna', 'cell', 'enzyme', 'mutation',
    'pathway', 'blast', 'pubmed', 'clinical', 'trial', 'drug', 'pharmacology',
    'ecology', 'species', 'taxonomy', 'biodiversity',
    // Chemistry
    'molecule', 'compound', 'reaction', 'element', 'periodic', 'stoichiometry',
    'thermodynamics', 'spectroscopy', 'crystal', 'material', 'polymer',
    // Physics
    'orbit', 'quantum', 'relativity', 'circuit', 'electromagnetic', 'beam',
    'fluid', 'particle', 'photon', 'quark', 'signal',
    // Earth science
    'earthquake', 'climate', 'volcano', 'ocean', 'soil', 'satellite',
    'geological', 'seismic', 'atmosphere',
    // Math & statistics
    'matrix', 'eigenvalue', 'differential', 'fourier', 'optimization',
    'regression', 'bayesian', 'statistics', 'probability', 'hypothesis',
    'anova', 'survival',
    // General science
    'experiment', 'laboratory', 'methodology', 'preprint', 'citation',
    'sample', 'p-value', 'confidence',
  ],
  neuroscientist: [
    'brain', 'neuron', 'cortex', 'eeg', 'fmri', 'synapse', 'neurotransmitter',
    'hippocampus', 'amygdala', 'prefrontal', 'cognitive', 'neural', 'dopamine',
    'serotonin', 'psychophysics', 'connectome', 'brodmann', 'neuroimaging',
    'mni', 'erp', 'brainwave', 'thalamus', 'cerebellum', 'cortical',
  ],
  social_scientist: [
    'psychometric', 'survey', 'social network', 'game theory', 'econometric',
    'inequality', 'gini', 'demographic', 'sentiment', 'voting', 'election',
    'behavioral experiment', 'discourse', 'effect size', 'likert', 'anova',
    'population', 'census', 'migration', 'poverty', 'disparity',
  ],
  philosopher: [
    'logic', 'argument', 'fallacy', 'ethics', 'moral', 'deontology',
    'consequentialism', 'virtue', 'epistemology', 'ontology', 'metaphysics',
    'syllogism', 'premise', 'conclusion', 'valid', 'sound', 'categorical',
    'philosophical', 'existential', 'phenomenology',
  ],
  epidemiologist: [
    'epidemic', 'pandemic', 'outbreak', 'sir model', 'vaccination', 'vaccine',
    'incidence', 'prevalence', 'mortality', 'morbidity', 'surveillance',
    'public health', 'epidemiology', 'herd immunity', 'contact tracing',
    'quarantine', 'disease', 'pathogen', 'infection', 'transmission',
  ],
  linguist: [
    'phonetics', 'phonology', 'morphology', 'syntax', 'semantics', 'pragmatics',
    'ipa', 'corpus', 'typology', 'stylometry', 'authorship', 'dialect',
    'sociolinguistic', 'lexicon', 'grammar', 'linguistic', 'language family',
    'consonant', 'vowel', 'prosody',
  ],
  historian: [
    'archive', 'archival', 'timeline', 'historical', 'century', 'era',
    'civilization', 'primary source', 'manuscript', 'chronicle', 'dynasty',
    'historiography', 'periodization', 'antiquity', 'medieval', 'colonial',
    'revolution', 'empire', 'ancient', 'archaeology',
  ],
  creative: CREATIVE_KEYWORDS,
  developer: DEVELOPER_KEYWORDS,
  trader: TRADER_KEYWORDS,
}

// ── Category patterns (broader than keywords) ──
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; agent: string; confidence: number }> = [
  { pattern: /\b(fix|bug|error|crash|broken|fail|debug|issue)\b/i, agent: 'coder', confidence: 0.7 },
  { pattern: /\b(create|build|implement|scaffold|generate|add|new)\b.*\b(function|component|file|module|api|page|route)\b/i, agent: 'coder', confidence: 0.75 },
  { pattern: /\b(refactor|clean|reorganize|restructure|simplify|extract)\b/i, agent: 'coder', confidence: 0.7 },
  { pattern: /\b(test|spec|coverage|assert|mock|stub)\b/i, agent: 'coder', confidence: 0.65 },
  { pattern: /\b(deploy|ship|release|publish|ci|cd|pipeline)\b/i, agent: 'coder', confidence: 0.6 },
  { pattern: /\b(research|find|compare|benchmark|alternative|best)\b/i, agent: 'researcher', confidence: 0.6 },
  { pattern: /\b(write|draft|blog|post|article|email|newsletter|readme)\b/i, agent: 'writer', confidence: 0.65 },
  { pattern: /\b(analyze|strategy|plan|architecture|review|audit|evaluate)\b/i, agent: 'analyst', confidence: 0.6 },
  { pattern: /\b(gene|protein|genome|dna|rna|enzyme|mutation|blast|pubmed|clinical trial|pharmacology|ecology|taxonomy|biodiversity)\b/i, agent: 'scientist', confidence: 0.85 },
  { pattern: /\b(molecule|compound|reaction|element|stoichiometry|spectroscopy|crystal|thermodynamics|polymer)\b/i, agent: 'scientist', confidence: 0.8 },
  { pattern: /\b(quantum|relativity|electromagnetic|photon|quark|particle physics|orbit|fluid dynamics)\b/i, agent: 'scientist', confidence: 0.8 },
  { pattern: /\b(earthquake|volcano|seismic|geological|climate data|satellite imagery|ocean data|atmosphere)\b/i, agent: 'scientist', confidence: 0.75 },
  { pattern: /\b(eigenvalue|differential equation|fourier|matrix operations|number theory|graph theory|combinatorics)\b/i, agent: 'scientist', confidence: 0.75 },
  { pattern: /\b(regression analysis|bayesian inference|anova|survival analysis|time series|dimensionality reduction|p-value|confidence interval)\b/i, agent: 'scientist', confidence: 0.7 },
  { pattern: /\b(experiment design|hypothesis test|sample size|research methodology|preprint|citation graph)\b/i, agent: 'scientist', confidence: 0.7 },
  { pattern: /\b(brain|neuron|cortex|eeg|fmri|synapse|neurotransmitter|hippocampus|amygdala|prefrontal|connectome|neuroimaging)\b/i, agent: 'neuroscientist', confidence: 0.85 },
  { pattern: /\b(psychophysics|brodmann|erp|brainwave|cerebellum|thalamus|somatosensory|visual cortex|motor cortex)\b/i, agent: 'neuroscientist', confidence: 0.8 },
  { pattern: /\b(psychometric|social network analysis|game theory|econometric|inequality|gini|demographic model|sentiment analysis|voting system)\b/i, agent: 'social_scientist', confidence: 0.85 },
  { pattern: /\b(survey design|effect size|behavioral experiment|discourse analysis|likert|census|migration pattern)\b/i, agent: 'social_scientist', confidence: 0.75 },
  { pattern: /\b(formal logic|syllogism|fallacy|deontology|consequentialism|virtue ethics|epistemology|ontology|metaphysics|phenomenology)\b/i, agent: 'philosopher', confidence: 0.85 },
  { pattern: /\b(argument map|ethical framework|moral dilemma|philosophical|premise.*conclusion)\b/i, agent: 'philosopher', confidence: 0.75 },
  { pattern: /\b(epidemic|pandemic|outbreak|sir model|vaccination|incidence|prevalence|epidemiology|herd immunity|disease surveillance)\b/i, agent: 'epidemiologist', confidence: 0.85 },
  { pattern: /\b(public health|mortality rate|morbidity|contact tracing|quarantine|pathogen|transmission rate|environmental health)\b/i, agent: 'epidemiologist', confidence: 0.75 },
  { pattern: /\b(phonetics|phonology|morphology|ipa transcription|corpus analysis|typology|stylometry|sociolinguistic|language family)\b/i, agent: 'linguist', confidence: 0.85 },
  { pattern: /\b(dialect|lexicon|prosody|consonant|vowel|syntactic|semantic|pragmatic)\b.*\b(analysis|study|research|pattern)\b/i, agent: 'linguist', confidence: 0.7 },
  { pattern: /\b(archival|primary source|manuscript|historiography|periodization|medieval|colonial|dynasty|ancient civilization)\b/i, agent: 'historian', confidence: 0.85 },
  { pattern: /\b(historical timeline|century|era|revolution|empire|archaeology|chronicle)\b/i, agent: 'historian', confidence: 0.7 },
  ...CREATIVE_PATTERNS,
  ...DEVELOPER_PATTERNS,
  ...TRADER_PATTERNS.map(pattern => ({ pattern, agent: 'trader' as const, confidence: 0.75 })),
]

/**
 * Cascaded route — try each level in order, return first confident match.
 *
 * Level 1:   Exact intent lookup (from history)
 * Level 1.5: Bayesian skill rating (OpenSkill mu/sigma)
 * Level 2:   Keyword voting (weighted by history frequency)
 * Level 3:   Category pattern matching
 * Level 4:   Returns null — caller should use LLM
 */
export function learnedRoute(message: string): RouteResult | null {
  loadHistory()

  const intent = normalizeIntent(message)
  if (!intent) return null

  // ── Level 1: Exact intent match ──
  const exactMatch = history.find(h => h.intent === intent && h.success && h.count >= 2)
  if (exactMatch) {
    return {
      agent: exactMatch.agent,
      confidence: Math.min(0.95, 0.7 + (exactMatch.count * 0.05)),
      method: 'learned',
      cached: true,
    }
  }

  // ── Level 1.5: Bayesian skill rating ──
  // Uses OpenSkill-style probabilistic ratings learned from routing outcomes.
  // Only activates once enough data has been collected (confidence > 0.4).
  const skillRating = getSkillRatingSystem()
  const skillResult = skillRating.getAgentForTask(message)
  if (skillResult && skillResult.confidence > 0.4) {
    return {
      agent: skillResult.agent,
      confidence: Math.min(0.9, skillResult.confidence),
      method: 'bayesian',
      cached: true,
    }
  }

  // ── Level 2: Keyword voting ──
  const intentWords = intent.split(' ')
  const votes: Record<string, number> = {}

  // Vote from built-in keyword maps
  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const matchCount = intentWords.filter(w => keywords.includes(w)).length
    if (matchCount > 0) {
      votes[agent] = (votes[agent] || 0) + matchCount
    }
  }

  // Boost votes from successful history
  for (const record of history) {
    if (!record.success) continue
    const recordWords = new Set(record.intent.split(' '))
    const overlap = intentWords.filter(w => recordWords.has(w)).length
    if (overlap >= 2) {
      votes[record.agent] = (votes[record.agent] || 0) + overlap * 0.5
    }
  }

  const topVote = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
  if (topVote && topVote[1] >= 3) {
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
    const confidence = topVote[1] / totalVotes
    if (confidence >= 0.5) {
      return {
        agent: topVote[0],
        confidence: Math.min(0.85, confidence),
        method: 'keyword',
        cached: true,
      }
    }
  }

  // ── Level 3: Category pattern matching ──
  for (const { pattern, agent, confidence } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) {
      return { agent, confidence, method: 'category', cached: true }
    }
  }

  // ── Level 4: No match — caller should use LLM ──
  return null
}

/**
 * Record a routing decision for future learning.
 * Call this after the agent responds (or when user overrides).
 */
export function recordRoute(
  message: string,
  agent: string,
  method: RouteResult['method'],
  success: boolean = true,
): void {
  loadHistory()

  const intent = normalizeIntent(message)
  if (!intent) return

  const keywords = intent.split(' ')
  const existing = history.find(h => h.intent === intent)

  if (existing) {
    if (success) {
      existing.agent = agent
      existing.success = true
      existing.count++
    } else {
      // Failed route — decrease count but don't delete
      existing.count = Math.max(0, existing.count - 1)
      if (existing.count === 0) existing.success = false
    }
    existing.method = method
    existing.lastUsed = new Date().toISOString()
  } else {
    history.push({
      intent,
      keywords,
      agent,
      method,
      success,
      count: 1,
      lastUsed: new Date().toISOString(),
    })
  }

  // Keep top records by count
  history.sort((a, b) => b.count - a.count)
  history = history.slice(0, MAX_HISTORY)
  saveHistory()

  // Update keyword maps from successful routes
  if (success) {
    updateKeywordMaps(keywords, agent)
  }
}

/** Dynamically grow keyword maps from observed routing */
function updateKeywordMaps(keywords: string[], agent: string): void {
  if (!AGENT_KEYWORDS[agent]) return

  const existing = new Set(AGENT_KEYWORDS[agent])
  for (const kw of keywords) {
    // Only add keywords that appear in multiple successful routes for this agent
    if (kw.length > 3 && !existing.has(kw)) {
      const kwRoutes = history.filter(h => h.success && h.agent === agent && h.keywords.includes(kw))
      if (kwRoutes.length >= 3) {
        AGENT_KEYWORDS[agent].push(kw)
        existing.add(kw)
      }
    }
  }

  // Cap keyword lists
  for (const agent of Object.keys(AGENT_KEYWORDS)) {
    if (AGENT_KEYWORDS[agent].length > 100) {
      AGENT_KEYWORDS[agent] = AGENT_KEYWORDS[agent].slice(0, 100)
    }
  }
}

/** Get routing stats */
export function getRoutingStats(): {
  totalRoutes: number
  learnedHits: number
  bayesianHits: number
  keywordHits: number
  categoryHits: number
  llmFallbacks: number
  cacheHitRate: string
} {
  loadHistory()

  const learned = history.filter(h => h.method === 'learned').length
  const bayesian = history.filter(h => h.method === 'bayesian').length
  const keyword = history.filter(h => h.method === 'keyword').length
  const category = history.filter(h => h.method === 'category').length
  const llm = history.filter(h => h.method === 'llm').length
  const total = history.length
  const cached = learned + bayesian + keyword + category
  const rate = total > 0 ? Math.round((cached / total) * 100) : 0

  return {
    totalRoutes: total,
    learnedHits: learned,
    bayesianHits: bayesian,
    keywordHits: keyword,
    categoryHits: category,
    llmFallbacks: llm,
    cacheHitRate: `${rate}%`,
  }
}

/** Override a route (user correction) */
export function overrideRoute(message: string, correctAgent: string): void {
  const intent = normalizeIntent(message)
  const existing = history.find(h => h.intent === intent)

  // Update Bayesian skill ratings: previous agent loses, correct agent wins
  const skillRating = getSkillRatingSystem()
  const category = skillRating.categorizeMessage(message)
  if (existing && existing.agent !== correctAgent) {
    skillRating.recordOutcome(existing.agent, category, 'loss')
  }
  skillRating.recordOutcome(correctAgent, category, 'win')
  skillRating.save().catch(() => { /* non-critical */ })

  if (existing) {
    existing.agent = correctAgent
    existing.success = true
    existing.count = Math.max(existing.count, 3) // Boost corrected routes
    existing.lastUsed = new Date().toISOString()
  } else {
    recordRoute(message, correctAgent, 'learned', true)
  }
  saveHistory()
}

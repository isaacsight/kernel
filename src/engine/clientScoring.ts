/**
 * Client Score Calculator
 *
 * Automatically computes a 0-100 score from real account data.
 * Triggered by the hidden "kernel.hat" command in chat.
 *
 * Score breakdown (100 points total):
 *   Engagement (20pts)  — message count, conversation count, frequency
 *   R&D (20pts)         — research depth, complexity, novel exploration
 *   Q&A (20pts)         — quality assurance, iteration efficiency, feedback
 *   Productivity (15pts)— files created, artifacts, images generated
 *   Depth (15pts)       — memory profile richness, KG entities
 *   Loyalty (10pts)     — account age, subscription status
 *
 * Pricing layers:
 *   1. Base fee + score value
 *   2. Market multiplier (detected from content + web research)
 *   3. Relevance multiplier (project focus)
 *   4. R&D complexity surcharge
 *   5. Tier surcharge
 */

import { supabase } from './SupabaseClient'
import { claudeText } from './ClaudeClient'

export const SCORING_TRIGGER = 'kernel.hat'
export const POINTS_TRIGGER = 'kernel.point'

export function isScoreTrigger(input: string): boolean {
  const lower = input.trim().toLowerCase()
  return lower === SCORING_TRIGGER || lower === POINTS_TRIGGER
}

export function isPointsTrigger(input: string): boolean {
  return input.trim().toLowerCase() === POINTS_TRIGGER
}

// ─── Pricing Constants ──────────────────────────────
const BASE_PROJECT_FEE = 2500
const SCORE_RATE = 75
const BILLING_THRESHOLD = 70
const PREMIUM_THRESHOLD = 80
const ELITE_THRESHOLD = 90
const STRIPE_TAX_RATE = 0.0875 // 8.75% (CA sales tax, LA County)
const STRIPE_PROCESSING_FEE = 0.029 // 2.9% Stripe processing
const STRIPE_FIXED_FEE = 30 // $0.30 fixed Stripe fee (in cents, but we work in dollars)

// Market multipliers
const MARKET_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  finance:      { multiplier: 1.8, label: 'Finance & Banking' },
  legal:        { multiplier: 1.6, label: 'Legal' },
  healthcare:   { multiplier: 1.5, label: 'Healthcare' },
  ai:           { multiplier: 1.5, label: 'AI & Machine Learning' },
  saas:         { multiplier: 1.4, label: 'SaaS & Technology' },
  crypto:       { multiplier: 1.4, label: 'Crypto & Web3' },
  ecommerce:    { multiplier: 1.3, label: 'E-Commerce' },
  realestate:   { multiplier: 1.3, label: 'Real Estate' },
  consulting:   { multiplier: 1.3, label: 'Consulting' },
  media:        { multiplier: 1.2, label: 'Creative & Media' },
  education:    { multiplier: 1.1, label: 'Education' },
  general:      { multiplier: 1.0, label: 'General' },
}

const MARKET_KEYWORDS: Record<string, string[]> = {
  finance:    ['finance', 'banking', 'investment', 'trading', 'portfolio', 'stock', 'hedge', 'fund', 'fintech', 'loan', 'mortgage', 'credit', 'insurance', 'wealth'],
  legal:      ['legal', 'law', 'attorney', 'contract', 'compliance', 'regulation', 'patent', 'trademark', 'litigation', 'court', 'arbitration'],
  healthcare: ['health', 'medical', 'patient', 'clinical', 'pharma', 'biotech', 'hospital', 'diagnosis', 'therapy', 'wellness', 'telemedicine'],
  ai:         ['ai', 'machine learning', 'neural', 'model', 'training', 'llm', 'gpt', 'claude', 'deep learning', 'nlp', 'computer vision', 'generative'],
  saas:       ['saas', 'software', 'platform', 'api', 'cloud', 'devops', 'infrastructure', 'microservice', 'backend', 'frontend', 'deploy', 'startup', 'mvp'],
  crypto:     ['crypto', 'blockchain', 'web3', 'defi', 'nft', 'token', 'ethereum', 'solana', 'bitcoin', 'wallet', 'dao', 'smart contract'],
  ecommerce:  ['ecommerce', 'e-commerce', 'shop', 'store', 'product', 'checkout', 'cart', 'inventory', 'marketplace', 'shopify', 'amazon', 'retail'],
  realestate: ['real estate', 'property', 'rental', 'tenant', 'lease', 'mortgage', 'listing', 'broker', 'commercial', 'residential'],
  consulting: ['consulting', 'strategy', 'advisory', 'management', 'operations', 'process', 'optimization', 'transformation', 'roadmap'],
  media:      ['design', 'creative', 'brand', 'content', 'video', 'music', 'art', 'media', 'marketing', 'campaign', 'social media', 'advertising'],
  education:  ['education', 'learning', 'course', 'student', 'teaching', 'curriculum', 'school', 'university', 'training', 'tutoring'],
}

// R&D complexity keywords
const RD_KEYWORDS = [
  'research', 'analyze', 'analysis', 'investigate', 'explore', 'prototype',
  'experiment', 'novel', 'innovative', 'architecture', 'design system',
  'algorithm', 'optimization', 'benchmark', 'evaluate', 'compare',
  'deep dive', 'strategy', 'framework', 'methodology', 'hypothesis',
  'feasibility', 'proof of concept', 'poc', 'whitepaper', 'technical',
  'complex', 'advanced', 'custom', 'bespoke', 'from scratch',
]

// Q&A quality keywords (positive indicators)
const QA_POSITIVE = [
  'works', 'perfect', 'great', 'thanks', 'thank you', 'exactly',
  'love it', 'amazing', 'awesome', 'good', 'nice', 'correct',
  'ship it', 'deploy', 'launch', 'done', 'approved',
]

// Q&A rework keywords (negative indicators — more rework = lower QA)
const QA_REWORK = [
  'fix', 'bug', 'broken', 'wrong', 'error', 'issue', 'not working',
  'redo', 'change', 'update', 'revise', 'again', 'try again',
  'doesn\'t work', 'failed', 'crash', 'regression',
]

// ─── Market Detection ───────────────────────────────

function detectMarket(
  entities: { name: string; entity_type: string }[],
  recentMessages: string[],
): { key: string; label: string; multiplier: number; confidence: number } {
  const corpus = [
    ...entities.map(e => e.name.toLowerCase()),
    ...recentMessages.map(m => m.toLowerCase()),
  ].join(' ')

  const hits: Record<string, number> = {}
  let totalHits = 0

  for (const [market, keywords] of Object.entries(MARKET_KEYWORDS)) {
    hits[market] = 0
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = corpus.match(regex)
      if (matches) {
        hits[market] += matches.length
        totalHits += matches.length
      }
    }
  }

  let topMarket = 'general'
  let topHits = 0
  for (const [market, count] of Object.entries(hits)) {
    if (count > topHits) {
      topHits = count
      topMarket = market
    }
  }

  const info = MARKET_MULTIPLIERS[topMarket] || MARKET_MULTIPLIERS.general
  const confidence = totalHits > 0 ? Math.min(topHits / totalHits, 1) : 0

  return { key: topMarket, label: info.label, multiplier: info.multiplier, confidence }
}

// ─── Web Research Layer ─────────────────────────────
// Uses Claude with web search to validate market rates

interface WebResearchResult {
  marketRate: string          // e.g. "$150-300/hr"
  rationale: string           // why this rate
  adjustedMultiplier: number  // web-informed adjustment (0.9-1.3)
}

async function webResearchMarketRate(
  marketLabel: string,
  projectTopics: string[],
): Promise<WebResearchResult> {
  try {
    const topicsStr = projectTopics.slice(0, 5).join(', ')
    const prompt = `You are a pricing analyst. Research current 2025-2026 consulting and project rates for the "${marketLabel}" industry, specifically for projects involving: ${topicsStr}.

Return ONLY a JSON object with these exact fields:
- "marketRate": typical hourly or project rate range as a string (e.g. "$200-400/hr" or "$15,000-50,000/project")
- "rationale": one sentence explaining the rate
- "adjustedMultiplier": a number between 0.9 and 1.3 representing how current market demand affects pricing (1.0 = normal, >1.0 = high demand, <1.0 = saturated)

JSON only, no markdown.`

    const result = await claudeText(prompt, {
      model: 'haiku',
      max_tokens: 300,
      web_search: true,
      feature: 'scoring',
    })

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        marketRate: parsed.marketRate || 'N/A',
        rationale: parsed.rationale || '',
        adjustedMultiplier: clamp(Number(parsed.adjustedMultiplier) || 1.0, 0.9, 1.3),
      }
    }
  } catch {
    // Web research is non-blocking — fall back gracefully
  }

  return { marketRate: 'N/A', rationale: 'Web research unavailable', adjustedMultiplier: 1.0 }
}

// ─── R&D Layer ──────────────────────────────────────
// Measures research & development complexity

interface RDScore {
  score: number          // 0-20
  complexity: string     // label
  complexityMultiplier: number // 1.0 - 1.4
}

function calculateRD(
  userMessages: string[],
  entities: { name: string; entity_type: string }[],
  conversationCount: number,
): RDScore {
  const corpus = userMessages.join(' ').toLowerCase()

  // Count R&D keyword hits
  let rdHits = 0
  for (const kw of RD_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = corpus.match(regex)
    if (matches) rdHits += matches.length
  }

  // Unique entity types = breadth of research
  const uniqueTypes = new Set(entities.map(e => e.entity_type)).size

  // R&D density: hits per conversation
  const rdDensity = conversationCount > 0 ? rdHits / conversationCount : 0

  // Score components (0-20 total)
  const hitScore = clamp(Math.log2(rdHits + 1) / Math.log2(31) * 10, 0, 10)    // 0-10 from keyword hits
  const breadthScore = clamp(uniqueTypes / 8 * 5, 0, 5)                          // 0-5 from entity type diversity
  const densityScore = clamp(rdDensity / 3 * 5, 0, 5)                            // 0-5 from R&D density

  const score = Math.round(hitScore + breadthScore + densityScore)

  let complexity: string
  let complexityMultiplier: number

  if (score >= 16) {
    complexity = 'Deep R&D'
    complexityMultiplier = 1.4
  } else if (score >= 12) {
    complexity = 'Significant R&D'
    complexityMultiplier = 1.25
  } else if (score >= 8) {
    complexity = 'Moderate R&D'
    complexityMultiplier = 1.15
  } else if (score >= 4) {
    complexity = 'Light R&D'
    complexityMultiplier = 1.05
  } else {
    complexity = 'Minimal R&D'
    complexityMultiplier = 1.0
  }

  return { score, complexity, complexityMultiplier }
}

// ─── Q&A Layer ──────────────────────────────────────
// Measures quality assurance — iteration efficiency and satisfaction

interface QAScore {
  score: number         // 0-20
  grade: string         // label
  iterationEfficiency: number // 0-1 (higher = fewer reworks needed)
}

function calculateQA(
  userMessages: string[],
  helpfulCount: number,
  poorCount: number,
  totalSignals: number,
): QAScore {
  const corpus = userMessages.join(' ').toLowerCase()

  // Count positive vs rework signals from message content
  let positiveHits = 0
  let reworkHits = 0

  for (const kw of QA_POSITIVE) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = corpus.match(regex)
    if (matches) positiveHits += matches.length
  }

  for (const kw of QA_REWORK) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = corpus.match(regex)
    if (matches) reworkHits += matches.length
  }

  // Iteration efficiency: ratio of positive to rework signals (0-1)
  const totalContentSignals = positiveHits + reworkHits
  const iterationEfficiency = totalContentSignals > 0
    ? positiveHits / totalContentSignals
    : 0.5 // neutral default

  // Feedback ratio from explicit thumbs up/down
  const feedbackRatio = totalSignals > 0
    ? helpfulCount / totalSignals
    : 0.5

  // Score components (0-20 total)
  const efficiencyScore = clamp(iterationEfficiency * 10, 0, 10)  // 0-10
  const feedbackPts = clamp(feedbackRatio * 7, 0, 7)              // 0-7
  const volumePts = clamp(Math.log2(totalSignals + 1) / Math.log2(21) * 3, 0, 3)  // 0-3

  const score = Math.round(efficiencyScore + feedbackPts + volumePts)

  let grade: string
  if (score >= 17) grade = 'Exceptional QA'
  else if (score >= 14) grade = 'Strong QA'
  else if (score >= 10) grade = 'Good QA'
  else if (score >= 6) grade = 'Adequate QA'
  else grade = 'Needs Improvement'

  return { score, grade, iterationEfficiency: Math.round(iterationEfficiency * 100) / 100 }
}

// ─── Relevance ──────────────────────────────────────

function calculateRelevance(
  entities: { name: string; mention_count: number }[],
  conversationCount: number,
  messageCount: number,
): { multiplier: number; label: string } {
  if (entities.length === 0 || messageCount === 0) {
    return { multiplier: 1.0, label: 'Exploratory' }
  }

  const sorted = [...entities].sort((a, b) => b.mention_count - a.mention_count)
  const top3Mentions = sorted.slice(0, 3).reduce((s, e) => s + e.mention_count, 0)
  const totalMentions = entities.reduce((s, e) => s + e.mention_count, 0)
  const concentration = totalMentions > 0 ? top3Mentions / totalMentions : 0

  const avgDepth = conversationCount > 0 ? messageCount / conversationCount : 0
  const depthFactor = Math.min(avgDepth / 15, 1)

  const relevanceScore = (concentration * 0.6) + (depthFactor * 0.4)
  const multiplier = 1.0 + (relevanceScore * 0.5)
  const rounded = Math.round(multiplier * 100) / 100

  if (rounded >= 1.4) return { multiplier: rounded, label: 'Highly Focused' }
  if (rounded >= 1.25) return { multiplier: rounded, label: 'Focused' }
  if (rounded >= 1.1) return { multiplier: rounded, label: 'Targeted' }
  return { multiplier: rounded, label: 'Exploratory' }
}

// ─── Cost Calculation ───────────────────────────────

export interface ProjectCost {
  base: number
  scoreComponent: number
  marketMultiplier: number
  marketLabel: string
  relevanceMultiplier: number
  relevanceLabel: string
  rdMultiplier: number
  rdLabel: string
  webMultiplier: number
  webMarketRate: string
  surcharge: number
  subtotal: number
  tax: number
  taxRate: number
  stripeFee: number
  total: number
  tier: string
}

function calculateProjectCost(
  score: number,
  market: { multiplier: number; label: string },
  relevance: { multiplier: number; label: string },
  rd: RDScore,
  webResearch: WebResearchResult,
): ProjectCost {
  const scoreComponent = score * SCORE_RATE
  let surchargeRate = 0
  let tier = 'Standard'

  if (score >= ELITE_THRESHOLD) {
    surchargeRate = 0.4
    tier = 'Elite'
  } else if (score >= PREMIUM_THRESHOLD) {
    surchargeRate = 0.2
    tier = 'Premium'
  } else if (score >= 60) {
    tier = 'Standard'
  } else {
    tier = 'Starter'
  }

  const raw = BASE_PROJECT_FEE + scoreComponent
  const afterMarket = Math.round(raw * market.multiplier)
  const afterRelevance = Math.round(afterMarket * relevance.multiplier)
  const afterRD = Math.round(afterRelevance * rd.complexityMultiplier)
  const afterWeb = Math.round(afterRD * webResearch.adjustedMultiplier)
  const surcharge = Math.round(afterWeb * surchargeRate)
  const subtotal = afterWeb + surcharge

  // Tax + Stripe fees
  const tax = Math.round(subtotal * STRIPE_TAX_RATE)
  const preFee = subtotal + tax
  // Stripe charges 2.9% + $0.30 — pass through to client
  const stripeFee = Math.round(preFee * STRIPE_PROCESSING_FEE) + STRIPE_FIXED_FEE
  const total = preFee + stripeFee

  return {
    base: BASE_PROJECT_FEE,
    scoreComponent,
    marketMultiplier: market.multiplier,
    marketLabel: market.label,
    relevanceMultiplier: relevance.multiplier,
    relevanceLabel: relevance.label,
    rdMultiplier: rd.complexityMultiplier,
    rdLabel: rd.complexity,
    webMultiplier: webResearch.adjustedMultiplier,
    webMarketRate: webResearch.marketRate,
    surcharge,
    subtotal,
    tax,
    taxRate: STRIPE_TAX_RATE,
    stripeFee,
    total,
    tier,
  }
}

// ─── Types ──────────────────────────────────────────

export interface ScoreBreakdown {
  total: number
  engagement: number
  rd: number
  qa: number
  productivity: number
  depth: number
  loyalty: number
  cost: ProjectCost
  market: { key: string; label: string; multiplier: number; confidence: number }
  relevance: { multiplier: number; label: string }
  rdDetail: RDScore
  qaDetail: QAScore
  webResearch: WebResearchResult
  details: {
    messageCount: number
    conversationCount: number
    helpfulRate: number
    fileCount: number
    imageCount: number
    entityCount: number
    accountAgeDays: number
    isPro: boolean
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// ─── Main Calculator ────────────────────────────────

export async function calculateClientScore(userId: string): Promise<ScoreBreakdown> {
  const [
    { count: msgCount },
    { count: convCount },
    { count: fileCount },
    { count: imageCount },
    { count: entityCount },
    { count: signalCount },
    { count: helpfulCount },
    { count: poorCount },
    { data: subData },
    { data: memData },
    { data: userData },
    { data: kgEntities },
    { data: recentMsgs },
  ] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_files').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_files').select('id', { count: 'exact', head: true }).eq('user_id', userId).like('mime_type', 'image/%'),
    supabase.from('knowledge_graph_entities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('response_quality', 'helpful'),
    supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('response_quality', 'poor'),
    supabase.from('subscriptions').select('status').eq('user_id', userId).limit(1),
    supabase.from('user_memory').select('profile').eq('user_id', userId).limit(1),
    supabase.from('conversations').select('created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(1),
    supabase.from('knowledge_graph_entities').select('name, entity_type, mention_count').eq('user_id', userId).order('mention_count', { ascending: false }).limit(50),
    supabase.from('messages').select('content').eq('user_id', userId).eq('agent_id', 'user').order('created_at', { ascending: false }).limit(50),
  ])

  const messages = msgCount ?? 0
  const conversations = convCount ?? 0
  const files = fileCount ?? 0
  const images = imageCount ?? 0
  const entities = entityCount ?? 0
  const signals = signalCount ?? 0
  const helpful = helpfulCount ?? 0
  const poor = poorCount ?? 0
  const isPro = subData?.[0]?.status === 'active'
  const memoryProfile = memData?.[0]?.profile || {}
  const memoryKeys = Object.keys(memoryProfile).length

  const firstConvDate = userData?.[0]?.created_at
  const accountAgeDays = firstConvDate
    ? Math.floor((Date.now() - new Date(firstConvDate).getTime()) / 86400000)
    : 0

  const entityList = (kgEntities || []).map(e => ({ name: e.name, entity_type: e.entity_type, mention_count: e.mention_count }))
  const msgTexts = (recentMsgs || []).map((m: { content: string }) => m.content || '').filter(Boolean)

  // ── Engagement (20 points) ──
  const msgScore = clamp(Math.log2(messages + 1) / Math.log2(201) * 10, 0, 10)
  const convScore = clamp(Math.log2(conversations + 1) / Math.log2(51) * 6, 0, 6)
  const avgMsgDepth = conversations > 0 ? messages / conversations : 0
  const depthScore = clamp(avgMsgDepth / 20 * 4, 0, 4)
  const engagement = Math.round(msgScore + convScore + depthScore)

  // ── R&D (20 points) ──
  const rdDetail = calculateRD(msgTexts, entityList, conversations)

  // ── Q&A (20 points) ──
  const qaDetail = calculateQA(msgTexts, helpful, poor, signals)

  // ── Productivity (15 points) ──
  const fileScore = clamp(Math.log2(files + 1) / Math.log2(31) * 7, 0, 7)
  const imageScore = clamp(Math.log2(images + 1) / Math.log2(21) * 4, 0, 4)
  const nonImages = files - images
  const diversityScore = (images > 0 && nonImages > 0) ? 4 : (files > 0 ? 2 : 0)
  const productivity = Math.round(fileScore + imageScore + diversityScore)

  // ── Depth (15 points) ──
  const kgScore = clamp(Math.log2(entities + 1) / Math.log2(51) * 8, 0, 8)
  const memScore = clamp(memoryKeys / 15 * 7, 0, 7)
  const depth = Math.round(kgScore + memScore)

  // ── Loyalty (10 points) ──
  const ageScore = clamp(accountAgeDays / 90 * 5, 0, 5)
  const proScore = isPro ? 5 : 0
  const loyalty = Math.round(ageScore + proScore)

  const total = clamp(engagement + rdDetail.score + qaDetail.score + productivity + depth + loyalty, 0, 100)

  // Market detection + relevance
  const market = detectMarket(entityList, msgTexts)
  const relevance = calculateRelevance(entityList, conversations, messages)

  // Web research — get live market rates (runs in parallel with nothing, but non-blocking)
  const topEntities = entityList.slice(0, 5).map(e => e.name)
  const webResearch = await webResearchMarketRate(market.label, topEntities)

  // Final cost with all multipliers
  const cost = calculateProjectCost(total, market, relevance, rdDetail, webResearch)

  return {
    total,
    engagement,
    rd: rdDetail.score,
    qa: qaDetail.score,
    productivity,
    depth,
    loyalty,
    cost,
    market,
    relevance,
    rdDetail,
    qaDetail,
    webResearch,
    details: {
      messageCount: messages,
      conversationCount: conversations,
      helpfulRate: signals > 0 ? Math.round((helpful / signals) * 100) : 0,
      fileCount: files,
      imageCount: images,
      entityCount: entities,
      accountAgeDays,
      isPro,
    },
  }
}

// ─── Save & Format ──────────────────────────────────

export async function saveClientScore(
  userId: string,
  score: ScoreBreakdown,
  conversationId?: string,
): Promise<void> {
  await supabase.from('client_scores').insert({
    user_id: userId,
    conversation_id: conversationId || null,
    score_type: 'project',
    score: score.total,
    notes: [
      `E${score.engagement} RD${score.rd} QA${score.qa} P${score.productivity} D${score.depth} L${score.loyalty}`,
      `${score.market.label} ×${score.cost.marketMultiplier}`,
      `${score.relevance.label} ×${score.cost.relevanceMultiplier}`,
      `${score.rdDetail.complexity} ×${score.cost.rdMultiplier}`,
      `Web ×${score.cost.webMultiplier}`,
      `${score.cost.tier} $${score.cost.total}`,
      `tax$${score.cost.tax} fee$${score.cost.stripeFee} sub$${score.cost.subtotal}`,
    ].join(' | '),
  })
}

function fmt$(amount: number): string {
  return '$' + amount.toLocaleString('en-US')
}

export function formatScoreMessage(score: ScoreBreakdown): string {
  const bar = (val: number, max: number) => {
    const filled = Math.round((val / max) * 10)
    return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled)
  }

  const grade =
    score.total >= 90 ? 'Exceptional' :
    score.total >= 80 ? 'Excellent' :
    score.total >= 70 ? 'Very Good' :
    score.total >= 60 ? 'Good' :
    score.total >= 50 ? 'Satisfactory' :
    score.total >= 40 ? 'Fair' :
    score.total >= 30 ? 'Below Average' :
    'Needs Improvement'

  const { cost } = score
  const billable = score.total >= BILLING_THRESHOLD

  const lines = [
    `## Account Score: **${score.total}/100** — *${grade}*`,
    '',
    '| Category | Score | |',
    '|---|---|---|',
    `| Engagement | ${score.engagement}/20 | ${bar(score.engagement, 20)} |`,
    `| R&D | ${score.rd}/20 | ${bar(score.rd, 20)} |`,
    `| Q&A | ${score.qa}/20 | ${bar(score.qa, 20)} |`,
    `| Productivity | ${score.productivity}/15 | ${bar(score.productivity, 15)} |`,
    `| Depth | ${score.depth}/15 | ${bar(score.depth, 15)} |`,
    `| Loyalty | ${score.loyalty}/10 | ${bar(score.loyalty, 10)} |`,
    '',
    `**R&D**: ${score.rdDetail.complexity} · **Q&A**: ${score.qaDetail.grade} (${Math.round(score.qaDetail.iterationEfficiency * 100)}% efficiency)`,
    '',
    `---`,
    '',
  ]

  if (billable) {
    lines.push(
      `### Project Cost: **${fmt$(cost.total)}** *(${cost.tier} Tier)*`,
      '',
      '| Factor | Value |',
      '|---|---|',
      `| Base fee | ${fmt$(cost.base)} |`,
      `| Score value (${score.total} × $${SCORE_RATE}) | ${fmt$(cost.scoreComponent)} |`,
      `| Market: ${cost.marketLabel} | ×${cost.marketMultiplier} |`,
      `| Relevance: ${cost.relevanceLabel} | ×${cost.relevanceMultiplier} |`,
      `| R&D: ${cost.rdLabel} | ×${cost.rdMultiplier} |`,
      `| Web rate check | ×${cost.webMultiplier} |`,
      ...(cost.surcharge > 0 ? [`| ${cost.tier} surcharge | +${fmt$(cost.surcharge)} |`] : []),
      `| Subtotal | ${fmt$(cost.subtotal)} |`,
      `| Tax (${(cost.taxRate * 100).toFixed(2)}%) | +${fmt$(cost.tax)} |`,
      `| Stripe processing | +${fmt$(cost.stripeFee)} |`,
      `| **Invoice Total** | **${fmt$(cost.total)}** |`,
    )

    if (cost.webMarketRate !== 'N/A') {
      lines.push(
        '',
        `*Current market rate for ${cost.marketLabel}: ${cost.webMarketRate}*`,
      )
    }
  } else {
    lines.push(
      `### Score below billing threshold`,
      '',
      `A minimum score of **${BILLING_THRESHOLD}/100** is required for project invoicing. Current score: **${score.total}**.`,
    )
  }

  lines.push(
    '',
    `*${score.details.messageCount} messages · ${score.details.conversationCount} conversations · ${score.details.fileCount} files · ${score.details.entityCount} insights*`,
  )

  return lines.join('\n')
}


// ─── kernel.point — Points System ───────────────────
// Points are earned per conversation interaction. Cost per point
// is derived from the most recent kernel.hat score/billing.
// kernel.point only works if a kernel.hat score exists.

export interface PointsBreakdown {
  totalPoints: number
  costPerPoint: number
  totalCost: number
  messagePoints: number
  filePoints: number
  depthPoints: number
  qualityBonus: number
  hasScore: boolean
  score: number
  tier: string
}

/** Calculate points from user activity — requires a kernel.hat score first */
export async function calculatePoints(userId: string): Promise<PointsBreakdown> {
  // Check if user has a kernel.hat score
  const { data: scores } = await supabase
    .from('client_scores')
    .select('score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestScore = scores?.[0]
  if (!latestScore) {
    return {
      totalPoints: 0, costPerPoint: 0, totalCost: 0,
      messagePoints: 0, filePoints: 0, depthPoints: 0, qualityBonus: 0,
      hasScore: false, score: 0, tier: 'None',
    }
  }

  // Get activity since the score was recorded
  const scoredAt = latestScore.created_at

  const [
    { count: msgsSince },
    { count: filesSince },
    { count: helpfulSince },
    { count: convsSince },
  ] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('agent_id', 'user').gte('created_at', scoredAt),
    supabase.from('user_files').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', scoredAt),
    supabase.from('response_signals').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('response_quality', 'helpful').gte('created_at', scoredAt),
    supabase.from('conversations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', scoredAt),
  ])

  const messages = msgsSince ?? 0
  const files = filesSince ?? 0
  const helpful = helpfulSince ?? 0
  const convs = convsSince ?? 0

  // Point rules:
  // 1 point per message sent
  // 3 points per file created
  // 2 points per conversation started (depth bonus)
  // Quality bonus: +1 point per helpful signal
  const messagePoints = messages
  const filePoints = files * 3
  const depthPoints = convs * 2
  const qualityBonus = helpful
  const totalPoints = messagePoints + filePoints + depthPoints + qualityBonus

  // Cost per point from most recent kernel.hat billing
  const score = latestScore.score ?? 0
  const billable = score >= BILLING_THRESHOLD

  // Reconstruct cost from score (simplified — same formula as kernel.hat)
  const scoreComponent = score * SCORE_RATE
  const rawCost = BASE_PROJECT_FEE + scoreComponent
  const tier = score >= ELITE_THRESHOLD ? 'Elite' :
    score >= PREMIUM_THRESHOLD ? 'Premium' :
    score >= 60 ? 'Standard' : 'Starter'
  const totalCost = billable ? rawCost : 0
  const costPerPoint = totalPoints > 0 && totalCost > 0
    ? Math.round(totalCost / totalPoints)
    : 0

  return {
    totalPoints, costPerPoint, totalCost,
    messagePoints, filePoints, depthPoints, qualityBonus,
    hasScore: true, score, tier,
  }
}

/** Format points breakdown for display in chat */
export function formatPointsMessage(points: PointsBreakdown): string {
  if (!points.hasScore) {
    return [
      '## kernel.point',
      '',
      'No score found. Run **kernel.hat** first to generate your project score.',
      '',
      '*Points track your ongoing work after scoring. The score sets your rate.*',
    ].join('\n')
  }

  const bar = (val: number, max: number) => {
    const filled = Math.min(10, Math.round((val / Math.max(max, 1)) * 10))
    return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled)
  }

  const maxCategory = Math.max(points.messagePoints, points.filePoints, points.depthPoints, points.qualityBonus, 1)

  const lines = [
    `## kernel.point — **${points.totalPoints} points**`,
    '',
    `*${points.tier} tier · Score ${points.score}/100*`,
    '',
    '| Activity | Points | |',
    '|---|---|---|',
    `| Messages sent | ${points.messagePoints} | ${bar(points.messagePoints, maxCategory)} |`,
    `| Files created (×3) | ${points.filePoints} | ${bar(points.filePoints, maxCategory)} |`,
    `| Conversations (×2) | ${points.depthPoints} | ${bar(points.depthPoints, maxCategory)} |`,
    `| Quality signals | ${points.qualityBonus} | ${bar(points.qualityBonus, maxCategory)} |`,
    '',
  ]

  if (points.costPerPoint > 0) {
    lines.push(
      '---',
      '',
      `**Cost per point: ${fmt$(points.costPerPoint)}**`,
      '',
      `| | |`,
      `|---|---|`,
      `| Total points | ${points.totalPoints} |`,
      `| Base project cost | ${fmt$(points.totalCost)} |`,
      `| Cost ÷ points | ${fmt$(points.costPerPoint)}/pt |`,
    )
  } else {
    lines.push(
      '---',
      '',
      points.totalPoints > 0
        ? `**${points.totalPoints} points earned** — score below billing threshold (${BILLING_THRESHOLD}), no cost assigned yet.`
        : '*Start working to earn points. Each message, file, and conversation adds to your total.*',
    )
  }

  return lines.join('\n')
}

// Information-theoretic context management — inspired by Melvin Vopson's
// research that the universe minimizes informational load. Uses Shannon
// entropy to measure actual information content of conversation turns.

import { estimateTokens } from './context-manager.js'
import type { ConversationTurn } from './context-manager.js'

export interface EntropyScore {
  entropy: number    // Shannon entropy (bits per char)
  novelty: number    // 0-1, how much new info vs existing context
  density: number    // ratio of meaningful tokens to total
  composite: number  // weighted combination
}

export interface RankedTurn {
  turn: ConversationTurn
  score: EntropyScore
  rank: number
}

export const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
])

/** Shannon entropy — bits per character. Higher = more diverse/novel text. */
export function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0

  const freq = new Map<string, number>()
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    freq.set(ch, (freq.get(ch) || 0) + 1)
  }

  let entropy = 0
  const len = lower.length
  for (const count of freq.values()) {
    const p = count / len
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy
}

/** How much new information a turn adds vs what's already in context. */
export function calculateSemanticNovelty(
  turn: string,
  previousTurns: string[],
): number {
  if (previousTurns.length === 0) return 1.0

  const turnBigrams = extractBigrams(turn)
  if (turnBigrams.size === 0) return 0.5

  const contextBigrams = new Set<string>()
  for (const prev of previousTurns) {
    for (const bg of extractBigrams(prev)) {
      contextBigrams.add(bg)
    }
  }
  if (contextBigrams.size === 0) return 1.0

  // Jaccard distance: 1 - (intersection / union)
  let intersection = 0
  for (const bg of turnBigrams) {
    if (contextBigrams.has(bg)) intersection++
  }
  const union = new Set([...turnBigrams, ...contextBigrams]).size
  return union === 0 ? 0 : 1 - (intersection / union)
}

/** Ratio of unique meaningful tokens to total tokens. */
export function informationDensity(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return 0

  const meaningful = words.filter(w => !STOPWORDS.has(w) && w.length > 2)
  const unique = new Set(meaningful)
  return unique.size / words.length
}

function extractBigrams(text: string): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const bigrams = new Set<string>()
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`)
  }
  return bigrams
}

function turnContent(turn: ConversationTurn): string {
  return typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content)
}

export class EntropyScorer {
  /**
   * Composite score formula:
   * 0.4 * novelty + 0.35 * density + 0.25 * normalizedEntropy
   *
   * Novelty weighted highest: redundant info is the biggest waste.
   * Density second: filler text wastes tokens.
   * Raw entropy lowest: can be high for random/noisy text too.
   */
  scoreTurn(turn: ConversationTurn, history: ConversationTurn[]): EntropyScore {
    const content = turnContent(turn)
    const prevContents = history.map(turnContent)

    const entropy = calculateEntropy(content)
    const novelty = calculateSemanticNovelty(content, prevContents)
    const density = informationDensity(content)

    // Normalize entropy to 0-1 (English text typically 3.5-4.5 bits/char)
    const normalizedEntropy = Math.min(1, entropy / 5)

    const composite = 0.4 * novelty + 0.35 * density + 0.25 * normalizedEntropy

    return { entropy, novelty, density, composite }
  }

  /** Rank all turns by information value (highest first). */
  rankTurns(turns: ConversationTurn[]): RankedTurn[] {
    const scored = turns.map((turn, i) => {
      const history = turns.slice(0, i)
      return { turn, score: this.scoreTurn(turn, history), rank: 0 }
    })

    scored.sort((a, b) => b.score.composite - a.score.composite)
    scored.forEach((item, i) => item.rank = i + 1)
    return scored
  }

  /**
   * Keep highest-entropy turns within token budget.
   * Low-entropy turns are summarized or dropped.
   */
  compress(
    turns: ConversationTurn[],
    tokenBudget: number,
    keepRecentCount = 4,
  ): ConversationTurn[] {
    if (turns.length <= keepRecentCount) return turns

    // Always keep recent turns
    const recent = turns.slice(-keepRecentCount)
    const older = turns.slice(0, -keepRecentCount)

    const recentTokens = recent.reduce((sum, t) => sum + estimateTokens(turnContent(t)), 0)
    const remaining = tokenBudget - recentTokens
    if (remaining <= 0) return recent

    // Rank older turns by entropy, keep highest-value ones
    const ranked = this.rankTurns(older)
    const kept: ConversationTurn[] = []
    let used = 0

    for (const item of ranked) {
      const tokens = estimateTokens(turnContent(item.turn))
      if (used + tokens <= remaining) {
        kept.push(item.turn)
        used += tokens
      }
    }

    // Restore chronological order
    const keptSet = new Set(kept)
    const ordered = older.filter(t => keptSet.has(t))

    return [...ordered, ...recent]
  }

  /** Returns true if turn adds < 0.2 novelty — candidate for eviction. */
  shouldEvict(turn: ConversationTurn, history: ConversationTurn[]): boolean {
    const content = turnContent(turn)
    const novelty = calculateSemanticNovelty(content, history.map(turnContent))
    return novelty < 0.2
  }
}

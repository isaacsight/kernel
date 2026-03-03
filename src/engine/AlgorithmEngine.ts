// ─── Algorithm Engine ────────────────────────────────────────────
//
// Content intelligence layer: Score → Rank → Distribute → Feedback.
// Uses Haiku for fast evaluations, web search for trend signals,
// and EMA weight learning from user-reported performance data.

import { getProvider } from './providers/registry'
import { getSpecialist } from '../agents/specialists'
import type {
  ContentItem,
  AlgorithmScore,
  AlgorithmWeights,
  AlgorithmFeedback,
  AlgorithmCallbacks,
  SignalSource,
  DimensionScore,
  ScoreDimension,
  PublishTarget,
  PerformanceMetric,
  DEFAULT_WEIGHTS,
} from './content/types'
import { DEFAULT_WEIGHTS as DEFAULTS } from './content/types'

// ─── Scoring Prompts ────────────────────────────────────────────

function buildRelevancePrompt(content: ContentItem, userContext: string): string {
  return `Rate the topic-audience fit of this content on a scale of 0.0 to 1.0.

Title: ${content.title || '(untitled)'}
Format: ${content.format}
Brief: ${content.brief}
Content preview: ${(content.finalContent || '').slice(0, 1500)}

User context (voice, interests, audience):
${userContext.slice(0, 1000)}

Consider:
- How well does this topic match the user's typical content themes?
- Would their audience find this relevant and valuable?
- Is the angle specific enough to be interesting?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`
}

function buildQualityPrompt(content: ContentItem): string {
  return `Rate the quality of this content on a scale of 0.0 to 1.0.

Title: ${content.title || '(untitled)'}
Format: ${content.format}
Content: ${(content.finalContent || '').slice(0, 3000)}

Evaluate:
- Structure and flow (logical progression, clear sections)
- Language quality (vivid, precise, no filler)
- Depth of insight (beyond surface-level observations)
- Opening hook strength
- Actionable value for the reader

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`
}

function buildAffinityPrompt(content: ContentItem, userContext: string): string {
  return `Rate how well this content matches the user's personal voice and style on a scale of 0.0 to 1.0.

Content preview: ${(content.finalContent || '').slice(0, 2000)}

User's voice profile:
${userContext.slice(0, 1000)}

Consider:
- Tone alignment (formal/casual, serious/witty, analytical/narrative)
- Vocabulary and phrasing patterns
- Perspective and worldview consistency
- Would readers recognize this as coming from this creator?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`
}

function buildTrendPrompt(content: ContentItem, trendData: string): string {
  return `Rate how well this content aligns with current trends on a scale of 0.0 to 1.0.

Title: ${content.title || '(untitled)'}
Topic: ${content.brief}
Tags: ${content.tags.join(', ')}

Current trend signals:
${trendData.slice(0, 1500)}

Consider:
- Is this topic currently trending or gaining interest?
- Does it connect to broader cultural or industry conversations?
- Is the timing right for this content?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`
}

// ─── Freshness Score (Pure Math) ────────────────────────────────

function computeFreshness(createdAt: number): number {
  const hoursOld = (Date.now() - createdAt) / (1000 * 60 * 60)
  // Exponential decay: 1.0 at 0h, ~0.7 at 24h, ~0.5 at 48h, ~0.1 at 1 week
  return Math.exp(-0.015 * hoursOld)
}

// ─── Distribution Prompt ────────────────────────────────────────

function buildDistributionPrompt(
  content: ContentItem,
  score: AlgorithmScore,
): string {
  const dimSummary = score.dimensions
    .map(d => `${d.dimension}: ${d.score.toFixed(2)} (${d.reasoning || ''})`)
    .join('\n')

  return `Recommend distribution platforms for this content.

Title: ${content.title || '(untitled)'}
Format: ${content.format}
Tags: ${content.tags.join(', ')}
Composite score: ${score.composite.toFixed(2)}

Dimension breakdown:
${dimSummary}

Content preview: ${(content.finalContent || '').slice(0, 1000)}

For each recommended platform (blog, twitter, linkedin, newsletter, medium, substack), provide:
1. Platform-specific optimization score (0.0-1.0)
2. Why this platform fits
3. Best posting time (general guidance)
4. Format adaptation notes

Return ONLY valid JSON:
{
  "targets": [
    { "platform": "twitter", "score": 0.XX, "reasoning": "...", "bestTime": "...", "formatNotes": "..." }
  ]
}`
}

// ─── Algorithm Engine Class ─────────────────────────────────────

export class AlgorithmEngine {
  private weights: Record<ScoreDimension, number>
  private learningRate: number

  constructor(
    savedWeights?: AlgorithmWeights,
    private callbacks?: AlgorithmCallbacks,
  ) {
    this.weights = savedWeights?.weights || { ...DEFAULTS }
    this.learningRate = savedWeights?.learningRate || 0.1
  }

  getWeights(): Record<ScoreDimension, number> {
    return { ...this.weights }
  }

  // ─── Signal Collection ──────────────────────────────────────

  async collectSignals(
    content: ContentItem,
    userContext: string,
  ): Promise<SignalSource[]> {
    this.callbacks?.onProgress?.('Collecting signals', 'Gathering context for scoring...')

    const signals: SignalSource[] = []

    // Topic fit signal
    signals.push({
      type: 'topic_fit',
      data: `Brief: ${content.brief}. Format: ${content.format}. Tags: ${content.tags.join(', ')}`,
      confidence: 0.9,
      source: 'content_metadata',
    })

    // Audience match from user context
    if (userContext) {
      signals.push({
        type: 'audience_match',
        data: userContext.slice(0, 500),
        confidence: 0.8,
        source: 'user_memory',
      })
    }

    // Voice alignment
    signals.push({
      type: 'voice_alignment',
      data: userContext.slice(0, 500),
      confidence: 0.7,
      source: 'user_memory',
    })

    // Quality markers from content
    const contentText = content.finalContent || ''
    signals.push({
      type: 'quality_markers',
      data: `Length: ${contentText.length} chars. Sections: ${(contentText.match(/^#+\s/gm) || []).length}. Has examples: ${/example|case study|for instance/i.test(contentText)}`,
      confidence: 0.85,
      source: 'content_analysis',
    })

    // Trend data (web search for topic trends)
    try {
      const trendQuery = `${content.title || content.brief} trends ${new Date().getFullYear()}`
      const trendResult = await getProvider().text(
        `Search for current trends related to: ${trendQuery}. Summarize in 3-4 sentences what the current discourse looks like.`,
        { tier: 'fast', max_tokens: 300, web_search: true },
      )
      signals.push({
        type: 'trend_data',
        data: trendResult,
        confidence: 0.6,
        source: 'web_search',
      })
    } catch {
      signals.push({
        type: 'trend_data',
        data: 'Trend data unavailable',
        confidence: 0.3,
        source: 'fallback',
      })
    }

    return signals
  }

  // ─── Scoring ────────────────────────────────────────────────

  async score(
    content: ContentItem,
    signals: SignalSource[],
    userContext: string,
  ): Promise<AlgorithmScore> {
    this.callbacks?.onProgress?.('Scoring', 'Evaluating content across 5 dimensions...')

    const trendSignal = signals.find(s => s.type === 'trend_data')?.data || ''

    // Run dimension evaluations in parallel (all Haiku — fast)
    const [relevance, quality, affinity, trend] = await Promise.all([
      this.evaluateDimension('relevance', buildRelevancePrompt(content, userContext)),
      this.evaluateDimension('quality', buildQualityPrompt(content)),
      this.evaluateDimension('userAffinity', buildAffinityPrompt(content, userContext)),
      this.evaluateDimension('trendAlignment', buildTrendPrompt(content, trendSignal)),
    ])

    // Freshness is pure math — no LLM needed
    const freshness: DimensionScore = {
      dimension: 'freshness',
      score: computeFreshness(content.createdAt),
      weight: this.weights.freshness,
      reasoning: `Content is ${Math.round((Date.now() - content.createdAt) / (1000 * 60 * 60))}h old`,
    }

    const dimensions: DimensionScore[] = [
      { ...relevance, weight: this.weights.relevance },
      { ...quality, weight: this.weights.quality },
      { ...affinity, weight: this.weights.userAffinity },
      freshness,
      { ...trend, weight: this.weights.trendAlignment },
    ]

    const composite = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)

    const result: AlgorithmScore = {
      contentId: content.id,
      composite,
      dimensions,
      scoredAt: Date.now(),
    }

    this.callbacks?.onScoreUpdate?.(result)
    return result
  }

  private async evaluateDimension(
    dimension: ScoreDimension,
    prompt: string,
  ): Promise<DimensionScore> {
    try {
      const result = await getProvider().json<{ score: number; reasoning: string }>(
        prompt,
        { tier: 'fast', max_tokens: 150 },
      )
      return {
        dimension,
        score: Math.max(0, Math.min(1, result.score || 0)),
        weight: this.weights[dimension],
        reasoning: result.reasoning || '',
      }
    } catch {
      return {
        dimension,
        score: 0.5,
        weight: this.weights[dimension],
        reasoning: 'Evaluation failed — using neutral score',
      }
    }
  }

  // ─── Ranking ────────────────────────────────────────────────

  async rank(items: ContentItem[]): Promise<ContentItem[]> {
    this.callbacks?.onProgress?.('Ranking', `Ranking ${items.length} content items...`)

    // Score each item if not already scored (minimal signals — just for ranking)
    const scored: { item: ContentItem; composite: number }[] = []

    for (const item of items) {
      const signals = await this.collectSignals(item, '')
      const score = await this.score(item, signals, '')
      scored.push({ item, composite: score.composite })
    }

    // Sort descending by composite score
    scored.sort((a, b) => b.composite - a.composite)
    return scored.map(s => s.item)
  }

  // ─── Distribution Recommendation ───────────────────────────

  async recommendDistribution(
    content: ContentItem,
    score: AlgorithmScore,
  ): Promise<PublishTarget[]> {
    this.callbacks?.onProgress?.('Distribution', 'Recommending distribution platforms...')

    const specialist = getSpecialist('strategist')
    const prompt = buildDistributionPrompt(content, score)

    try {
      const result = await getProvider().json<{ targets: PublishTarget[] }>(
        prompt,
        {
          system: specialist.systemPrompt,
          tier: 'fast',
          max_tokens: 600,
        },
      )

      return (result.targets || []).map(t => ({
        platform: t.platform,
        score: Math.max(0, Math.min(1, t.score || 0)),
        reasoning: t.reasoning || '',
        bestTime: t.bestTime,
        formatNotes: t.formatNotes,
      }))
    } catch {
      return []
    }
  }

  // ─── Feedback Loop (EMA Weight Learning) ────────────────────

  async processFeedback(
    contentId: string,
    predicted: AlgorithmScore,
    actual: PerformanceMetric[],
  ): Promise<AlgorithmFeedback> {
    this.callbacks?.onProgress?.('Feedback', 'Processing performance data...')

    // Normalize actual performance to 0-1 scale
    const totalMetrics = actual.length
    if (totalMetrics === 0) {
      return {
        contentId,
        predictedScore: predicted.composite,
        actualPerformance: 0,
        weightDelta: { relevance: 0, quality: 0, userAffinity: 0, freshness: 0, trendAlignment: 0 },
        createdAt: Date.now(),
      }
    }

    // Simple normalization: average all metric values, capped at 1.0
    // Assumes metrics are pre-normalized by the caller
    const avgPerformance = Math.min(
      1,
      actual.reduce((sum, m) => sum + m.value, 0) / totalMetrics,
    )

    // Calculate prediction error
    const error = avgPerformance - predicted.composite

    // EMA weight update: shift weights toward dimensions that
    // contributed most (or least) to the prediction
    const weightDelta: Record<ScoreDimension, number> = {
      relevance: 0,
      quality: 0,
      userAffinity: 0,
      freshness: 0,
      trendAlignment: 0,
    }

    for (const dim of predicted.dimensions) {
      // If actual > predicted and this dimension scored low, increase its weight
      // If actual < predicted and this dimension scored high, decrease its weight
      const dimError = error * (dim.score - predicted.composite)
      const delta = this.learningRate * dimError
      weightDelta[dim.dimension] = delta
      this.weights[dim.dimension] = Math.max(0.05, Math.min(0.5, this.weights[dim.dimension] + delta))
    }

    // Renormalize weights to sum to 1.0
    const totalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0)
    for (const key of Object.keys(this.weights) as ScoreDimension[]) {
      this.weights[key] /= totalWeight
    }

    return {
      contentId,
      predictedScore: predicted.composite,
      actualPerformance: avgPerformance,
      weightDelta,
      createdAt: Date.now(),
    }
  }
}

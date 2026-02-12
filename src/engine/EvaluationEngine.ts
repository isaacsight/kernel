// Evaluation & Research Engine
// Unified intelligence layer combining:
//   I.   Entity Evaluation (points-based scoring)
//   II.  Lead Scoring (intent signals, priority classification)
//   III. Backtesting (strategy simulation, Sharpe, drawdown, Kelly)
//   IV.  Adaptive Scoring (Thompson Sampling — weights learn from outcomes)
//   V.   Calibration (Brier scores, prediction tracking, drift detection)

import { generateCompletion } from './NvidiaClient';

// ============================================================
// TYPES — Evaluation
// ============================================================

export type EntityType = 'project' | 'opportunity' | 'agent' | 'income_stream' | 'trade';
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type CategoryType = 'complexity' | 'market_demand' | 'risk' | 'profitability' | 'time_efficiency' | 'innovation';

export interface CategoryScore {
  category: CategoryType;
  score: number; // 0-100
  weight: number;
  reasoning: string;
  factors: string[];
}

export interface Evaluation {
  id: string;
  entityId: string;
  entityType: EntityType;
  entityDescription: string;
  timestamp: Date;
  categoryScores: CategoryScore[];
  weightedScore: number;
  tier: Tier;
  pricingMultiplier: number;
  basePrice?: number;
  finalPrice?: number;
  confidence: number;
  outcome?: { success: boolean; revenue?: number; lessons: string[] };
}

export interface TierConfig {
  tier: Tier;
  minScore: number;
  maxScore: number;
  pricingMultiplier: number;
  badge: string;
  color: string;
  description: string;
}

export interface EvaluationState {
  evaluations: Evaluation[];
  totalEvaluations: number;
  successRate: number;
  averageScore: number;
  tierDistribution: Record<Tier, number>;
}

// ============================================================
// TYPES — Lead Scoring
// ============================================================

export type LeadSource = 'reddit' | 'twitter' | 'hackernews' | 'upwork' | 'linkedin' | 'discord' | 'inbound' | 'referral' | 'other';
export type LeadPriority = 'hot' | 'warm' | 'cold' | 'dead';

export interface LeadSignal {
  type: 'budget' | 'urgency' | 'problem_specificity' | 'decision_maker' | 'tech_match' | 'sentiment';
  strength: number; // 0-1
  evidence: string;
}

export interface ScoredLead {
  id: string;
  source: LeadSource;
  rawText: string;
  timestamp: Date;
  signals: LeadSignal[];
  score: number; // 0-100
  priority: LeadPriority;
  estimatedValue: number; // projected revenue in USD
  reasoning: string;
  contacted: boolean;
  outcome?: { converted: boolean; actualValue?: number; responseTime?: number };
}

// ============================================================
// TYPES — Backtesting
// ============================================================

export interface PricePoint {
  timestamp: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TradeDirection = 'long' | 'short';

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  reason: string;
}

export interface StrategyConfig {
  name: string;
  description: string;
  fastPeriod: number;
  slowPeriod: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxPositionSize: number; // fraction of capital, 0-1
  useKellySizing: boolean;
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  symbol: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: { timestamp: number; equity: number }[];
  timestamp: Date;
}

// ============================================================
// TYPES — Adaptive Scoring (Thompson Sampling)
// ============================================================

export interface AdaptiveWeight {
  category: CategoryType;
  alpha: number; // Beta distribution param (successes + 1)
  beta: number;  // Beta distribution param (failures + 1)
  currentWeight: number;
  sampleCount: number;
  lastUpdated: Date;
}

export interface AdaptiveProfile {
  entityType: EntityType;
  weights: Record<CategoryType, AdaptiveWeight>;
  totalOutcomes: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// TYPES — Calibration
// ============================================================

export interface Prediction {
  id: string;
  source: 'evaluation' | 'pricing' | 'lead_scoring' | 'trading' | 'reasoning';
  predictedValue: number; // 0-1 probability or normalized score
  actualOutcome?: number; // 0 or 1 for binary, or normalized actual
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export interface CalibrationBucket {
  range: { min: number; max: number };
  predictions: number;
  actualPositiveRate: number;
  expectedRate: number;
  gap: number; // actual - expected (positive = underconfident, negative = overconfident)
}

export interface CalibrationReport {
  totalPredictions: number;
  resolvedPredictions: number;
  brierScore: number; // 0 = perfect, 1 = worst
  buckets: CalibrationBucket[];
  overconfidenceBias: number; // positive = overconfident
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
  generatedAt: Date;
}

// ============================================================
// TYPES — Combined State
// ============================================================

interface UnifiedState {
  // Evaluation
  evaluations: Evaluation[];
  totalEvaluations: number;
  successRate: number;
  averageScore: number;
  tierDistribution: Record<Tier, number>;
  // Research
  leads: ScoredLead[];
  backtestResults: BacktestResult[];
  adaptiveProfiles: AdaptiveProfile[];
  predictions: Prediction[];
}

// ============================================================
// CONSTANTS
// ============================================================

const TIER_CONFIGS: TierConfig[] = [
  { tier: 'bronze', minScore: 0, maxScore: 25, pricingMultiplier: 0.8, badge: 'Bronze', color: '#CD7F32', description: 'Entry-level, straightforward' },
  { tier: 'silver', minScore: 26, maxScore: 50, pricingMultiplier: 1.0, badge: 'Silver', color: '#C0C0C0', description: 'Standard complexity and value' },
  { tier: 'gold', minScore: 51, maxScore: 75, pricingMultiplier: 1.5, badge: 'Gold', color: '#FFD700', description: 'High value, significant impact' },
  { tier: 'platinum', minScore: 76, maxScore: 100, pricingMultiplier: 2.0, badge: 'Platinum', color: '#E5E4E2', description: 'Exceptional, enterprise-grade' },
];

const DEFAULT_WEIGHTS: Record<CategoryType, number> = {
  complexity: 0.25,
  market_demand: 0.20,
  profitability: 0.20,
  risk: 0.15,
  time_efficiency: 0.10,
  innovation: 0.10,
};

const ENTITY_WEIGHT_OVERRIDES: Partial<Record<EntityType, Partial<Record<CategoryType, number>>>> = {
  trade: { risk: 0.30, profitability: 0.25, complexity: 0.15, market_demand: 0.15, time_efficiency: 0.10, innovation: 0.05 },
  income_stream: { profitability: 0.30, time_efficiency: 0.20, market_demand: 0.20, risk: 0.10, complexity: 0.10, innovation: 0.10 },
  agent: { innovation: 0.25, complexity: 0.25, profitability: 0.15, market_demand: 0.15, risk: 0.10, time_efficiency: 0.10 },
};

const CATEGORY_KEYWORDS: Record<CategoryType, { high: string[]; low: string[] }> = {
  complexity: {
    high: ['enterprise', 'distributed', 'microservices', 'real-time', 'machine learning', 'ai model', 'blockchain', 'compliance', 'hipaa', 'sox', 'multi-tenant', 'scalable', 'architecture', 'infrastructure', 'orchestration', 'kubernetes', 'ci/cd', 'pipeline', 'security', 'encryption', 'oauth', 'saml'],
    low: ['simple', 'basic', 'landing page', 'static', 'template', 'wordpress', 'no-code', 'single page', 'minimal', 'straightforward', 'crud', 'boilerplate'],
  },
  market_demand: {
    high: ['saas', 'ai', 'fintech', 'healthtech', 'automation', 'analytics', 'dashboard', 'platform', 'marketplace', 'subscription', 'b2b', 'enterprise', 'api', 'integration', 'cloud', 'mobile app', 'ecommerce', 'payments'],
    low: ['niche', 'personal', 'hobby', 'academic', 'legacy', 'deprecated', 'prototype', 'experiment', 'internal tool', 'one-off'],
  },
  risk: {
    high: ['volatile', 'speculative', 'unproven', 'experimental', 'crypto', 'leverage', 'margin', 'options', 'derivatives', 'startup', 'new market', 'regulatory', 'compliance', 'legal', 'high-frequency'],
    low: ['stable', 'proven', 'established', 'low-risk', 'guaranteed', 'insured', 'diversified', 'index', 'bonds', 'treasury', 'recurring', 'contract'],
  },
  profitability: {
    high: ['recurring revenue', 'subscription', 'saas', 'high margin', 'scalable', 'passive income', 'licensing', 'royalty', 'enterprise contract', 'retainer', 'premium', 'consulting', 'advisory'],
    low: ['free', 'open source', 'volunteer', 'pro bono', 'low margin', 'commodity', 'race to bottom', 'one-time', 'discount', 'freemium'],
  },
  time_efficiency: {
    high: ['automated', 'template', 'framework', 'reusable', 'quick', 'fast', 'rapid', 'turnkey', 'pre-built', 'plug and play', 'no-code', 'low-code', 'existing', 'library'],
    low: ['custom', 'bespoke', 'from scratch', 'manual', 'labor intensive', 'handcrafted', 'artisan', 'research', 'r&d', 'exploration', 'long-term'],
  },
  innovation: {
    high: ['novel', 'innovative', 'breakthrough', 'disruptive', 'first-mover', 'patent', 'proprietary', 'cutting-edge', 'state-of-the-art', 'ai', 'machine learning', 'deep learning', 'generative', 'autonomous', 'quantum'],
    low: ['standard', 'conventional', 'traditional', 'existing', 'copycat', 'clone', 'me-too', 'commodity', 'generic', 'off-the-shelf'],
  },
};

const ALL_CATEGORIES: CategoryType[] = ['complexity', 'market_demand', 'risk', 'profitability', 'time_efficiency', 'innovation'];

// Lead scoring signals
const BUDGET_SIGNALS = ['budget', 'willing to pay', 'price range', '$', 'invest', 'funding', 'capital', 'afford', 'cost', 'rate', 'quote', 'estimate'];
const URGENCY_SIGNALS = ['asap', 'urgent', 'deadline', 'immediately', 'rush', 'this week', 'today', 'tomorrow', 'time-sensitive', 'critical', 'emergency', 'yesterday'];
const PROBLEM_SIGNALS = ['struggling', 'broken', 'need help', 'looking for', 'seeking', 'hire', 'requirement', 'must have', 'pain point', 'frustrated', 'can\'t figure out', 'issue with'];
const DECISION_MAKER_SIGNALS = ['cto', 'ceo', 'founder', 'director', 'head of', 'lead', 'manager', 'owner', 'decision', 'authority', 'my company', 'our team', 'we need'];
const TECH_MATCH_SIGNALS = ['react', 'typescript', 'node', 'python', 'api', 'web app', 'saas', 'ai', 'chatbot', 'automation', 'dashboard', 'mobile', 'full-stack', 'frontend'];
const NEGATIVE_SIGNALS = ['free', 'volunteer', 'no budget', 'student project', 'homework', 'learning', 'just curious', 'hypothetical', 'someday', 'eventually'];

const DEFAULT_STRATEGY: StrategyConfig = {
  name: 'SMA Crossover',
  description: 'Simple moving average crossover with stop-loss and take-profit',
  fastPeriod: 10,
  slowPeriod: 30,
  stopLossPercent: 0.02,
  takeProfitPercent: 0.04,
  maxPositionSize: 0.1,
  useKellySizing: false,
};

const STORAGE_KEY = 'evaluation_engine_state';
const MAX_EVALUATIONS = 500;
const MAX_LEADS = 500;
const MAX_BACKTEST_RESULTS = 100;
const MAX_PREDICTIONS = 1000;

// ============================================================
// ENGINE
// ============================================================

class EvaluationEngine {
  private state: UnifiedState;

  constructor() {
    this.state = this.loadState();
  }

  // --- Persistence ---

  private loadState(): UnifiedState {
    if (typeof window === 'undefined') return this.emptyState();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.evaluations = (parsed.evaluations || []).map((e: Evaluation) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
        parsed.leads = (parsed.leads || []).map((l: ScoredLead) => ({
          ...l,
          timestamp: new Date(l.timestamp),
        }));
        parsed.backtestResults = (parsed.backtestResults || []).map((r: BacktestResult) => ({
          ...r,
          timestamp: new Date(r.timestamp),
        }));
        parsed.adaptiveProfiles = (parsed.adaptiveProfiles || []).map((p: AdaptiveProfile) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          weights: Object.fromEntries(
            Object.entries(p.weights).map(([k, w]: [string, any]) => [k, { ...w, lastUpdated: new Date(w.lastUpdated) }])
          ),
        }));
        parsed.predictions = (parsed.predictions || []).map((p: Prediction) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        }));
        return {
          evaluations: parsed.evaluations || [],
          totalEvaluations: parsed.totalEvaluations || 0,
          successRate: parsed.successRate || 0,
          averageScore: parsed.averageScore || 0,
          tierDistribution: parsed.tierDistribution || { bronze: 0, silver: 0, gold: 0, platinum: 0 },
          leads: parsed.leads || [],
          backtestResults: parsed.backtestResults || [],
          adaptiveProfiles: parsed.adaptiveProfiles || [],
          predictions: parsed.predictions || [],
        };
      }
    } catch (e) {
      console.error('Failed to load evaluation state:', e);
    }
    return this.emptyState();
  }

  private emptyState(): UnifiedState {
    return {
      evaluations: [],
      totalEvaluations: 0,
      successRate: 0,
      averageScore: 0,
      tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      leads: [],
      backtestResults: [],
      adaptiveProfiles: [],
      predictions: [],
    };
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;
    if (this.state.evaluations.length > MAX_EVALUATIONS) {
      this.state.evaluations = this.state.evaluations.slice(-MAX_EVALUATIONS);
    }
    if (this.state.leads.length > MAX_LEADS) {
      this.state.leads = this.state.leads.slice(-MAX_LEADS);
    }
    if (this.state.backtestResults.length > MAX_BACKTEST_RESULTS) {
      this.state.backtestResults = this.state.backtestResults.slice(-MAX_BACKTEST_RESULTS);
    }
    if (this.state.predictions.length > MAX_PREDICTIONS) {
      this.state.predictions = this.state.predictions.slice(-MAX_PREDICTIONS);
    }
    this.recalcAggregates();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save evaluation state:', e);
    }
  }

  private recalcAggregates(): void {
    const evals = this.state.evaluations;
    this.state.totalEvaluations = evals.length;
    this.state.averageScore = evals.length > 0
      ? evals.reduce((sum, e) => sum + e.weightedScore, 0) / evals.length
      : 0;

    const withOutcome = evals.filter(e => e.outcome);
    this.state.successRate = withOutcome.length > 0
      ? withOutcome.filter(e => e.outcome!.success).length / withOutcome.length
      : 0;

    this.state.tierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const e of evals) {
      this.state.tierDistribution[e.tier]++;
    }
  }

  // ============================================================
  // I. ENTITY EVALUATION
  // ============================================================

  private getWeights(entityType: EntityType): Record<CategoryType, number> {
    const overrides = ENTITY_WEIGHT_OVERRIDES[entityType];
    if (overrides) {
      return { ...DEFAULT_WEIGHTS, ...overrides } as Record<CategoryType, number>;
    }
    return { ...DEFAULT_WEIGHTS };
  }

  scoreCategory(category: CategoryType, entityType: EntityType, description: string, context?: Record<string, any>): CategoryScore {
    const lowerDesc = description.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[category];
    const weights = this.getWeights(entityType);

    let score = 50; // baseline
    const factors: string[] = [];

    let highHits = 0;
    let lowHits = 0;
    for (const kw of keywords.high) {
      if (lowerDesc.includes(kw)) {
        highHits++;
        factors.push(`+${kw}`);
      }
    }
    for (const kw of keywords.low) {
      if (lowerDesc.includes(kw)) {
        lowHits++;
        factors.push(`-${kw}`);
      }
    }

    score += highHits * 8;
    score -= lowHits * 8;

    const wordCount = description.split(/\s+/).length;
    if (wordCount > 50) {
      score += 5;
      factors.push('+detailed description');
    } else if (wordCount < 10) {
      score -= 5;
      factors.push('-brief description');
    }

    if (context) {
      if (category === 'profitability' && context.revenue && context.revenue > 10000) {
        score += 10;
        factors.push('+high revenue context');
      }
      if (category === 'risk' && context.volatility && context.volatility > 0.5) {
        score += 15;
        factors.push('+high volatility');
      }
      if (category === 'market_demand' && context.competitors && context.competitors < 5) {
        score += 10;
        factors.push('+low competition');
      }
      if (category === 'time_efficiency' && context.deadline) {
        score -= 10;
        factors.push('-tight deadline');
      }
    }

    score = Math.max(0, Math.min(100, score));

    const reasoning = factors.length > 0
      ? `Score ${score}/100: ${factors.slice(0, 5).join(', ')}`
      : `Score ${score}/100: baseline assessment`;

    return { category, score, weight: weights[category], reasoning, factors };
  }

  evaluate(
    entityId: string,
    entityType: EntityType,
    options: { description: string; context?: Record<string, any>; basePrice?: number }
  ): Evaluation {
    const { description, context, basePrice } = options;

    const categoryScores = ALL_CATEGORIES.map(cat =>
      this.scoreCategory(cat, entityType, description, context)
    );

    const weightedScore = Math.round(
      categoryScores.reduce((sum, cs) => sum + cs.score * cs.weight, 0)
    );

    const { tier, multiplier } = this.getTierFromScore(weightedScore);

    const totalFactors = categoryScores.reduce((sum, cs) => sum + cs.factors.length, 0);
    const confidence = Math.min(0.95, 0.4 + totalFactors * 0.05);

    const evaluation: Evaluation = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityId,
      entityType,
      entityDescription: description,
      timestamp: new Date(),
      categoryScores,
      weightedScore,
      tier,
      pricingMultiplier: multiplier,
      basePrice,
      finalPrice: basePrice ? Math.round(basePrice * multiplier * 100) / 100 : undefined,
      confidence,
    };

    this.state.evaluations.push(evaluation);

    // Auto-track for calibration
    this.recordPrediction({
      source: 'evaluation',
      predictedValue: weightedScore / 100,
      description: `Eval ${entityType}: ${description.slice(0, 80)}`,
    });

    this.saveState();
    return evaluation;
  }

  async evaluateWithAI(
    description: string,
    entityType: EntityType,
    options: { context?: Record<string, any>; basePrice?: number; modelId?: string } = {}
  ): Promise<Evaluation> {
    const { context, basePrice, modelId } = options;

    const systemPrompt = `You are a sophisticated entity evaluation engine. Analyze the provided description and context for a ${entityType}.
Respond ONLY with a JSON object in this format:
{
  "categoryScores": [
    {
      "category": "complexity" | "market_demand" | "risk" | "profitability" | "time_efficiency" | "innovation",
      "score": 0-100,
      "reasoning": "Qualitative explanation of the score",
      "factors": ["signal 1", "signal 2"]
    }
  ],
  "overallSummary": "High-level summary of the evaluation"
}

Be rigorous and identify specific risks and opportunities.`;

    const prompt = `Entity Type: ${entityType}
Description: ${description}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Evaluate this entity across all 6 categories.`;

    try {
      const response = await generateCompletion(prompt, systemPrompt, modelId);
      const jsonMatch = response.match(/\{[\s\S]*\}/)?.[0];
      const data = JSON.parse(jsonMatch || '{}');

      const categoryScores: CategoryScore[] = ALL_CATEGORIES.map(cat => {
        const match = data.categoryScores.find((s: any) => s.category === cat);
        const weights = this.getWeights(entityType);
        return {
          category: cat,
          score: match?.score ?? 50,
          weight: weights[cat],
          reasoning: match?.reasoning ?? 'Baseline assessment',
          factors: match?.factors ?? [],
        };
      });

      const weightedScore = Math.round(
        categoryScores.reduce((sum, cs) => sum + cs.score * cs.weight, 0)
      );

      const { tier, multiplier } = this.getTierFromScore(weightedScore);

      const evaluation: Evaluation = {
        id: `eval_ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityId: `ai_refinement_${Date.now()}`,
        entityType,
        entityDescription: description,
        timestamp: new Date(),
        categoryScores,
        weightedScore,
        tier,
        pricingMultiplier: multiplier,
        basePrice,
        finalPrice: basePrice ? Math.round(basePrice * multiplier * 100) / 100 : undefined,
        confidence: 0.9,
      };

      this.state.evaluations.push(evaluation);
      this.saveState();
      return evaluation;
    } catch (error) {
      console.error('AI Evaluation failed, falling back to heuristic:', error);
      return this.evaluate(`fail_${Date.now()}`, entityType, { description, context, basePrice });
    }
  }

  // --- Tier Helpers ---

  private getTierFromScore(score: number): { tier: Tier; multiplier: number; config: TierConfig } {
    for (const config of TIER_CONFIGS) {
      if (score >= config.minScore && score <= config.maxScore) {
        return { tier: config.tier, multiplier: config.pricingMultiplier, config };
      }
    }
    const last = TIER_CONFIGS[TIER_CONFIGS.length - 1];
    return { tier: last.tier, multiplier: last.pricingMultiplier, config: last };
  }

  getPricingMultiplier(score: number): { multiplier: number; tier: Tier; tierConfig: TierConfig } {
    const { tier, multiplier, config } = this.getTierFromScore(score);
    return { multiplier, tier, tierConfig: config };
  }

  getTierConfigs(): TierConfig[] {
    return [...TIER_CONFIGS];
  }

  // --- Evaluation Queries ---

  getPointsBreakdown(evaluationId: string): {
    evaluation: Evaluation | null;
    breakdown: { category: CategoryType; score: number; weight: number; contribution: number }[];
    tierProgression: { currentTier: Tier; nextTier: Tier | null; pointsToNext: number };
  } | null {
    const evaluation = this.state.evaluations.find(e => e.id === evaluationId);
    if (!evaluation) return null;

    const breakdown = evaluation.categoryScores.map(cs => ({
      category: cs.category,
      score: cs.score,
      weight: cs.weight,
      contribution: Math.round(cs.score * cs.weight),
    }));

    const currentTierIndex = TIER_CONFIGS.findIndex(t => t.tier === evaluation.tier);
    const nextTier = currentTierIndex < TIER_CONFIGS.length - 1 ? TIER_CONFIGS[currentTierIndex + 1] : null;

    return {
      evaluation,
      breakdown,
      tierProgression: {
        currentTier: evaluation.tier,
        nextTier: nextTier?.tier ?? null,
        pointsToNext: nextTier ? nextTier.minScore - evaluation.weightedScore : 0,
      },
    };
  }

  getRanking(
    type?: EntityType,
    limit: number = 20,
    filters?: { minScore?: number; tier?: Tier }
  ): { evaluation: Evaluation; rank: number; percentile: number }[] {
    let evals = [...this.state.evaluations];

    if (type) evals = evals.filter(e => e.entityType === type);
    if (filters?.minScore) evals = evals.filter(e => e.weightedScore >= filters.minScore!);
    if (filters?.tier) evals = evals.filter(e => e.tier === filters.tier);

    evals.sort((a, b) => b.weightedScore - a.weightedScore);

    const total = evals.length;
    return evals.slice(0, limit).map((evaluation, index) => ({
      evaluation,
      rank: index + 1,
      percentile: total > 1 ? Math.round(((total - index - 1) / (total - 1)) * 100) : 100,
    }));
  }

  getHistory(
    type?: EntityType,
    limit: number = 50,
    filters?: { tier?: Tier; fromDate?: Date }
  ): Evaluation[] {
    let evals = [...this.state.evaluations];

    if (type) evals = evals.filter(e => e.entityType === type);
    if (filters?.tier) evals = evals.filter(e => e.tier === filters.tier);
    if (filters?.fromDate) evals = evals.filter(e => e.timestamp >= filters.fromDate!);

    return evals
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  updateOutcome(evaluationId: string, outcome: { success: boolean; revenue?: number; lessons: string[] }): Evaluation | null {
    const evaluation = this.state.evaluations.find(e => e.id === evaluationId);
    if (!evaluation) return null;

    evaluation.outcome = outcome;

    // Feed outcome into adaptive scoring
    const categoryMap = Object.fromEntries(
      evaluation.categoryScores.map(cs => [cs.category, cs.score])
    ) as Record<CategoryType, number>;
    this.recordAdaptiveOutcome(evaluation.entityType, categoryMap, outcome.success);

    // Resolve calibration prediction
    const pred = this.state.predictions.find(
      p => p.source === 'evaluation' && evaluation.entityDescription && p.description.includes(evaluation.entityDescription.slice(0, 40))
    );
    if (pred) {
      pred.actualOutcome = outcome.success ? 1 : 0;
      pred.resolved = true;
    }

    this.saveState();
    return evaluation;
  }

  getPerformanceReport(type?: EntityType): {
    totalEvaluations: number;
    averageScore: number;
    successRate: number;
    tierDistribution: Record<Tier, number>;
    topPerformers: Evaluation[];
    recentTrend: 'improving' | 'declining' | 'stable';
    recommendations: string[];
  } {
    let evals = this.state.evaluations;
    if (type) evals = evals.filter(e => e.entityType === type);

    const total = evals.length;
    const avgScore = total > 0 ? evals.reduce((s, e) => s + e.weightedScore, 0) / total : 0;
    const withOutcome = evals.filter(e => e.outcome);
    const successRate = withOutcome.length > 0
      ? withOutcome.filter(e => e.outcome!.success).length / withOutcome.length
      : 0;

    const tierDist: Record<Tier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const e of evals) tierDist[e.tier]++;

    const topPerformers = [...evals]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 5);

    const sorted = [...evals].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recent10 = sorted.slice(0, 10);
    const prev10 = sorted.slice(10, 20);
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recent10.length >= 5 && prev10.length >= 5) {
      const recentAvg = recent10.reduce((s, e) => s + e.weightedScore, 0) / recent10.length;
      const prevAvg = prev10.reduce((s, e) => s + e.weightedScore, 0) / prev10.length;
      if (recentAvg > prevAvg + 3) recentTrend = 'improving';
      else if (recentAvg < prevAvg - 3) recentTrend = 'declining';
    }

    const recommendations: string[] = [];
    if (avgScore < 40) recommendations.push('Focus on higher-value opportunities to raise average score');
    if (tierDist.bronze > total * 0.5) recommendations.push('Too many bronze-tier evaluations — seek more complex projects');
    if (successRate < 0.5 && withOutcome.length > 5) recommendations.push('Success rate below 50% — refine selection criteria');
    if (tierDist.platinum === 0 && total > 10) recommendations.push('No platinum evaluations yet — aim for enterprise-grade opportunities');
    if (total === 0) recommendations.push('Start evaluating entities to build your scoring history');

    return {
      totalEvaluations: total,
      averageScore: Math.round(avgScore * 10) / 10,
      successRate: Math.round(successRate * 100) / 100,
      tierDistribution: tierDist,
      topPerformers,
      recentTrend,
      recommendations,
    };
  }

  // ============================================================
  // II. LEAD SCORING
  // ============================================================

  scoreLead(rawText: string, source: LeadSource, metadata?: { author?: string; url?: string }): ScoredLead {
    const lower = rawText.toLowerCase();
    const signals: LeadSignal[] = [];

    const budgetHits = BUDGET_SIGNALS.filter(kw => lower.includes(kw));
    if (budgetHits.length > 0) {
      signals.push({ type: 'budget', strength: Math.min(1, budgetHits.length * 0.3), evidence: budgetHits.join(', ') });
    }

    const urgencyHits = URGENCY_SIGNALS.filter(kw => lower.includes(kw));
    if (urgencyHits.length > 0) {
      signals.push({ type: 'urgency', strength: Math.min(1, urgencyHits.length * 0.35), evidence: urgencyHits.join(', ') });
    }

    const problemHits = PROBLEM_SIGNALS.filter(kw => lower.includes(kw));
    if (problemHits.length > 0) {
      signals.push({ type: 'problem_specificity', strength: Math.min(1, problemHits.length * 0.25), evidence: problemHits.join(', ') });
    }

    const decisionHits = DECISION_MAKER_SIGNALS.filter(kw => lower.includes(kw));
    if (decisionHits.length > 0) {
      signals.push({ type: 'decision_maker', strength: Math.min(1, decisionHits.length * 0.35), evidence: decisionHits.join(', ') });
    }

    const techHits = TECH_MATCH_SIGNALS.filter(kw => lower.includes(kw));
    if (techHits.length > 0) {
      signals.push({ type: 'tech_match', strength: Math.min(1, techHits.length * 0.2), evidence: techHits.join(', ') });
    }

    const negativeHits = NEGATIVE_SIGNALS.filter(kw => lower.includes(kw));
    if (negativeHits.length > 0) {
      signals.push({ type: 'sentiment', strength: -Math.min(1, negativeHits.length * 0.3), evidence: negativeHits.join(', ') });
    }

    const signalWeights: Record<LeadSignal['type'], number> = {
      budget: 25, urgency: 20, problem_specificity: 20,
      decision_maker: 15, tech_match: 10, sentiment: 10,
    };

    let score = 20;
    for (const signal of signals) {
      score += signal.strength * signalWeights[signal.type];
    }

    const wordCount = rawText.split(/\s+/).length;
    if (wordCount > 100) score += 5;
    if (wordCount > 200) score += 5;
    if (wordCount < 20) score -= 10;

    const sourceBonus: Record<LeadSource, number> = {
      referral: 15, inbound: 12, linkedin: 8, upwork: 5,
      hackernews: 3, reddit: 0, twitter: -2, discord: -3, other: 0,
    };
    score += sourceBonus[source];
    score = Math.max(0, Math.min(100, Math.round(score)));

    let priority: LeadPriority;
    if (score >= 70) priority = 'hot';
    else if (score >= 45) priority = 'warm';
    else if (score >= 20) priority = 'cold';
    else priority = 'dead';

    const hasLargeBudget = lower.match(/\$\s*(\d{4,})/);
    let estimatedValue = score * 20;
    if (hasLargeBudget) {
      estimatedValue = Math.max(estimatedValue, parseInt(hasLargeBudget[1]));
    }

    const parts: string[] = [`Score: ${score}/100 (${priority.toUpperCase()})`];
    const positiveSignals = signals.filter(s => s.strength > 0);
    const negativeSignalsList = signals.filter(s => s.strength < 0);
    if (positiveSignals.length > 0) parts.push(`Positive: ${positiveSignals.map(s => `${s.type} (${s.evidence})`).join('; ')}`);
    if (negativeSignalsList.length > 0) parts.push(`Negative: ${negativeSignalsList.map(s => `${s.type} (${s.evidence})`).join('; ')}`);
    parts.push(`Source: ${source}`);

    const lead: ScoredLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source, rawText, timestamp: new Date(), signals, score, priority,
      estimatedValue, reasoning: parts.join(' | '), contacted: false,
    };

    this.state.leads.push(lead);

    this.recordPrediction({
      source: 'lead_scoring',
      predictedValue: score / 100,
      description: `Lead from ${source}: ${rawText.slice(0, 80)}...`,
    });

    this.saveState();
    return lead;
  }

  updateLeadOutcome(leadId: string, outcome: { converted: boolean; actualValue?: number; responseTime?: number }): ScoredLead | null {
    const lead = this.state.leads.find(l => l.id === leadId);
    if (!lead) return null;

    lead.outcome = outcome;

    const prediction = this.state.predictions.find(
      p => p.source === 'lead_scoring' && p.description.includes(lead.rawText.slice(0, 40))
    );
    if (prediction) {
      prediction.actualOutcome = outcome.converted ? 1 : 0;
      prediction.resolved = true;
    }

    this.saveState();
    return lead;
  }

  markLeadContacted(leadId: string): void {
    const lead = this.state.leads.find(l => l.id === leadId);
    if (lead) { lead.contacted = true; this.saveState(); }
  }

  getLeads(filters?: { priority?: LeadPriority; source?: LeadSource; contacted?: boolean; limit?: number }): ScoredLead[] {
    let leads = [...this.state.leads];
    if (filters?.priority) leads = leads.filter(l => l.priority === filters.priority);
    if (filters?.source) leads = leads.filter(l => l.source === filters.source);
    if (filters?.contacted !== undefined) leads = leads.filter(l => l.contacted === filters.contacted);
    leads.sort((a, b) => b.score - a.score);
    return leads.slice(0, filters?.limit ?? 50);
  }

  getLeadConversionRate(): { total: number; contacted: number; converted: number; conversionRate: number; avgValue: number } {
    const withOutcome = this.state.leads.filter(l => l.outcome);
    const converted = withOutcome.filter(l => l.outcome!.converted);
    const avgValue = converted.length > 0
      ? converted.reduce((sum, l) => sum + (l.outcome!.actualValue || 0), 0) / converted.length
      : 0;
    return {
      total: this.state.leads.length,
      contacted: this.state.leads.filter(l => l.contacted).length,
      converted: converted.length,
      conversionRate: withOutcome.length > 0 ? converted.length / withOutcome.length : 0,
      avgValue,
    };
  }

  // ============================================================
  // III. BACKTESTING
  // ============================================================

  backtest(
    priceData: PricePoint[],
    symbol: string,
    config: Partial<StrategyConfig> = {},
    initialCapital: number = 10000
  ): BacktestResult {
    const strategy = { ...DEFAULT_STRATEGY, ...config };

    if (priceData.length < strategy.slowPeriod + 1) {
      throw new Error(`Need at least ${strategy.slowPeriod + 1} data points, got ${priceData.length}`);
    }

    const sorted = [...priceData].sort((a, b) => a.timestamp - b.timestamp);
    const trades: BacktestTrade[] = [];
    const equityCurve: { timestamp: number; equity: number }[] = [];

    let capital = initialCapital;
    let position: { direction: TradeDirection; entryPrice: number; entryTime: number; size: number } | null = null;
    let peakCapital = initialCapital;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;

    for (let i = strategy.slowPeriod; i < sorted.length; i++) {
      const candle = sorted[i];
      const fastSMA = this.sma(sorted, i, strategy.fastPeriod);
      const slowSMA = this.sma(sorted, i, strategy.slowPeriod);
      const prevFastSMA = this.sma(sorted, i - 1, strategy.fastPeriod);
      const prevSlowSMA = this.sma(sorted, i - 1, strategy.slowPeriod);

      // Exit check
      if (position) {
        const currentPnl = position.direction === 'long'
          ? (candle.close - position.entryPrice) / position.entryPrice
          : (position.entryPrice - candle.close) / position.entryPrice;

        const hitStopLoss = currentPnl <= -strategy.stopLossPercent;
        const hitTakeProfit = currentPnl >= strategy.takeProfitPercent;
        const crossedBack = position.direction === 'long'
          ? (fastSMA < slowSMA && prevFastSMA >= prevSlowSMA)
          : (fastSMA > slowSMA && prevFastSMA <= prevSlowSMA);

        if (hitStopLoss || hitTakeProfit || crossedBack) {
          const pnl = currentPnl * position.size * position.entryPrice;
          capital += pnl;
          trades.push({
            entryTime: position.entryTime, exitTime: candle.timestamp,
            direction: position.direction, entryPrice: position.entryPrice,
            exitPrice: candle.close, size: position.size, pnl,
            pnlPercent: currentPnl * 100,
            reason: hitStopLoss ? 'stop_loss' : hitTakeProfit ? 'take_profit' : 'signal_exit',
          });
          if (pnl > 0) { wins++; totalWinAmount += pnl; }
          else { losses++; totalLossAmount += Math.abs(pnl); }
          position = null;
        }
      }

      // Entry check
      if (!position) {
        const bullishCross = fastSMA > slowSMA && prevFastSMA <= prevSlowSMA;
        const bearishCross = fastSMA < slowSMA && prevFastSMA >= prevSlowSMA;

        if (bullishCross || bearishCross) {
          let positionFraction = strategy.maxPositionSize;

          if (strategy.useKellySizing && wins + losses >= 10) {
            const winRate = wins / (wins + losses);
            const avgWin = totalWinAmount / Math.max(1, wins);
            const avgLoss = totalLossAmount / Math.max(1, losses);
            const payoffRatio = avgWin / Math.max(0.01, avgLoss);
            const kellyFraction = winRate - (1 - winRate) / payoffRatio;
            positionFraction = Math.max(0.01, Math.min(strategy.maxPositionSize, kellyFraction * 0.5));
          }

          position = {
            direction: bullishCross ? 'long' : 'short',
            entryPrice: candle.close,
            entryTime: candle.timestamp,
            size: (capital * positionFraction) / candle.close,
          };
        }
      }

      // Equity tracking
      let equity = capital;
      if (position) {
        const unrealized = position.direction === 'long'
          ? (candle.close - position.entryPrice) * position.size
          : (position.entryPrice - candle.close) * position.size;
        equity += unrealized;
      }
      equityCurve.push({ timestamp: candle.timestamp, equity });
      if (equity > peakCapital) peakCapital = equity;
      const drawdown = peakCapital - equity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Close remaining position
    if (position) {
      const lastPrice = sorted[sorted.length - 1].close;
      const currentPnl = position.direction === 'long'
        ? (lastPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - lastPrice) / position.entryPrice;
      const pnl = currentPnl * position.size * position.entryPrice;
      capital += pnl;
      trades.push({
        entryTime: position.entryTime, exitTime: sorted[sorted.length - 1].timestamp,
        direction: position.direction, entryPrice: position.entryPrice,
        exitPrice: lastPrice, size: position.size, pnl,
        pnlPercent: currentPnl * 100, reason: 'end_of_data',
      });
      if (pnl > 0) wins++; else losses++;
    }

    // Metrics
    const totalReturn = (capital - initialCapital) / initialCapital;
    const durationMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    const durationYears = durationMs / (365.25 * 24 * 60 * 60 * 1000);
    const annualizedReturn = durationYears > 0 ? Math.pow(1 + totalReturn, 1 / durationYears) - 1 : totalReturn;

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : winningTrades.length > 0 ? Infinity : 0;

    const returns = equityCurve.map((p, i) => i === 0 ? 0 : equityCurve[i - 1].equity > 0 ? (p.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity : 0);
    const meanReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
    const stdReturn = Math.sqrt(returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length);
    const periodsPerYear = returns.length / Math.max(0.01, durationYears);
    const sharpeRatio = stdReturn > 0 ? (meanReturn * Math.sqrt(periodsPerYear)) / stdReturn : 0;

    const result: BacktestResult = {
      id: `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strategyName: strategy.name, symbol,
      startDate: sorted[0].timestamp, endDate: sorted[sorted.length - 1].timestamp,
      initialCapital, finalCapital: Math.round(capital * 100) / 100,
      totalReturn: Math.round(totalReturn * 10000) / 100,
      annualizedReturn: Math.round(annualizedReturn * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round((maxDrawdown / peakCapital) * 10000) / 100,
      winRate: trades.length > 0 ? Math.round((winningTrades.length / trades.length) * 10000) / 100 : 0,
      totalTrades: trades.length,
      winningTrades: winningTrades.length, losingTrades: losingTrades.length,
      avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
      trades, equityCurve, timestamp: new Date(),
    };

    this.state.backtestResults.push(result);
    this.saveState();
    return result;
  }

  private sma(data: PricePoint[], endIndex: number, period: number): number {
    if (period <= 0) return 0;
    let sum = 0;
    const start = Math.max(0, endIndex - period + 1);
    for (let i = start; i <= endIndex; i++) {
      sum += data[i].close;
    }
    return sum / (endIndex - start + 1);
  }

  compareStrategies(
    priceData: PricePoint[],
    symbol: string,
    strategies: Partial<StrategyConfig>[],
    initialCapital: number = 10000
  ): { results: BacktestResult[]; best: BacktestResult | undefined; ranking: { name: string; sharpe: number; return: number; drawdown: number }[] } {
    if (strategies.length === 0) return { results: [], best: undefined, ranking: [] };
    const results = strategies.map(s => this.backtest(priceData, symbol, s, initialCapital));
    results.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    return {
      results,
      best: results[0],
      ranking: results.map(r => ({
        name: r.strategyName, sharpe: r.sharpeRatio,
        return: r.totalReturn, drawdown: r.maxDrawdownPercent,
      })),
    };
  }

  getBacktestHistory(limit: number = 20): BacktestResult[] {
    return [...this.state.backtestResults]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // ============================================================
  // IV. ADAPTIVE SCORING (Thompson Sampling)
  // ============================================================

  getOrCreateProfile(entityType: EntityType): AdaptiveProfile {
    let profile = this.state.adaptiveProfiles.find(p => p.entityType === entityType);
    if (profile) return profile;

    const now = new Date();
    profile = {
      entityType,
      weights: Object.fromEntries(
        ALL_CATEGORIES.map(cat => [cat, {
          category: cat, alpha: 2, beta: 2,
          currentWeight: 1 / ALL_CATEGORIES.length,
          sampleCount: 0, lastUpdated: now,
        }])
      ) as Record<CategoryType, AdaptiveWeight>,
      totalOutcomes: 0, createdAt: now, updatedAt: now,
    };

    this.state.adaptiveProfiles.push(profile);
    this.saveState();
    return profile;
  }

  recordAdaptiveOutcome(entityType: EntityType, categoryScores: Record<CategoryType, number>, success: boolean): AdaptiveProfile {
    const profile = this.getOrCreateProfile(entityType);
    const now = new Date();
    const avgScore = Object.values(categoryScores).reduce((s, v) => s + v, 0) / ALL_CATEGORIES.length;

    for (const cat of ALL_CATEGORIES) {
      const score = categoryScores[cat] ?? 50;
      const wasHighScorer = score > avgScore;

      if (success && wasHighScorer) {
        profile.weights[cat].alpha += 1;
      } else if (!success && wasHighScorer) {
        profile.weights[cat].beta += 1;
      } else if (success && !wasHighScorer) {
        profile.weights[cat].beta += 0.5;
      }

      profile.weights[cat].sampleCount += 1;
      profile.weights[cat].lastUpdated = now;
    }

    this.resampleWeights(profile);
    profile.totalOutcomes += 1;
    profile.updatedAt = now;
    this.saveState();
    return profile;
  }

  private resampleWeights(profile: AdaptiveProfile): void {
    const samples: Record<string, number> = {};
    let totalSample = 0;

    for (const cat of ALL_CATEGORIES) {
      const w = profile.weights[cat];
      const sample = w.alpha / (w.alpha + w.beta);
      samples[cat] = sample;
      totalSample += sample;
    }

    for (const cat of ALL_CATEGORIES) {
      profile.weights[cat].currentWeight = Math.round((samples[cat] / totalSample) * 1000) / 1000;
    }
  }

  getAdaptiveWeights(entityType: EntityType): Record<CategoryType, number> {
    const profile = this.getOrCreateProfile(entityType);
    return Object.fromEntries(
      ALL_CATEGORIES.map(cat => [cat, profile.weights[cat].currentWeight])
    ) as Record<CategoryType, number>;
  }

  evaluateAdaptive(
    entityId: string,
    entityType: EntityType,
    options: { description: string; context?: Record<string, any>; basePrice?: number }
  ): Evaluation & { adaptiveWeights: Record<CategoryType, number> } {
    const adaptiveWeights = this.getAdaptiveWeights(entityType);

    const categoryScores = ALL_CATEGORIES.map(cat => {
      const baseScore = this.scoreCategory(cat, entityType, options.description, options.context);
      return { ...baseScore, weight: adaptiveWeights[cat] };
    });

    const weightedScore = Math.round(
      categoryScores.reduce((sum, cs) => sum + cs.score * cs.weight, 0)
    );

    const { tier, multiplier } = this.getTierFromScore(weightedScore);
    const totalFactors = categoryScores.reduce((sum, cs) => sum + cs.factors.length, 0);
    const confidence = Math.min(0.95, 0.4 + totalFactors * 0.05);

    const evaluation: Evaluation = {
      id: `eval_adaptive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityId, entityType,
      entityDescription: options.description,
      timestamp: new Date(), categoryScores, weightedScore, tier,
      pricingMultiplier: multiplier,
      basePrice: options.basePrice,
      finalPrice: options.basePrice ? Math.round(options.basePrice * multiplier * 100) / 100 : undefined,
      confidence,
    };

    this.state.evaluations.push(evaluation);

    this.recordPrediction({
      source: 'evaluation',
      predictedValue: weightedScore / 100,
      description: `Adaptive eval ${entityType}: ${options.description.slice(0, 80)}`,
    });

    this.saveState();
    return { ...evaluation, adaptiveWeights };
  }

  getAdaptiveProfiles(): AdaptiveProfile[] {
    return [...this.state.adaptiveProfiles];
  }

  // ============================================================
  // V. CALIBRATION
  // ============================================================

  recordPrediction(input: {
    source: Prediction['source'];
    predictedValue: number;
    description: string;
    actualOutcome?: number;
  }): Prediction {
    const prediction: Prediction = {
      id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: input.source,
      predictedValue: Math.max(0, Math.min(1, input.predictedValue)),
      actualOutcome: input.actualOutcome,
      description: input.description,
      timestamp: new Date(),
      resolved: input.actualOutcome !== undefined,
    };

    this.state.predictions.push(prediction);
    this.saveState();
    return prediction;
  }

  resolvePrediction(predictionId: string, actualOutcome: number): Prediction | null {
    const prediction = this.state.predictions.find(p => p.id === predictionId);
    if (!prediction) return null;

    prediction.actualOutcome = Math.max(0, Math.min(1, actualOutcome));
    prediction.resolved = true;
    this.saveState();
    return prediction;
  }

  getBrierScore(source?: Prediction['source']): number {
    let resolved = this.state.predictions.filter(p => p.resolved && p.actualOutcome !== undefined);
    if (source) resolved = resolved.filter(p => p.source === source);
    if (resolved.length === 0) return 0;

    const sumSquaredError = resolved.reduce((sum, p) => {
      return sum + (p.predictedValue - p.actualOutcome!) ** 2;
    }, 0);

    return Math.round((sumSquaredError / resolved.length) * 10000) / 10000;
  }

  getCalibrationReport(source?: Prediction['source']): CalibrationReport {
    let predictions = this.state.predictions;
    if (source) predictions = predictions.filter(p => p.source === source);

    const resolved = predictions.filter(p => p.resolved && p.actualOutcome !== undefined);
    const brierScore = this.getBrierScore(source);

    const bucketCount = 10;
    const buckets: CalibrationBucket[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const min = i / bucketCount;
      const max = (i + 1) / bucketCount;
      const inBucket = resolved.filter(p => p.predictedValue >= min && p.predictedValue < (i === bucketCount - 1 ? 1.01 : max));

      const actualPositiveRate = inBucket.length > 0
        ? inBucket.reduce((s, p) => s + (p.actualOutcome! > 0.5 ? 1 : 0), 0) / inBucket.length
        : 0;
      const expectedRate = (min + max) / 2;

      buckets.push({
        range: { min: Math.round(min * 100), max: Math.round(max * 100) },
        predictions: inBucket.length,
        actualPositiveRate: Math.round(actualPositiveRate * 100) / 100,
        expectedRate: Math.round(expectedRate * 100) / 100,
        gap: Math.round((actualPositiveRate - expectedRate) * 100) / 100,
      });
    }

    const highConfidence = resolved.filter(p => p.predictedValue > 0.5);
    const overconfidenceBias = highConfidence.length > 0
      ? highConfidence.reduce((s, p) => s + (p.predictedValue - (p.actualOutcome! > 0.5 ? 1 : 0)), 0) / highConfidence.length
      : 0;

    const sortedResolved = [...resolved].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentHalf = sortedResolved.slice(0, Math.floor(sortedResolved.length / 2));
    const olderHalf = sortedResolved.slice(Math.floor(sortedResolved.length / 2));

    let trend: CalibrationReport['trend'] = 'stable';
    if (recentHalf.length >= 5 && olderHalf.length >= 5) {
      const recentBrier = recentHalf.reduce((s, p) => s + (p.predictedValue - p.actualOutcome!) ** 2, 0) / recentHalf.length;
      const olderBrier = olderHalf.reduce((s, p) => s + (p.predictedValue - p.actualOutcome!) ** 2, 0) / olderHalf.length;
      if (recentBrier < olderBrier - 0.02) trend = 'improving';
      else if (recentBrier > olderBrier + 0.02) trend = 'declining';
    }

    const recommendations: string[] = [];
    if (brierScore > 0.3) recommendations.push('Brier score is high — predictions are poorly calibrated');
    if (overconfidenceBias > 0.1) recommendations.push('System is overconfident — predicted probabilities are too high');
    if (overconfidenceBias < -0.1) recommendations.push('System is underconfident — predicted probabilities are too low');
    if (resolved.length < 20) recommendations.push('Need more resolved predictions for reliable calibration (minimum 20)');
    if (trend === 'declining') recommendations.push('Calibration is getting worse — investigate recent prediction errors');

    const populatedBuckets = buckets.filter(b => b.predictions > 0);
    const worstBucket = [...populatedBuckets].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
    if (worstBucket && Math.abs(worstBucket.gap) > 0.2) {
      recommendations.push(`Worst calibration in ${worstBucket.range.min}-${worstBucket.range.max}% bucket (gap: ${worstBucket.gap > 0 ? '+' : ''}${Math.round(worstBucket.gap * 100)}%)`);
    }

    if (recommendations.length === 0) recommendations.push('Calibration looks good — continue tracking predictions');

    return {
      totalPredictions: predictions.length,
      resolvedPredictions: resolved.length,
      brierScore, buckets,
      overconfidenceBias: Math.round(overconfidenceBias * 1000) / 1000,
      trend, recommendations, generatedAt: new Date(),
    };
  }

  getPredictions(filters?: { source?: Prediction['source']; resolved?: boolean; limit?: number }): Prediction[] {
    let preds = [...this.state.predictions];
    if (filters?.source) preds = preds.filter(p => p.source === filters.source);
    if (filters?.resolved !== undefined) preds = preds.filter(p => p.resolved === filters.resolved);
    preds.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return preds.slice(0, filters?.limit ?? 50);
  }

  // ============================================================
  // VI. UNIFIED REPORTS
  // ============================================================

  getFullReport(): {
    evaluation: ReturnType<EvaluationEngine['getPerformanceReport']>;
    leadScoring: ReturnType<EvaluationEngine['getLeadConversionRate']>;
    backtesting: { totalTests: number; bestStrategy: string | null; avgSharpe: number };
    adaptive: { profiles: number; totalOutcomes: number };
    calibration: CalibrationReport;
  } {
    const results = this.state.backtestResults;
    const bestResult = results.length > 0
      ? [...results].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0]
      : null;

    return {
      evaluation: this.getPerformanceReport(),
      leadScoring: this.getLeadConversionRate(),
      backtesting: {
        totalTests: results.length,
        bestStrategy: bestResult?.strategyName ?? null,
        avgSharpe: results.length > 0
          ? Math.round((results.reduce((s, r) => s + r.sharpeRatio, 0) / results.length) * 100) / 100
          : 0,
      },
      adaptive: {
        profiles: this.state.adaptiveProfiles.length,
        totalOutcomes: this.state.adaptiveProfiles.reduce((s, p) => s + p.totalOutcomes, 0),
      },
      calibration: this.getCalibrationReport(),
    };
  }

  getState(): EvaluationState {
    this.recalcAggregates();
    return {
      evaluations: this.state.evaluations,
      totalEvaluations: this.state.totalEvaluations,
      successRate: this.state.successRate,
      averageScore: this.state.averageScore,
      tierDistribution: this.state.tierDistribution,
    };
  }
}

export const evaluationEngine = new EvaluationEngine();

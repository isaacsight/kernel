// K:BOT Free Energy Principle — Active Inference Engine
//
// Based on Karl Friston's Free Energy Principle (2006-2024):
// All adaptive systems minimize variational free energy — the difference
// between their internal model of the world and actual sensory input.
//
// An agent can minimize surprise in two ways:
//   1. Perceptual inference — update beliefs to match observations
//   2. Active inference — act on the world to match predictions
//
// This module makes kbot's decision loop information-theoretically grounded:
// should I learn more (reduce uncertainty) or act (change the world)?
//
// References:
//   - Friston, K. (2010). The free-energy principle: a unified brain theory?
//   - Parr, T., Pezzulo, G., & Friston, K.J. (2022). Active Inference.
//   - Da Costa, L. et al. (2020). Active inference on discrete state-spaces.

export interface BeliefState {
  /** What the agent expects the user wants */
  predictedIntent: string
  /** Confidence in the prediction (0-1) */
  confidence: number
  /** Expected tool outcomes */
  expectedOutcomes: Map<string, number>
  /** Entropy of the belief distribution (bits) */
  entropy: number
}

export interface Surprise {
  /** How surprising the observation was (bits) */
  informationContent: number
  /** Which prediction was violated */
  violatedExpectation: string | null
  /** Magnitude of prediction error (0-1) */
  predictionError: number
}

export interface FreeEnergyState {
  /** Current variational free energy (lower = better model) */
  freeEnergy: number
  /** Accumulated surprise across the session */
  totalSurprise: number
  /** Number of belief updates (perceptual inference) */
  beliefUpdates: number
  /** Number of actions taken (active inference) */
  actionsTaken: number
  /** Running average prediction error */
  avgPredictionError: number
  /** Recommended policy: explore (reduce uncertainty) or exploit (act on beliefs) */
  policy: 'explore' | 'exploit' | 'balanced'
}

export type InferenceMode = 'perceptual' | 'active'

/**
 * Active Inference Engine — minimizes free energy by balancing
 * belief updates (learning) with actions (tool use).
 *
 * When prediction errors are high → explore (research, read, search)
 * When prediction errors are low → exploit (write, execute, commit)
 */
export class ActiveInferenceEngine {
  private beliefs: BeliefState
  private surpriseHistory: Surprise[] = []
  private toolOutcomeHistory: Array<{ tool: string; predicted: number; actual: number }> = []
  private beliefUpdates = 0
  private actionsTaken = 0

  // Hyperparameters
  private readonly explorationThreshold = 0.6  // Above this → explore
  private readonly exploitationThreshold = 0.3 // Below this → exploit
  private readonly learningRate = 0.15          // Belief update step size
  private readonly decayRate = 0.95             // Surprise memory decay

  constructor() {
    this.beliefs = {
      predictedIntent: '',
      confidence: 0.5,
      expectedOutcomes: new Map(),
      entropy: 1.0,
    }
  }

  /**
   * Observe a user message and compute surprise.
   * High surprise = our model of the user is wrong → update beliefs.
   */
  observeMessage(message: string, previousPrediction?: string): Surprise {
    const words = new Set(message.toLowerCase().split(/\s+/).filter(w => w.length > 3))
    const predWords = previousPrediction
      ? new Set(previousPrediction.toLowerCase().split(/\s+/).filter(w => w.length > 3))
      : new Set<string>()

    // Prediction error via Jaccard distance
    let predictionError = 1.0
    if (predWords.size > 0 && words.size > 0) {
      const intersection = new Set([...words].filter(w => predWords.has(w)))
      const union = new Set([...words, ...predWords])
      predictionError = 1 - (intersection.size / union.size)
    }

    // Information content (surprise in bits) = -log2(1 - predictionError)
    // Clamped to avoid infinity
    const p = Math.max(0.01, Math.min(0.99, 1 - predictionError))
    const informationContent = -Math.log2(p)

    const surprise: Surprise = {
      informationContent,
      violatedExpectation: predictionError > 0.7 ? this.beliefs.predictedIntent : null,
      predictionError,
    }

    this.surpriseHistory.push(surprise)

    // Update beliefs via perceptual inference
    if (predictionError > this.explorationThreshold) {
      this.beliefs.confidence *= (1 - this.learningRate)
      this.beliefs.entropy = Math.min(2.0, this.beliefs.entropy + predictionError * 0.3)
      this.beliefUpdates++
    } else {
      this.beliefs.confidence = Math.min(1.0, this.beliefs.confidence + this.learningRate * (1 - predictionError))
      this.beliefs.entropy = Math.max(0.1, this.beliefs.entropy - (1 - predictionError) * 0.2)
    }

    return surprise
  }

  /**
   * Observe a tool execution result and update expected outcomes.
   */
  observeToolResult(toolName: string, success: boolean, relevance: number): void {
    const predicted = this.beliefs.expectedOutcomes.get(toolName) ?? 0.5
    const actual = success ? relevance : 0

    this.toolOutcomeHistory.push({ tool: toolName, predicted, actual })

    // Update expected outcome for this tool (exponential moving average)
    const updated = predicted + this.learningRate * (actual - predicted)
    this.beliefs.expectedOutcomes.set(toolName, Math.max(0, Math.min(1, updated)))

    this.actionsTaken++
  }

  /**
   * Compute current variational free energy.
   * F = E[log q(s) - log p(o,s)] ≈ prediction_error + entropy
   *
   * Lower free energy = better internal model.
   */
  computeFreeEnergy(): number {
    const recentSurprises = this.surpriseHistory.slice(-10)
    const avgSurprise = recentSurprises.length > 0
      ? recentSurprises.reduce((sum, s) => sum + s.informationContent, 0) / recentSurprises.length
      : 1.0

    // Free energy ≈ expected surprise + model complexity (entropy)
    const freeEnergy = avgSurprise * 0.7 + this.beliefs.entropy * 0.3

    return freeEnergy
  }

  /**
   * Decide inference mode: should the agent explore or exploit?
   *
   * High free energy → explore (search, read, research — reduce uncertainty)
   * Low free energy → exploit (write, execute, commit — act on beliefs)
   */
  recommendPolicy(): 'explore' | 'exploit' | 'balanced' {
    const fe = this.computeFreeEnergy()
    const avgPredError = this.getAveragePredictionError()

    if (avgPredError > this.explorationThreshold || fe > 1.5) {
      return 'explore'
    }
    if (avgPredError < this.exploitationThreshold && fe < 0.8) {
      return 'exploit'
    }
    return 'balanced'
  }

  /**
   * Get tools recommended for the current policy.
   * Explore → information-gathering tools
   * Exploit → action-taking tools
   */
  recommendToolBias(): { preferred: string[]; discouraged: string[] } {
    const policy = this.recommendPolicy()

    if (policy === 'explore') {
      return {
        preferred: ['web_search', 'read_file', 'grep', 'glob', 'git_log', 'arxiv_search', 'url_fetch'],
        discouraged: ['write_file', 'bash', 'git_commit', 'git_push'],
      }
    }
    if (policy === 'exploit') {
      return {
        preferred: ['write_file', 'edit_file', 'bash', 'git_commit', 'multi_file_write'],
        discouraged: [],
      }
    }
    return { preferred: [], discouraged: [] }
  }

  /**
   * Update the predicted intent (what the agent thinks the user wants next).
   */
  updatePrediction(intent: string): void {
    this.beliefs.predictedIntent = intent
  }

  /** Get running average prediction error */
  getAveragePredictionError(): number {
    const recent = this.surpriseHistory.slice(-10)
    if (recent.length === 0) return 0.5
    return recent.reduce((sum, s) => sum + s.predictionError, 0) / recent.length
  }

  /** Get the full free energy state for diagnostics */
  getState(): FreeEnergyState {
    return {
      freeEnergy: this.computeFreeEnergy(),
      totalSurprise: this.surpriseHistory.reduce((sum, s) => sum + s.informationContent, 0),
      beliefUpdates: this.beliefUpdates,
      actionsTaken: this.actionsTaken,
      avgPredictionError: this.getAveragePredictionError(),
      policy: this.recommendPolicy(),
    }
  }

  /** Reset for new conversation */
  reset(): void {
    this.beliefs = { predictedIntent: '', confidence: 0.5, expectedOutcomes: new Map(), entropy: 1.0 }
    this.surpriseHistory = []
    this.toolOutcomeHistory = []
    this.beliefUpdates = 0
    this.actionsTaken = 0
  }
}

// K:BOT Predictive Processing — Anticipatory Cognition Engine
//
// Based on the Predictive Processing framework (Clark, 2013; Hohwy, 2013):
// The brain is fundamentally a prediction machine. It constantly generates
// top-down predictions about incoming sensory data, then updates when
// predictions are violated (prediction error).
//
// For kbot: predict what the user will ask next, pre-load relevant context,
// and measure prediction errors to identify what's most worth learning.
//
// High prediction error = high-value information (the user surprised us)
// Low prediction error = we understand the user well (act confidently)
//
// References:
//   - Clark, A. (2013). Whatever next? Predictive brains, situated agents.
//   - Hohwy, J. (2013). The Predictive Mind.
//   - Rao, R.P. & Ballard, D.H. (1999). Predictive coding in the visual cortex.
//   - Keller, G.B. & Mrsic-Flogel, T.D. (2018). Predictive processing.

export interface Prediction {
  /** What we predict the user will ask or do next */
  predictedAction: string
  /** Confidence in this prediction (0-1) */
  confidence: number
  /** Context that should be pre-loaded if prediction holds */
  preloadContext: string[]
  /** Tools likely to be needed */
  likelyTools: string[]
  /** Timestamp */
  timestamp: number
}

export interface PredictionError {
  /** The prediction that was made */
  prediction: Prediction
  /** What actually happened */
  actual: string
  /** Error magnitude (0-1, Jaccard distance) */
  magnitude: number
  /** What we learned from this error */
  insight: string
}

export interface PredictiveState {
  /** Current prediction accuracy (0-1, exponential moving average) */
  accuracy: number
  /** Number of predictions made */
  totalPredictions: number
  /** Number of correct predictions (error < 0.4) */
  correctPredictions: number
  /** Most common prediction errors (what we keep getting wrong) */
  blindSpots: string[]
  /** Current precision weighting (how much to trust predictions vs. observations) */
  precisionWeight: number
}

/** Pattern types the engine tracks */
type ConversationPattern =
  | 'iterative_refinement'  // user keeps refining the same request
  | 'topic_switch'          // user jumps to new topic
  | 'drill_down'           // user goes deeper into current topic
  | 'verification'          // user checks/tests previous output
  | 'follow_up'            // natural continuation of thread
  | 'meta_question'         // user asks about the process itself

/**
 * Predictive Processing Engine — anticipates user intent and
 * pre-loads context, reducing latency and improving relevance.
 *
 * The engine maintains a generative model of user behavior and
 * continuously updates it based on prediction errors.
 */
export class PredictiveEngine {
  private predictions: Prediction[] = []
  private errors: PredictionError[] = []
  private messageHistory: string[] = []
  private toolHistory: string[] = []
  private accuracy = 0.5
  private precisionWeight = 0.5

  // Hyperparameters
  private readonly learningRate = 0.12
  private readonly errorDecay = 0.9
  private readonly maxHistory = 50

  /**
   * Generate a prediction for what the user will do next.
   * Based on conversation patterns and tool usage history.
   */
  predict(recentMessages: string[], recentTools: string[]): Prediction {
    const pattern = this.detectPattern(recentMessages)
    const lastMessage = recentMessages[recentMessages.length - 1] || ''
    const lastTool = recentTools[recentTools.length - 1] || ''

    let predictedAction = ''
    let confidence = 0.3
    let preloadContext: string[] = []
    let likelyTools: string[] = []

    switch (pattern) {
      case 'iterative_refinement':
        predictedAction = 'refine previous output with specific changes'
        confidence = 0.7
        likelyTools = ['edit_file', 'write_file']
        preloadContext = ['previous output', 'user feedback']
        break

      case 'drill_down':
        predictedAction = 'ask for more detail on current topic'
        confidence = 0.6
        likelyTools = ['read_file', 'grep', 'web_search']
        preloadContext = ['current topic context', 'related files']
        break

      case 'verification':
        predictedAction = 'test or verify previous changes'
        confidence = 0.65
        likelyTools = ['bash', 'read_file', 'git_diff']
        preloadContext = ['recent changes', 'test commands']
        break

      case 'topic_switch':
        predictedAction = 'start new unrelated task'
        confidence = 0.4
        likelyTools = ['read_file', 'glob']
        preloadContext = []
        break

      case 'follow_up':
        predictedAction = 'continue current thread naturally'
        confidence = 0.5
        likelyTools = this.predictToolsFromHistory(recentTools)
        preloadContext = ['recent context']
        break

      case 'meta_question':
        predictedAction = 'ask about capabilities or process'
        confidence = 0.6
        likelyTools = []
        preloadContext = ['agent capabilities']
        break
    }

    // Boost confidence based on historical accuracy
    confidence *= (0.5 + this.accuracy * 0.5)

    const prediction: Prediction = {
      predictedAction,
      confidence: Math.min(0.95, confidence),
      preloadContext,
      likelyTools,
      timestamp: Date.now(),
    }

    this.predictions.push(prediction)
    if (this.predictions.length > this.maxHistory) {
      this.predictions.shift()
    }

    return prediction
  }

  /**
   * Evaluate a prediction against what actually happened.
   * Updates the generative model based on prediction error.
   */
  evaluate(prediction: Prediction, actualMessage: string, actualTools: string[]): PredictionError {
    // Compute prediction error (Jaccard distance between predicted and actual)
    const predWords = new Set(prediction.predictedAction.toLowerCase().split(/\s+/))
    const actualWords = new Set(actualMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3))

    let magnitude = 1.0
    if (predWords.size > 0 && actualWords.size > 0) {
      const intersection = new Set([...predWords].filter(w => actualWords.has(w)))
      const union = new Set([...predWords, ...actualWords])
      magnitude = 1 - (intersection.size / union.size)
    }

    // Tool prediction accuracy
    const toolOverlap = prediction.likelyTools.filter(t => actualTools.includes(t)).length
    const toolAccuracy = prediction.likelyTools.length > 0
      ? toolOverlap / prediction.likelyTools.length
      : 0.5

    // Combined error
    magnitude = magnitude * 0.6 + (1 - toolAccuracy) * 0.4

    // What we learned
    const insight = magnitude > 0.6
      ? `Prediction missed: expected "${prediction.predictedAction}" but user did something different`
      : magnitude > 0.3
      ? `Partial match: prediction was in the right direction`
      : `Good prediction: model accurately anticipated user intent`

    const error: PredictionError = {
      prediction,
      actual: actualMessage.slice(0, 200),
      magnitude,
      insight,
    }

    this.errors.push(error)
    if (this.errors.length > this.maxHistory) {
      this.errors.shift()
    }

    // Update accuracy (exponential moving average)
    const correct = magnitude < 0.4 ? 1 : 0
    this.accuracy = this.accuracy * (1 - this.learningRate) + correct * this.learningRate

    // Update precision weighting
    // High accuracy → trust predictions more (higher precision)
    // Low accuracy → trust observations more (lower precision)
    this.precisionWeight = this.accuracy * 0.8 + 0.1

    // Track history
    this.messageHistory.push(actualMessage)
    for (const t of actualTools) this.toolHistory.push(t)
    if (this.messageHistory.length > this.maxHistory) this.messageHistory.shift()
    if (this.toolHistory.length > this.maxHistory * 3) this.toolHistory.splice(0, this.toolHistory.length - this.maxHistory * 3)

    return error
  }

  /**
   * Detect the current conversation pattern.
   */
  private detectPattern(messages: string[]): ConversationPattern {
    if (messages.length < 2) return 'follow_up'

    const last = (messages[messages.length - 1] || '').toLowerCase()
    const prev = (messages[messages.length - 2] || '').toLowerCase()

    // Meta questions about the process
    if (/\b(how do you|can you|what are you|what tools|capabilities)\b/.test(last)) {
      return 'meta_question'
    }

    // Verification patterns
    if (/\b(test|check|verify|does it work|run it|try it|show me)\b/.test(last)) {
      return 'verification'
    }

    // Refinement patterns
    if (/\b(change|modify|update|fix|adjust|instead|rather|but make|no,)\b/.test(last)) {
      return 'iterative_refinement'
    }

    // Drill-down patterns
    if (/\b(more about|explain|detail|deeper|elaborate|specifically|what about)\b/.test(last)) {
      return 'drill_down'
    }

    // Topic similarity check
    const lastWords = new Set(last.split(/\s+/).filter(w => w.length > 4))
    const prevWords = new Set(prev.split(/\s+/).filter(w => w.length > 4))
    const overlap = [...lastWords].filter(w => prevWords.has(w)).length
    const similarity = lastWords.size > 0 ? overlap / lastWords.size : 0

    if (similarity < 0.1) return 'topic_switch'
    if (similarity > 0.5) return 'drill_down'

    return 'follow_up'
  }

  /**
   * Predict likely tools from recent tool usage patterns.
   */
  private predictToolsFromHistory(recentTools: string[]): string[] {
    if (recentTools.length === 0) return []

    // Count tool frequencies
    const counts = new Map<string, number>()
    for (const t of recentTools.slice(-10)) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }

    // Return top 3 by frequency
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tool]) => tool)
  }

  /**
   * Get blind spots — things the engine consistently predicts wrong.
   */
  getBlindSpots(): string[] {
    const recentErrors = this.errors.slice(-20).filter(e => e.magnitude > 0.6)
    if (recentErrors.length < 3) return []

    // Find common patterns in high-error predictions
    const errorPatterns = new Map<string, number>()
    for (const err of recentErrors) {
      const words = err.actual.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      for (const w of words) {
        errorPatterns.set(w, (errorPatterns.get(w) ?? 0) + 1)
      }
    }

    return [...errorPatterns.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }

  /** Get full predictive state */
  getState(): PredictiveState {
    const correctCount = this.errors.filter(e => e.magnitude < 0.4).length

    return {
      accuracy: this.accuracy,
      totalPredictions: this.predictions.length,
      correctPredictions: correctCount,
      blindSpots: this.getBlindSpots(),
      precisionWeight: this.precisionWeight,
    }
  }

  /** Reset for new conversation */
  reset(): void {
    this.predictions = []
    this.errors = []
    this.messageHistory = []
    this.toolHistory = []
    this.accuracy = 0.5
    this.precisionWeight = 0.5
  }
}

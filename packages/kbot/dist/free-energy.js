// kbot Free Energy Principle — Active Inference Engine
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
/**
 * Active Inference Engine — minimizes free energy by balancing
 * belief updates (learning) with actions (tool use).
 *
 * When prediction errors are high → explore (research, read, search)
 * When prediction errors are low → exploit (write, execute, commit)
 */
export class ActiveInferenceEngine {
    beliefs;
    surpriseHistory = [];
    toolOutcomeHistory = [];
    beliefUpdates = 0;
    actionsTaken = 0;
    recentObservations = [];
    surpriseLog = [];
    // Hyperparameters
    explorationThreshold = 0.6; // Above this → explore
    exploitationThreshold = 0.3; // Below this → exploit
    learningRate = 0.15; // Belief update step size
    decayRate = 0.95; // Surprise memory decay
    constructor() {
        this.beliefs = {
            predictedIntent: '',
            confidence: 0.5,
            expectedOutcomes: new Map(),
            entropy: 1.0,
        };
    }
    /**
     * Integrate predictions from the PredictiveEngine to improve the generative model.
     * If the predictive engine detected 'drill_down', the generative model should predict
     * increasingly specific queries. If 'topic_switch', predict new domain.
     */
    integrateWithPredictiveEngine(predictions) {
        if (predictions.confidence > 0.7) {
            this.beliefs.predictedIntent = this.mapPatternToIntent(predictions.pattern);
            this.beliefs.confidence = Math.max(this.beliefs.confidence, predictions.confidence * 0.8);
        }
    }
    mapPatternToIntent(pattern) {
        const mapping = {
            'iterative_refinement': 'refine_previous',
            'topic_switch': 'explore_new',
            'drill_down': 'deepen_understanding',
            'error_recovery': 'fix_problem',
            'capability_test': 'test_limits',
            'creative_request': 'create_something',
            'verification': 'verify_result',
            'follow_up': 'continue_thread',
            'meta_question': 'introspect',
        };
        return mapping[pattern] || 'general';
    }
    /**
     * Observe a blackboard broadcast and update beliefs.
     * Blackboard entries reduce entropy proportional to their confidence.
     */
    observeBlackboardEntry(entry) {
        this.beliefs.entropy = Math.max(0, this.beliefs.entropy - entry.confidence * 0.1);
        const snippet = typeof entry.content === 'string' ? entry.content.slice(0, 100) : '';
        this.recentObservations.push(snippet);
        if (this.recentObservations.length > 20)
            this.recentObservations.shift();
    }
    /**
     * Get per-message surprise history for dream replay selection.
     * High-surprise messages are worth consolidating during "sleep."
     */
    getSurpriseHistory() {
        return this.surpriseLog.slice(-50);
    }
    /**
     * Observe a user message and compute surprise.
     * High surprise = our model of the user is wrong → update beliefs.
     */
    observeMessage(message, previousPrediction) {
        const words = new Set(message.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const predWords = previousPrediction
            ? new Set(previousPrediction.toLowerCase().split(/\s+/).filter(w => w.length > 3))
            : new Set();
        // Prediction error via Jaccard distance
        let predictionError = 1.0;
        if (predWords.size > 0 && words.size > 0) {
            const intersection = new Set([...words].filter(w => predWords.has(w)));
            const union = new Set([...words, ...predWords]);
            predictionError = 1 - (intersection.size / union.size);
        }
        // Information content (surprise in bits) = -log2(1 - predictionError)
        // Clamped to avoid infinity
        const p = Math.max(0.01, Math.min(0.99, 1 - predictionError));
        const informationContent = -Math.log2(p);
        const surprise = {
            informationContent,
            violatedExpectation: predictionError > 0.7 ? this.beliefs.predictedIntent : null,
            predictionError,
        };
        this.surpriseHistory.push(surprise);
        // Track per-message surprise for dream replay selection (Change 4)
        this.surpriseLog.push({
            message: message.slice(0, 100),
            surprise: predictionError,
            timestamp: Date.now(),
        });
        if (this.surpriseLog.length > 100)
            this.surpriseLog.shift();
        // Update beliefs via perceptual inference
        if (predictionError > this.explorationThreshold) {
            this.beliefs.confidence *= (1 - this.learningRate);
            this.beliefs.entropy = Math.min(2.0, this.beliefs.entropy + predictionError * 0.3);
            this.beliefUpdates++;
        }
        else {
            this.beliefs.confidence = Math.min(1.0, this.beliefs.confidence + this.learningRate * (1 - predictionError));
            this.beliefs.entropy = Math.max(0.1, this.beliefs.entropy - (1 - predictionError) * 0.2);
        }
        return surprise;
    }
    /**
     * Observe a tool execution result and update expected outcomes.
     */
    observeToolResult(toolName, success, relevance) {
        const predicted = this.beliefs.expectedOutcomes.get(toolName) ?? 0.5;
        const actual = success ? relevance : 0;
        this.toolOutcomeHistory.push({ tool: toolName, predicted, actual });
        // Update expected outcome for this tool (exponential moving average)
        const updated = predicted + this.learningRate * (actual - predicted);
        this.beliefs.expectedOutcomes.set(toolName, Math.max(0, Math.min(1, updated)));
        this.actionsTaken++;
    }
    /**
     * Compute current variational free energy.
     * F = E[log q(s) - log p(o,s)] ≈ prediction_error + entropy
     *
     * Lower free energy = better internal model.
     */
    computeFreeEnergy() {
        const recentSurprises = this.surpriseHistory.slice(-10);
        const avgSurprise = recentSurprises.length > 0
            ? recentSurprises.reduce((sum, s) => sum + s.informationContent, 0) / recentSurprises.length
            : 1.0;
        // Free energy ≈ expected surprise + model complexity (entropy)
        const freeEnergy = avgSurprise * 0.7 + this.beliefs.entropy * 0.3;
        return freeEnergy;
    }
    /**
     * Decide inference mode: should the agent explore or exploit?
     *
     * High free energy → explore (search, read, research — reduce uncertainty)
     * Low free energy → exploit (write, execute, commit — act on beliefs)
     */
    recommendPolicy() {
        const fe = this.computeFreeEnergy();
        const avgPredError = this.getAveragePredictionError();
        if (avgPredError > this.explorationThreshold || fe > 1.5) {
            return 'explore';
        }
        if (avgPredError < this.exploitationThreshold && fe < 0.8) {
            return 'exploit';
        }
        return 'balanced';
    }
    /**
     * Get tools recommended for the current policy.
     * Explore → information-gathering tools
     * Exploit → action-taking tools
     */
    recommendToolBias() {
        const policy = this.recommendPolicy();
        if (policy === 'explore') {
            return {
                preferred: ['web_search', 'read_file', 'grep', 'glob', 'git_log', 'arxiv_search', 'url_fetch'],
                discouraged: ['write_file', 'bash', 'git_commit', 'git_push'],
            };
        }
        if (policy === 'exploit') {
            return {
                preferred: ['write_file', 'edit_file', 'bash', 'git_commit', 'multi_file_write'],
                discouraged: [],
            };
        }
        return { preferred: [], discouraged: [] };
    }
    /**
     * Update the predicted intent (what the agent thinks the user wants next).
     */
    updatePrediction(intent) {
        this.beliefs.predictedIntent = intent;
    }
    /** Get running average prediction error */
    getAveragePredictionError() {
        const recent = this.surpriseHistory.slice(-10);
        if (recent.length === 0)
            return 0.5;
        return recent.reduce((sum, s) => sum + s.predictionError, 0) / recent.length;
    }
    /** Get the full free energy state for diagnostics */
    getState() {
        return {
            freeEnergy: this.computeFreeEnergy(),
            totalSurprise: this.surpriseHistory.reduce((sum, s) => sum + s.informationContent, 0),
            beliefUpdates: this.beliefUpdates,
            actionsTaken: this.actionsTaken,
            avgPredictionError: this.getAveragePredictionError(),
            policy: this.recommendPolicy(),
        };
    }
    /** Reset for new conversation */
    reset() {
        this.beliefs = { predictedIntent: '', confidence: 0.5, expectedOutcomes: new Map(), entropy: 1.0 };
        this.surpriseHistory = [];
        this.toolOutcomeHistory = [];
        this.beliefUpdates = 0;
        this.actionsTaken = 0;
        this.recentObservations = [];
        this.surpriseLog = [];
    }
}
//# sourceMappingURL=free-energy.js.map
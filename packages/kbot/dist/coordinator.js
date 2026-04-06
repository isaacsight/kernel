// kbot Intelligence Coordinator — Unified Brain
//
// Orchestrates kbot's 14 intelligence systems into a coherent cognitive loop.
// Called before, during, and after each agent interaction.
//
// All module imports are LAZY (dynamic) to avoid circular dependency issues.
// State persists to ~/.kbot/coordinator-state.json.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ── Lazy module loaders (dynamic imports to break circular deps) ──
async function getLearning() { return import('./learning.js'); }
async function getConfidence() { return import('./confidence.js'); }
async function getReasoning() { return import('./reasoning.js'); }
async function getGraphMemory() { return import('./graph-memory.js'); }
async function getLearnedRouter() { return import('./learned-router.js'); }
async function getIntentionality() { return import('./intentionality.js'); }
async function getTemporal() { return import('./temporal.js'); }
async function getBehaviour() { return import('./behaviour.js'); }
async function getEmergent() {
    try {
        // emergent.ts doesn't exist yet — will be created when emergent module is built
        // Using indirect import to prevent TypeScript from resolving at compile time
        const path = './tools/emergent' + '.js';
        return await import(/* @vite-ignore */ path);
    }
    catch {
        return null;
    }
}
// ── Defaults ──
const DEFAULT_CONFIDENCE_THRESHOLD = 0.4;
const CONSOLIDATION_INTERVAL = 10; // every N interactions
const MAX_EVAL_HISTORY = 200;
const MAX_INSIGHTS = 100;
const MAX_CONFLICTS = 50;
const MAX_GOALS = 20;
function defaultState() {
    return {
        lastPolicy: 'balanced',
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
        totalInteractions: 0,
        successRate: 0.5,
        activeGoals: [],
        recentInsights: [],
        conflictLog: [],
        evalHistory: [],
        patternsLearnedToday: 0,
        patternsLearnedDate: new Date().toISOString().slice(0, 10),
        routingAccuracy: 0.5,
        lastConsolidation: null,
        startedAt: new Date().toISOString(),
    };
}
// ── Persistence helpers ──
const KBOT_DIR = join(homedir(), '.kbot');
const STATE_FILE = join(KBOT_DIR, 'coordinator-state.json');
function ensureDir() {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
}
function loadState() {
    ensureDir();
    if (!existsSync(STATE_FILE))
        return defaultState();
    try {
        return { ...defaultState(), ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) };
    }
    catch {
        return defaultState();
    }
}
function saveState(state) {
    ensureDir();
    try {
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    }
    catch {
        // best-effort — coordinator state can be regenerated
    }
}
// ── Utility ──
function shortHash(s) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36).slice(0, 8);
}
function shortId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
// ── IntelligenceCoordinator ──
export class IntelligenceCoordinator {
    state;
    anticipatedTools = [];
    currentSessionId = null;
    pendingRouteAgent = null;
    initTime = Date.now();
    constructor() {
        this.state = loadState();
        // Reset daily pattern counter if it's a new day
        if (this.state.patternsLearnedDate !== todayStr()) {
            this.state.patternsLearnedToday = 0;
            this.state.patternsLearnedDate = todayStr();
        }
    }
    // ── Phase 1: Pre-Execution (before LLM API call) ──
    async preProcess(message, sessionId) {
        this.currentSessionId = sessionId;
        this.state.totalInteractions++;
        const result = {
            agent: null,
            confidence: 0.5,
            graphContext: '',
            reasoning: '',
            toolHints: [],
            systemPromptAddition: '',
            needsClarification: false,
            drives: null,
            anticipation: null,
        };
        // 1. Route message through learned-router
        try {
            const router = await getLearnedRouter();
            const route = router.learnedRoute(message);
            if (route) {
                result.agent = route.agent;
                result.confidence = route.confidence;
                this.pendingRouteAgent = route.agent;
            }
        }
        catch { /* non-critical */ }
        // 2. Check confidence — if below threshold, flag for clarification
        try {
            const conf = await getConfidence();
            const score = conf.estimateConfidence(message, '');
            result.confidence = Math.max(result.confidence, score.overall);
            if (score.overall < this.state.confidenceThreshold) {
                result.needsClarification = true;
                result.clarificationReason = score.reasoning || 'Low confidence — consider asking for more details';
            }
        }
        catch { /* non-critical */ }
        // 3. Query graph-memory for relevant context
        try {
            const graph = await getGraphMemory();
            const contextStr = graph.toContext(1500);
            if (contextStr && contextStr.length > 10) {
                result.graphContext = contextStr;
            }
            // Also find nodes related to message keywords
            const found = graph.findNode(message.slice(0, 100));
            if (found.length > 0) {
                const entityNames = found.slice(0, 5).map(n => n.name).join(', ');
                result.graphContext += `\nRelated entities: ${entityNames}`;
            }
        }
        catch { /* non-critical */ }
        // 4. Run abductive reasoning to infer intent
        try {
            const reasoning = await getReasoning();
            const strategy = reasoning.selectStrategy(message, '');
            result.reasoning = strategy.reasoning || strategy.chosenStrategy;
        }
        catch { /* non-critical */ }
        // 5. Check intentionality drives
        try {
            const intent = await getIntentionality();
            const drives = intent.getDriveState();
            if (drives && drives.drives && drives.drives.length > 0) {
                const top = drives.drives.reduce((a, b) => (b.weight * (1 - b.currentSatisfaction)) > (a.weight * (1 - a.currentSatisfaction)) ? b : a);
                result.drives = { dominant: top.name, level: top.weight };
            }
        }
        catch { /* non-critical */ }
        // 6. Anticipate what tools will be needed (temporal)
        try {
            const temporal = await getTemporal();
            const anticipated = temporal.anticipateNext([message], message);
            if (anticipated && anticipated.length > 0 && anticipated[0].prediction) {
                result.anticipation = anticipated[0].prediction;
                result.toolHints = anticipated[0].preparation || [];
                this.anticipatedTools = result.toolHints;
            }
        }
        catch { /* non-critical */ }
        // 7. Load behaviour rules for system prompt
        try {
            const behaviour = await getBehaviour();
            const prompt = behaviour.getBehaviourPrompt();
            if (prompt && prompt.length > 5) {
                result.systemPromptAddition = prompt;
            }
        }
        catch { /* non-critical */ }
        // 8. Synthesize policy from signals
        this.state.lastPolicy = this.synthesizePolicy(result.confidence);
        // Add policy hint to system prompt
        if (this.state.lastPolicy === 'explore') {
            result.systemPromptAddition += '\n\nNote: Consider unconventional approaches. The user may benefit from a different perspective.';
        }
        else if (this.state.lastPolicy === 'exploit') {
            result.systemPromptAddition += '\n\nNote: Use the most reliable, proven approach. The user needs a direct solution.';
        }
        // Trim empty lines from system prompt addition
        result.systemPromptAddition = result.systemPromptAddition.trim();
        this.save();
        return result;
    }
    // ── Phase 2: Tool Oversight (before each tool execution) ──
    evaluateToolCall(toolName, args, _context) {
        const evaluation = {
            allow: true,
            anticipated: false,
        };
        // 1. Check if tool matches anticipated needs
        if (this.anticipatedTools.length > 0) {
            evaluation.anticipated = this.anticipatedTools.some(hint => toolName.includes(hint) || hint.includes(toolName));
        }
        // 2. Confidence-gate: warn if success rate is low for this tool pattern
        // We check the eval history for similar tool usage patterns
        const recentEvals = this.state.evalHistory.slice(-20);
        if (recentEvals.length >= 5) {
            const avgScore = recentEvals.reduce((s, e) => s + e.score, 0) / recentEvals.length;
            if (avgScore < 0.3) {
                evaluation.warn = `Recent interaction quality is low (${(avgScore * 100).toFixed(0)}%). Consider verifying approach.`;
            }
        }
        // 3. Check behaviour rules for restrictions (synchronous)
        // We do a lightweight check against known restricted patterns
        try {
            // Destructive tool patterns that should trigger caution
            const cautionPatterns = [
                'delete', 'remove', 'drop', 'destroy', 'force', 'reset',
                'truncate', 'wipe', 'purge', 'nuke',
            ];
            const toolLower = toolName.toLowerCase();
            const argsStr = JSON.stringify(args).toLowerCase();
            const isDestructive = cautionPatterns.some(p => toolLower.includes(p) || argsStr.includes(p));
            if (isDestructive && !evaluation.warn) {
                evaluation.warn = `Tool "${toolName}" appears destructive. Verify intent.`;
            }
        }
        catch { /* non-critical */ }
        // 4. Log tool usage to graph-memory (async, fire-and-forget)
        this.logToolToGraph(toolName, args).catch(() => { });
        return evaluation;
    }
    // ── Phase 3: Post-Response Self-Evaluation ──
    async postProcess(message, response, toolsUsed, sessionId) {
        const result = {
            score: 0.5,
            patternsExtracted: 0,
            insightsGenerated: 0,
            graphUpdates: 0,
            consolidationTriggered: false,
        };
        // 1. Self-evaluate: was the response helpful? (heuristic, no LLM call)
        result.score = this.selfEvaluate(message, response, toolsUsed);
        // Record the evaluation
        const evalEntry = {
            sessionId,
            messageHash: shortHash(message),
            score: result.score,
            toolSuccessRate: toolsUsed.length > 0 ? result.score : 1,
            responseAppropriate: result.score >= 0.4,
            patternsMatched: 0,
            timestamp: new Date().toISOString(),
        };
        this.state.evalHistory.push(evalEntry);
        if (this.state.evalHistory.length > MAX_EVAL_HISTORY) {
            this.state.evalHistory = this.state.evalHistory.slice(-MAX_EVAL_HISTORY);
        }
        // Update rolling success rate (exponential moving average, alpha=0.1)
        this.state.successRate = this.state.successRate * 0.9 + result.score * 0.1;
        // 2. Extract patterns from successful interaction
        if (result.score >= 0.5) {
            try {
                const learning = await getLearning();
                learning.learnFromExchange(message, response, toolsUsed);
                result.patternsExtracted++;
                this.state.patternsLearnedToday++;
            }
            catch { /* non-critical */ }
        }
        // 3. Record routing outcome
        if (this.pendingRouteAgent) {
            try {
                const router = await getLearnedRouter();
                router.recordRoute(message, this.pendingRouteAgent, 'learned', result.score >= 0.5);
                // Update routing accuracy
                const routerStats = router.getRoutingStats();
                if (routerStats.totalRoutes > 0) {
                    this.state.routingAccuracy = routerStats.learnedHits / routerStats.totalRoutes;
                }
            }
            catch { /* non-critical */ }
            this.pendingRouteAgent = null;
        }
        // 4. Update graph-memory with entities from the exchange
        try {
            const graph = await getGraphMemory();
            const entities = graph.extractEntities(message, response);
            result.graphUpdates = entities.length;
        }
        catch { /* non-critical */ }
        // 5. Update confidence calibration
        try {
            const conf = await getConfidence();
            conf.recordCalibration(message, result.score, result.score >= 0.5 ? 1 : 0);
        }
        catch { /* non-critical */ }
        // 6. Update intentionality drives
        try {
            const intent = await getIntentionality();
            intent.updateMotivation({
                type: result.score >= 0.6 ? 'task_success' : result.score >= 0.3 ? 'learned_something' : 'task_failure',
            });
        }
        catch { /* non-critical */ }
        // 7. Check if emergent insights arise
        try {
            const emergent = await getEmergent();
            if (emergent && typeof emergent.synthesizeAcross === 'function') {
                const insights = await emergent.synthesizeAcross(this.state.evalHistory.slice(-10).map(e => e.messageHash));
                if (insights && Array.isArray(insights)) {
                    for (const insight of insights.slice(0, 3)) {
                        this.addInsight(typeof insight === 'string' ? insight : JSON.stringify(insight), 'emergent', 0.6);
                        result.insightsGenerated++;
                    }
                }
            }
        }
        catch { /* emergent module may not exist yet */ }
        // 8. Check if consolidation is needed
        if (this.state.totalInteractions % CONSOLIDATION_INTERVAL === 0) {
            result.consolidationTriggered = true;
            // Fire-and-forget — don't block the response
            this.consolidate().catch(() => { });
        }
        this.save();
        return result;
    }
    // ── Phase 4: Cross-Session Learning ──
    async consolidate() {
        const result = {
            patternsConsolidated: 0,
            rulesAdded: 0,
            insightsFound: 0,
            graphPruned: { nodes: 0, edges: 0 },
            routingAccuracy: this.state.routingAccuracy,
        };
        // 1. Run selfTrain() on accumulated patterns
        try {
            const learning = await getLearning();
            const trained = learning.selfTrain();
            result.patternsConsolidated = trained.optimized ?? 0;
        }
        catch { /* non-critical */ }
        // 2. Prune weak graph edges
        try {
            const graph = await getGraphMemory();
            // Decay nodes unused for 30 days
            graph.decayUnused(30);
            // Prune very weak connections
            const pruned = graph.prune(0.1);
            result.graphPruned = { nodes: pruned.removedNodes, edges: pruned.removedEdges };
            graph.save();
        }
        catch { /* non-critical */ }
        // 3. Derive behaviour rules from recurring patterns
        try {
            const learning = await getLearning();
            const topPatterns = learning.getTopPatterns(5);
            const behaviour = await getBehaviour();
            for (const pattern of topPatterns) {
                // If a pattern has been used many times, it might warrant a behaviour rule
                if (pattern.hits >= 10 && pattern.successRate >= 0.8) {
                    const ruleText = `When asked about "${pattern.intent}", prefer tools: ${pattern.toolSequence.join(', ')}`;
                    const added = behaviour.learnGeneral(ruleText);
                    if (added)
                        result.rulesAdded++;
                }
            }
        }
        catch { /* non-critical */ }
        // 4. Run emergent synthesis
        try {
            const emergent = await getEmergent();
            if (emergent && typeof emergent.consolidate === 'function') {
                const consolidated = await emergent.consolidate();
                if (consolidated && typeof consolidated.insights === 'number') {
                    result.insightsFound = consolidated.insights;
                }
            }
        }
        catch { /* emergent module may not exist yet */ }
        // 5. Update routing weights from outcome history
        try {
            const router = await getLearnedRouter();
            const stats = router.getRoutingStats();
            if (stats.totalRoutes > 0) {
                result.routingAccuracy = stats.learnedHits / stats.totalRoutes;
                this.state.routingAccuracy = result.routingAccuracy;
            }
        }
        catch { /* non-critical */ }
        this.state.lastConsolidation = new Date().toISOString();
        this.save();
        return result;
    }
    // ── Self-Evaluation (heuristic, no LLM call) ──
    selfEvaluate(message, response, toolsUsed) {
        let score = 0.5; // neutral baseline
        // Response length appropriateness
        if (message.length > 50 && response.length < 20) {
            score -= 0.15;
        }
        else if (response.length > 50) {
            score += 0.1;
        }
        // Tool success signals
        if (toolsUsed.length > 0) {
            const errorPatterns = ['error', 'failed', 'could not', 'unable to', 'not found', 'permission denied'];
            const responseLower = response.toLowerCase();
            const errorCount = errorPatterns.filter(p => responseLower.includes(p)).length;
            if (errorCount === 0)
                score += 0.2;
            else if (errorCount >= 3)
                score -= 0.2;
        }
        else {
            score += 0.05;
        }
        // Pattern match bonus
        try {
            if (this.pendingRouteAgent)
                score += 0.1;
        }
        catch { /* non-critical */ }
        // Actionable content bonus (code blocks, file paths)
        if (response.includes('```') || response.match(/(?:\/[\w./-]+\.\w+)/)) {
            score += 0.1;
        }
        // Repetition penalty
        const recentHashes = this.state.evalHistory.slice(-3).map(e => e.messageHash);
        if (recentHashes.includes(shortHash(response.slice(0, 200)))) {
            score -= 0.1;
        }
        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, score));
    }
    // ── Policy Synthesis ──
    synthesizePolicy(confidence) {
        // High confidence + high success rate → exploit (use proven approaches)
        if (confidence > 0.7 && this.state.successRate > 0.7)
            return 'exploit';
        // Low confidence or low success → explore (try new approaches)
        if (confidence < 0.4 || this.state.successRate < 0.3)
            return 'explore';
        return 'balanced';
    }
    // ── Graph Memory Logging ──
    async logToolToGraph(toolName, args) {
        try {
            const graph = await getGraphMemory();
            // Add the tool as an entity
            const toolNode = graph.findNode(toolName);
            let toolNodeId;
            if (toolNode.length > 0) {
                toolNodeId = toolNode[0].id;
            }
            else {
                const added = graph.addNode('entity', toolName, { kind: 'tool', lastUsed: new Date().toISOString() });
                toolNodeId = added?.id || '';
            }
            // If we have a session goal, connect tool to goal
            if (toolNodeId && this.state.activeGoals.length > 0) {
                const currentGoal = this.state.activeGoals[this.state.activeGoals.length - 1];
                const goalNodes = graph.findNode(currentGoal.description.slice(0, 50));
                if (goalNodes.length > 0) {
                    graph.addEdge(toolNodeId, goalNodes[0].id, 'used_for', 0.5);
                }
            }
            graph.save();
        }
        catch { /* graph logging is non-critical */ }
    }
    // ── Insight Management ──
    addInsight(content, source, confidence) {
        this.state.recentInsights.push({
            id: shortId(),
            content,
            source,
            confidence,
            timestamp: new Date().toISOString(),
        });
        // Trim to max
        if (this.state.recentInsights.length > MAX_INSIGHTS) {
            this.state.recentInsights = this.state.recentInsights.slice(-MAX_INSIGHTS);
        }
    }
    // ── Goal Management ──
    addGoal(description, priority = 0.5) {
        const goal = {
            id: shortId(),
            description,
            priority: Math.max(0, Math.min(1, priority)),
            status: 'active',
            created: new Date().toISOString(),
            toolsUsed: [],
        };
        this.state.activeGoals.push(goal);
        // Trim old completed/abandoned goals
        if (this.state.activeGoals.length > MAX_GOALS) {
            this.state.activeGoals = this.state.activeGoals
                .filter(g => g.status === 'active')
                .slice(-MAX_GOALS);
        }
        this.save();
        return goal;
    }
    completeGoal(goalId) {
        const goal = this.state.activeGoals.find(g => g.id === goalId);
        if (goal) {
            goal.status = 'completed';
            this.save();
        }
    }
    // ── Conflict Detection ──
    recordConflict(modules, description, resolution) {
        this.state.conflictLog.push({
            modules,
            description,
            resolution: resolution ?? null,
            timestamp: new Date().toISOString(),
        });
        if (this.state.conflictLog.length > MAX_CONFLICTS) {
            this.state.conflictLog = this.state.conflictLog.slice(-MAX_CONFLICTS);
        }
        this.save();
    }
    // ── Persistence ──
    load() {
        this.state = loadState();
        if (this.state.patternsLearnedDate !== todayStr()) {
            this.state.patternsLearnedToday = 0;
            this.state.patternsLearnedDate = todayStr();
        }
    }
    save() {
        saveState(this.state);
    }
    // ── Diagnostics ──
    getStats() {
        return {
            totalInteractions: this.state.totalInteractions,
            successRate: Math.round(this.state.successRate * 1000) / 1000,
            patternsLearnedToday: this.state.patternsLearnedToday,
            routingAccuracy: Math.round(this.state.routingAccuracy * 1000) / 1000,
            activeGoals: this.state.activeGoals.filter(g => g.status === 'active').length,
            recentInsights: this.state.recentInsights.length,
            conflicts: this.state.conflictLog.length,
            lastConsolidation: this.state.lastConsolidation,
            policy: this.state.lastPolicy,
            confidenceThreshold: this.state.confidenceThreshold,
            uptimeMs: Date.now() - this.initTime,
        };
    }
    getHealthReport() {
        const stats = this.getStats();
        const lines = [
            '=== Intelligence Coordinator Health Report ===',
            '',
            `Total interactions: ${stats.totalInteractions}`,
            `Success rate: ${(stats.successRate * 100).toFixed(1)}%`,
            `Routing accuracy: ${(stats.routingAccuracy * 100).toFixed(1)}%`,
            `Policy: ${stats.policy}`,
            `Confidence threshold: ${stats.confidenceThreshold}`,
            '',
            `Active goals: ${stats.activeGoals}`,
            `Recent insights: ${stats.recentInsights}`,
            `Conflicts: ${stats.conflicts}`,
            `Patterns learned today: ${stats.patternsLearnedToday}`,
            '',
            `Last consolidation: ${stats.lastConsolidation ?? 'never'}`,
            `Uptime: ${Math.round(stats.uptimeMs / 1000)}s`,
        ];
        // Health checks
        const issues = [];
        if (stats.successRate < 0.3)
            issues.push('LOW: Success rate below 30%');
        if (stats.routingAccuracy < 0.3)
            issues.push('LOW: Routing accuracy below 30%');
        if (stats.totalInteractions > 50 && stats.patternsLearnedToday === 0) {
            issues.push('STALE: No patterns learned today despite activity');
        }
        if (!stats.lastConsolidation) {
            issues.push('PENDING: No consolidation has ever run');
        }
        if (issues.length > 0) {
            lines.push('', '--- Issues ---');
            for (const issue of issues)
                lines.push(`  ! ${issue}`);
        }
        else {
            lines.push('', 'All systems nominal.');
        }
        return lines.join('\n');
    }
    getState() {
        return this.state;
    }
    /** Adjust the confidence threshold (e.g., user prefers fewer clarification requests) */
    setConfidenceThreshold(threshold) {
        this.state.confidenceThreshold = Math.max(0, Math.min(1, threshold));
        this.save();
    }
    /** Reset all state (for testing or fresh start) */
    reset() {
        this.state = defaultState();
        this.anticipatedTools = [];
        this.pendingRouteAgent = null;
        this.save();
    }
}
// ── Singleton ──
let singleton = null;
export function getCoordinator() {
    if (!singleton) {
        singleton = new IntelligenceCoordinator();
    }
    return singleton;
}
// ── Tool Registration ──
/** Register coordinator tools with the kbot tool registry */
export function registerCoordinatorTools() {
    // Lazy import to avoid circular deps at module load time
    import('./tools/index.js').then(({ registerTool }) => {
        registerTool({
            name: 'coordinator_status',
            description: 'Show intelligence coordinator stats: success rate, routing accuracy, policy, interactions, goals, insights',
            parameters: {},
            tier: 'free',
            execute: async () => {
                const c = getCoordinator();
                const stats = c.getStats();
                return JSON.stringify(stats, null, 2);
            },
        });
        registerTool({
            name: 'coordinator_health',
            description: 'Run a health check on all intelligence subsystems and report issues',
            parameters: {},
            tier: 'free',
            execute: async () => {
                const c = getCoordinator();
                return c.getHealthReport();
            },
        });
        registerTool({
            name: 'coordinator_consolidate',
            description: 'Force a cross-session learning consolidation: self-train patterns, prune graph, derive behaviour rules, synthesize insights',
            parameters: {},
            tier: 'free',
            execute: async () => {
                const c = getCoordinator();
                const result = await c.consolidate();
                return JSON.stringify(result, null, 2);
            },
        });
    }).catch(() => {
        // tools/index.js not available — skip registration
    });
}
// Auto-register tools when this module is imported
registerCoordinatorTools();
//# sourceMappingURL=coordinator.js.map
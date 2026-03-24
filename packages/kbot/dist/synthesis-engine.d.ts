export interface ToolAdoption {
    name: string;
    url: string;
    stars: number;
    reason: string;
    status: 'evaluated' | 'adopted' | 'rejected';
    matchedReflection?: string;
    evaluatedAt: string;
}
export interface AgentTrial {
    name: string;
    systemPrompt: string;
    targetCategory: string;
    status: 'trialing' | 'kept' | 'dissolved';
    taskCount: number;
    mu: number;
    sigma: number;
    createdAt: string;
    resolvedAt?: string;
}
export interface PaperInsight {
    title: string;
    url: string;
    technique: string;
    applicableTo: string;
    status: 'proposed' | 'implemented' | 'rejected';
    extractedAt: string;
}
export interface ActiveCorrection {
    rule: string;
    source: 'explicit' | 'reflection' | 'pattern_failure';
    severity: 'high' | 'medium' | 'low';
    occurrences: number;
    extractedAt: string;
}
export interface SkillMapEntry {
    agent: string;
    overall: {
        mu: number;
        sigma: number;
        confidence: string;
    };
    categories: Record<string, {
        mu: number;
        sigma: number;
    }>;
    status: 'proven' | 'developing' | 'untested';
}
export interface TopicWeight {
    topic: string;
    weight: number;
    engaged: number;
    ignored: number;
    updatedAt: string;
}
export interface SynthesisState {
    toolAdoptions: ToolAdoption[];
    agentTrials: AgentTrial[];
    paperInsights: PaperInsight[];
    skillMap: SkillMapEntry[];
    topicWeights: TopicWeight[];
    crossPollinatedCount: number;
    lastCycleAt: string;
    totalCycles: number;
    stats: {
        toolsEvaluated: number;
        toolsAdopted: number;
        toolsRejected: number;
        agentsTrialed: number;
        agentsKept: number;
        agentsDissolved: number;
        papersAnalyzed: number;
        patternsImplemented: number;
        correctionsActive: number;
        reflectionsClosed: number;
        patternsTransferred: number;
        engagementsFedBack: number;
    };
}
/**
 * Evaluate discovered tools against failure patterns in reflections.
 * If a discovered tool solves a problem that caused repeated failures,
 * mark it for adoption. Otherwise, mark as evaluated and move on.
 */
export declare function consumeDiscoveredTools(discoveryDir: string): ToolAdoption[];
/**
 * Evaluate proposed agents against Bayesian skill rating gaps.
 * If an agent targets a category with high sigma (uncertainty),
 * start a trial. After enough tasks, keep or dissolve.
 */
export declare function instantiateProposedAgents(discoveryDir: string): AgentTrial[];
/**
 * Match academic paper techniques against existing tool patterns.
 * If a paper describes an optimization that maps to a known pattern,
 * propose it as an improvement.
 */
export declare function extractPaperInsights(discoveryDir: string): PaperInsight[];
/**
 * Extract actionable corrections from:
 * - Explicit corrections in corrections.json
 * - Implicit corrections from reflection failure patterns
 * - Pattern failures (low success rate patterns)
 *
 * Produces active-corrections.json for prompt injection.
 */
export declare function buildActiveCorrections(): ActiveCorrection[];
/**
 * Format active corrections for system prompt injection.
 * Called by agent.ts to append corrections to the system prompt.
 */
export declare function getActiveCorrectionsPrompt(): string;
/**
 * Analyze reflections to adjust skill ratings.
 * If an agent consistently fails at a task category,
 * downgrade its mu in that category.
 */
export declare function closeReflectionLoop(): number;
/**
 * Transfer successful patterns from one project to another.
 * Patterns with high success rates in one project get added
 * to the global pool with reduced confidence.
 */
export declare function crossPollinatePatterns(): number;
/**
 * Build a human-readable skill map from Bayesian ratings.
 * Classifies agents as proven (low σ), developing (medium σ), or untested (high σ).
 */
export declare function buildSkillMap(): SkillMapEntry[];
/**
 * Format skill map for terminal display.
 */
export declare function formatSkillMap(map: SkillMapEntry[]): string;
/**
 * Analyze engagement outcomes from discovery actions
 * and produce topic weights for the next opportunity cycle.
 */
export declare function feedEngagementBack(discoveryDir: string): TopicWeight[];
export interface SynthesisCycleResult {
    toolAdoptions: ToolAdoption[];
    agentTrials: AgentTrial[];
    paperInsights: PaperInsight[];
    activeCorrections: ActiveCorrection[];
    reflectionsClosed: number;
    patternsTransferred: number;
    skillMap: SkillMapEntry[];
    topicWeights: TopicWeight[];
    cycleNumber: number;
}
/**
 * Run the full synthesis cycle:
 * 1. Consume discovered tools
 * 2. Instantiate proposed agents
 * 3. Extract paper insights
 * 4. Build active corrections
 * 5. Close reflection loop
 * 6. Cross-pollinate patterns
 * 7. Build skill map
 * 8. Feed engagement back
 *
 * All operations are heuristic — no LLM calls.
 * Safe to call frequently — each operation is idempotent.
 */
export declare function synthesize(discoveryDir?: string): SynthesisCycleResult;
/**
 * Get synthesis engine stats for kbot status display.
 */
export declare function getSynthesisEngineStats(): SynthesisState['stats'] & {
    totalCycles: number;
    lastCycleAt: string;
};
/**
 * Format synthesis results for terminal display.
 */
export declare function formatSynthesisResult(result: SynthesisCycleResult): string;
//# sourceMappingURL=synthesis-engine.d.ts.map
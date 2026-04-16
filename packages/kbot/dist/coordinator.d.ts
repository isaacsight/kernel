export interface Goal {
    id: string;
    description: string;
    priority: number;
    status: 'active' | 'completed' | 'abandoned';
    created: string;
    toolsUsed: string[];
}
export interface Insight {
    id: string;
    content: string;
    source: string;
    confidence: number;
    timestamp: string;
}
export interface Conflict {
    modules: [string, string];
    description: string;
    resolution: string | null;
    timestamp: string;
}
export interface SelfEval {
    sessionId: string;
    messageHash: string;
    score: number;
    toolSuccessRate: number;
    responseAppropriate: boolean;
    patternsMatched: number;
    timestamp: string;
}
export interface PreProcessResult {
    agent: string | null;
    confidence: number;
    graphContext: string;
    reasoning: string;
    toolHints: string[];
    systemPromptAddition: string;
    needsClarification: boolean;
    clarificationReason?: string;
    drives: {
        dominant: string;
        level: number;
    } | null;
    anticipation: string | null;
}
export interface ToolEvaluation {
    allow: boolean;
    warn?: string;
    alternatives?: string[];
    anticipated: boolean;
}
export interface PostProcessResult {
    score: number;
    patternsExtracted: number;
    insightsGenerated: number;
    graphUpdates: number;
    consolidationTriggered: boolean;
}
export interface ConsolidationResult {
    patternsConsolidated: number;
    rulesAdded: number;
    insightsFound: number;
    graphPruned: {
        nodes: number;
        edges: number;
    };
    routingAccuracy: number;
}
export interface CoordinatorStats {
    totalInteractions: number;
    successRate: number;
    patternsLearnedToday: number;
    routingAccuracy: number;
    activeGoals: number;
    recentInsights: number;
    conflicts: number;
    lastConsolidation: string | null;
    policy: 'explore' | 'exploit' | 'balanced';
    confidenceThreshold: number;
    uptimeMs: number;
}
export interface CoordinatorState {
    lastPolicy: 'explore' | 'exploit' | 'balanced';
    confidenceThreshold: number;
    totalInteractions: number;
    successRate: number;
    activeGoals: Goal[];
    recentInsights: Insight[];
    conflictLog: Conflict[];
    evalHistory: SelfEval[];
    patternsLearnedToday: number;
    patternsLearnedDate: string;
    routingAccuracy: number;
    lastConsolidation: string | null;
    startedAt: string;
}
export declare class IntelligenceCoordinator {
    private state;
    private anticipatedTools;
    private currentSessionId;
    private pendingRouteAgent;
    private initTime;
    constructor();
    preProcess(message: string, sessionId: string): Promise<PreProcessResult>;
    evaluateToolCall(toolName: string, args: Record<string, unknown>, _context?: {
        sessionId?: string;
        agent?: string;
        message?: string;
    }): ToolEvaluation;
    postProcess(message: string, response: string, toolsUsed: string[], sessionId: string): Promise<PostProcessResult>;
    consolidate(): Promise<ConsolidationResult>;
    private selfEvaluate;
    private synthesizePolicy;
    private logToolToGraph;
    private addInsight;
    addGoal(description: string, priority?: number): Goal;
    completeGoal(goalId: string): void;
    recordConflict(modules: [string, string], description: string, resolution?: string): void;
    load(): void;
    save(): void;
    getStats(): CoordinatorStats;
    getHealthReport(): string;
    getState(): Readonly<CoordinatorState>;
    /** Adjust the confidence threshold (e.g., user prefers fewer clarification requests) */
    setConfidenceThreshold(threshold: number): void;
    /** Reset all state (for testing or fresh start) */
    reset(): void;
}
export declare function getCoordinator(): IntelligenceCoordinator;
/** Register coordinator tools with the kbot tool registry */
export declare function registerCoordinatorTools(): void;
export interface Task {
    id: string;
    goal: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    agent: string;
    dependencies: string[];
    result?: string;
    error?: string;
}
export interface CoordinatorPlan {
    id: string;
    goal: string;
    tasks: Task[];
    createdAt: string;
    completedAt?: string;
    status: 'planning' | 'executing' | 'done' | 'failed';
}
/**
 * Decompose a high-level goal into ordered sub-tasks with dependencies.
 * Uses the LLM (via runAgent) to break the goal into 2-6 concrete tasks.
 */
export declare function decompose(goal: string): Promise<CoordinatorPlan>;
/**
 * Execute a plan's tasks in dependency order (sequential for now).
 * Tasks whose dependencies are all 'done' are eligible to run.
 */
export declare function execute(plan: CoordinatorPlan): Promise<CoordinatorPlan>;
/**
 * Convenience: decompose a goal, execute the plan, and synthesize results.
 * Returns a human-readable summary of what was accomplished.
 */
export declare function coordinate(goal: string): Promise<string>;
//# sourceMappingURL=coordinator.d.ts.map
/** A Bayesian skill rating with mean and uncertainty */
export interface Rating {
    /** Mean skill estimate (default: 25.0) */
    mu: number;
    /** Uncertainty / standard deviation (default: 8.333) */
    sigma: number;
}
/** Outcome of a routing decision */
export type Outcome = 'win' | 'loss' | 'draw';
/** Result of a routing decision */
export interface RouteResult {
    /** Best agent for this task */
    agent: string;
    /** Detected task category */
    category: string;
    /** Confidence in routing (0-1, based on sigma reduction) */
    confidence: number;
    /** Conservative estimate (mu - 2*sigma) */
    score: number;
    /** All agents ranked */
    rankings: Array<{
        agent: string;
        score: number;
        confidence: number;
    }>;
}
/** Configuration for the router */
export interface SkillRouterConfig {
    /** List of agent IDs to route between */
    agents: string[];
    /** Task categories the router recognizes */
    categories?: string[];
    /** Custom keyword map for category classification */
    keywords?: Record<string, string[]>;
    /** Initial mu (default: 25.0) */
    initialMu?: number;
    /** Initial sigma (default: mu/3) */
    initialSigma?: number;
    /** Minimum sigma floor (default: 0.5) */
    minSigma?: number;
}
export declare class SkillRouter {
    private agents;
    private categories;
    private keywords;
    private ratings;
    private mu0;
    private sigma0;
    private minSigma;
    private dirty;
    constructor(config: SkillRouterConfig);
    /**
     * Classify a message into a task category using keyword matching.
     * Fast — no LLM call needed. O(keywords * words).
     */
    categorize(message: string): string;
    /**
     * Route a message to the best agent.
     * Returns the agent, category, confidence, and full rankings.
     */
    route(message: string, category?: string): RouteResult;
    /**
     * Route with a minimum confidence threshold.
     * Returns null if no agent meets the threshold — useful for fallback logic.
     */
    routeWithThreshold(message: string, minConfidence: number): RouteResult | null;
    /**
     * Record the outcome of a routing decision.
     * Updates the agent's rating for the given category.
     *
     * Uses a simplified Bradley-Terry model:
     *   beta = sigma / 2
     *   c = sqrt(2 * beta^2 + sigma^2)
     *   K = sigma^2 / c
     *   mu' = mu + K * (S - E)     where S = outcome score, E = expected
     *   sigma' = sigma * sqrt(1 - K/c)
     */
    recordOutcome(agent: string, category: string, outcome: Outcome): void;
    /** Get rating for a specific agent and category */
    getRating(agent: string, category: string): Rating | null;
    /** Get all ratings for an agent */
    getAgentRatings(agent: string): Record<string, Rating> | null;
    /** Get top agents for a category */
    getTopAgents(category: string, limit?: number): Array<{
        agent: string;
        score: number;
        confidence: number;
    }>;
    /** Get the confidence that enough data exists for reliable routing */
    getSystemConfidence(): number;
    /** Export ratings as JSON string */
    toJSON(): string;
    /** Import ratings from JSON string */
    fromJSON(json: string): void;
    /** Save ratings to a file */
    save(path: string): void;
    /** Load ratings from a file */
    load(path: string): void;
    /** Whether there are unsaved changes */
    isDirty(): boolean;
    /** Get a human-readable summary of the routing state */
    summary(): string;
}
/**
 * Create a pre-configured router with common agent roles.
 * Ready to use out of the box — just start routing and recording outcomes.
 */
export declare function createDefaultRouter(): SkillRouter;
//# sourceMappingURL=index.d.ts.map
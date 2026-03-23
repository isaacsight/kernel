export interface Rating {
    /** Mean skill estimate */
    mu: number;
    /** Uncertainty (standard deviation) */
    sigma: number;
}
export interface AgentCategoryRatings {
    [category: string]: Rating;
    /** Overall rating across all categories */
    _overall: Rating;
}
export interface AgentRatings {
    [agentId: string]: AgentCategoryRatings;
}
export type TaskCategory = 'coding' | 'debugging' | 'refactoring' | 'research' | 'analysis' | 'writing' | 'devops' | 'security' | 'design' | 'general' | 'data' | 'communication';
export type Outcome = 'win' | 'loss' | 'draw';
export declare class SkillRatingSystem {
    private ratings;
    private dirty;
    constructor();
    private loadSync;
    save(): Promise<void>;
    load(): Promise<void>;
    /**
     * Classify a message into a task category using keyword matching.
     * Fast, no LLM call needed.
     */
    categorizeMessage(message: string): TaskCategory;
    /**
     * Get a rating for a specific agent and category.
     * Returns the category-specific rating if it exists, otherwise the overall rating.
     */
    private getRating;
    /**
     * Conservative rating estimate: mu - 2*sigma
     * This is the lower bound of the ~95% confidence interval.
     * Agents need to both be good AND have enough data to rank highly.
     */
    private conservativeEstimate;
    /**
     * Get agents ranked by conservative estimate for a given category.
     */
    getRankedAgents(category: TaskCategory): Array<{
        agent: string;
        rating: Rating;
        confidence: number;
    }>;
    /**
     * Update an agent's rating based on an outcome.
     *
     * Uses a simplified Bradley-Terry model:
     *   beta = sigma / 2  (dynamics factor)
     *   c = sqrt(2 * beta^2 + sigma^2)  (normalization factor)
     *   K = sigma^2 / c  (update magnitude — bigger when uncertain)
     *   mu_new = mu + K * outcome_factor
     *   sigma_new = sigma * sqrt(max(1 - sigma^2/c^2, epsilon))
     *
     * outcome_factor: win = +1, loss = -1, draw = 0
     */
    recordOutcome(agent: string, category: TaskCategory, outcome: Outcome): void;
    /**
     * Core Bradley-Terry update step.
     * @param rating The rating to mutate in place
     * @param outcome The match outcome
     * @param dampen Dampen the update (0-1), 1 = full update
     */
    private updateRating;
    /**
     * Get the best agent for a task based on Bayesian skill ratings.
     *
     * Returns null if all agents still have high uncertainty (not enough data).
     * The confidence threshold ensures we only route when we have meaningful signal.
     */
    getAgentForTask(message: string): {
        agent: string;
        confidence: number;
        category: TaskCategory;
    } | null;
    /**
     * Get summary stats for each agent: their top category and confidence level.
     */
    getStats(): Record<string, {
        topCategory: string;
        confidence: number;
    }>;
    /**
     * Get raw ratings for an agent (for debugging/display).
     */
    getAgentRatings(agent: string): AgentCategoryRatings | null;
}
export declare function getSkillRatingSystem(): SkillRatingSystem;
//# sourceMappingURL=skill-rating.d.ts.map
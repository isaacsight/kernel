/** Flush all pending writes immediately (call on exit) — only saves dirty files */
export declare function flushPendingWrites(): void;
export interface CachedPattern {
    /** Normalized intent (lowercase, stop-words removed) */
    intent: string;
    /** Keywords extracted from the message */
    keywords: string[];
    /** Tool call sequence that succeeded */
    toolSequence: string[];
    /** How many times this pattern was used */
    hits: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Last used timestamp */
    lastUsed: string;
    /** Average tokens saved vs first attempt */
    avgTokensSaved: number;
}
/** Extract keywords from a message */
export declare function extractKeywords(message: string): string[];
/** Find a matching cached pattern (similarity > 0.6) */
export declare function findPattern(message: string): CachedPattern | null;
/** Record a successful pattern */
export declare function recordPattern(message: string, toolSequence: string[], tokensSaved?: number): void;
/** Record a failed pattern */
export declare function recordPatternFailure(message: string): void;
export interface CachedSolution {
    /** Question/problem signature */
    question: string;
    /** Keywords for matching */
    keywords: string[];
    /** The solution that worked */
    solution: string;
    /** Confidence (0-1) based on outcome */
    confidence: number;
    /** Times this solution was reused */
    reuses: number;
    /** Created timestamp */
    created: string;
}
/** Find relevant cached solutions for a message */
export declare function findSolutions(message: string, maxResults?: number): CachedSolution[];
/** Cache a solution from a successful interaction */
export declare function cacheSolution(question: string, solution: string): void;
export interface UserProfile {
    /** Preferred response length: 'concise' | 'detailed' | 'auto' */
    responseStyle: 'concise' | 'detailed' | 'auto';
    /** Primary languages/frameworks detected */
    techStack: string[];
    /** Common task types (what user asks for most) */
    taskPatterns: Record<string, number>;
    /** Preferred agents */
    preferredAgents: Record<string, number>;
    /** Total messages sent */
    totalMessages: number;
    /** Total tokens used */
    totalTokens: number;
    /** Total tokens saved by learning */
    tokensSaved: number;
    /** Average tokens per message (tracks efficiency over time) */
    avgTokensPerMessage: number;
    /** Session count */
    sessions: number;
}
export declare function getProfile(): UserProfile;
/** Update profile after each interaction */
export declare function updateProfile(opts: {
    tokens?: number;
    tokensSaved?: number;
    agent?: string;
    taskType?: string;
    techTerms?: string[];
    /** Original user message — used for Bayesian skill rating categorization */
    message?: string;
    /** Whether the interaction was successful (for skill rating) */
    success?: boolean;
}): void;
export declare function incrementSessions(): number;
export declare function buildLearningContext(message: string): string;
export interface LearningStats {
    patternsCount: number;
    solutionsCount: number;
    totalTokensSaved: number;
    avgTokensPerMsg: number;
    totalMessages: number;
    sessions: number;
    efficiency: string;
}
export declare function getStats(): LearningStats;
/** Classify task type from message */
export declare function classifyTask(message: string): string;
export interface KnowledgeEntry {
    /** The fact or piece of knowledge */
    fact: string;
    /** Category: preference, fact, rule, context, project */
    category: 'preference' | 'fact' | 'rule' | 'context' | 'project';
    /** Keywords for retrieval */
    keywords: string[];
    /** Source: 'user-taught' | 'extracted' | 'observed' */
    source: 'user-taught' | 'extracted' | 'observed';
    /** Confidence 0-1 */
    confidence: number;
    /** Times referenced */
    references: number;
    /** Created */
    created: string;
    /** Last referenced */
    lastUsed: string;
}
/** Store a knowledge entry (user teaches kbot something) */
export declare function learnFact(fact: string, category?: KnowledgeEntry['category'], source?: KnowledgeEntry['source']): void;
/** Find relevant knowledge for a message */
export declare function findKnowledge(message: string, maxResults?: number): KnowledgeEntry[];
/** Extract knowledge from a conversation exchange — stricter matching to reduce false positives */
export declare function extractKnowledge(userMessage: string, assistantResponse: string): void;
export interface Correction {
    /** What the user said (the correction) */
    userMessage: string;
    /** What the assistant said wrong */
    wrongResponse: string;
    /** Extracted rule from the correction */
    rule: string;
    /** Times this correction pattern has occurred */
    occurrences: number;
    /** Created */
    created: string;
}
/** Record a user correction */
export declare function recordCorrection(userMessage: string, wrongResponse: string): void;
/** Get relevant corrections to avoid repeating mistakes */
export declare function getRelevantCorrections(message: string, max?: number): Correction[];
export interface ProjectMemory {
    /** Directory path */
    path: string;
    /** Project name (from package.json, Cargo.toml, etc.) */
    name: string;
    /** Detected stack */
    stack: string[];
    /** Key files the user works with most */
    frequentFiles: Record<string, number>;
    /** Project-specific knowledge entries */
    notes: string[];
    /** Last accessed */
    lastAccessed: string;
}
/** Get or create project memory for current directory */
export declare function getProjectMemory(cwd: string): ProjectMemory | null;
/** Record project information */
export declare function updateProjectMemory(cwd: string, data: {
    name?: string;
    stack?: string[];
    file?: string;
    note?: string;
}): void;
/** Override the original buildLearningContext with enhanced version */
export declare function buildFullLearningContext(message: string, cwd?: string): string;
export declare function learnFromExchange(userMessage: string, assistantResponse: string, toolsUsed: string[], cwd?: string): void;
interface TrainingLog {
    lastRun: string;
    runsTotal: number;
    entriesPruned: number;
    insightsSynthesized: number;
    patternsOptimized: number;
}
/** Run self-training: prune stale knowledge, optimize patterns, synthesize insights */
export declare function selfTrain(): {
    pruned: number;
    optimized: number;
    synthesized: number;
    summary: string;
};
/** Check if self-training should run (auto-trigger every 50 messages) */
export declare function shouldAutoTrain(): boolean;
/** Get training log for display */
export declare function getTrainingLog(): TrainingLog;
export declare function getExtendedStats(): LearningStats & {
    knowledgeCount: number;
    correctionsCount: number;
    projectsCount: number;
    topKnowledge: string[];
};
/** Get the top N patterns from the pattern cache, ranked by effectiveness */
export declare function getTopPatterns(n?: number): CachedPattern[];
/** Get the top N solutions from the solution index, ranked by confidence and reuse */
export declare function getTopSolutions(n?: number): CachedSolution[];
/** Get a text summary of the user profile for consolidation prompts */
export declare function getProfileSummary(): string;
export {};
//# sourceMappingURL=learning.d.ts.map
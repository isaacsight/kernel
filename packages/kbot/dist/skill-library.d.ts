export interface SkillStep {
    tool: string;
    argsTemplate: Record<string, unknown>;
}
export interface Skill {
    id: string;
    name: string;
    description: string;
    steps: SkillStep[];
    /** Bag-of-words embedding for fast local matching (no API needed) */
    embedding: number[];
    successCount: number;
    failureCount: number;
    lastUsed: number;
    created: number;
    /** IDs of sub-skills this skill composes */
    composedOf?: string[];
    /** Original messages that produced this skill */
    sourceMessages: string[];
    /** Tags extracted from messages for keyword matching */
    tags: string[];
}
export interface SkillLibrary {
    version: number;
    skills: Skill[];
    vocabulary: string[];
}
/** Force-save immediately (call on exit) */
export declare function flushSkillLibrary(): void;
/**
 * Distill a skill from a successful tool execution.
 * Called after every successful agent response with 2+ tool calls.
 */
export declare function distillSkill(message: string, toolSequence: Array<{
    name: string;
    args: Record<string, unknown>;
}>, success: boolean): Skill | null;
/**
 * Retrieve relevant skills for a given task message.
 * Uses embedding similarity (Ollama if available, else bag-of-words).
 */
export declare function retrieveSkills(message: string, maxResults?: number): Promise<Skill[]>;
/**
 * Format retrieved skills for injection into the system prompt.
 */
export declare function formatSkillsForPrompt(skills: Skill[]): string;
/**
 * Return the full skill library.
 */
export declare function getSkillLibrary(): SkillLibrary;
/**
 * Prune the skill library: remove low-success skills, keep top 500.
 * Sorting priority: successCount desc, then lastUsed desc.
 */
export declare function pruneSkillLibrary(): void;
/**
 * Record a failure for a skill (called when a retrieved skill's tool chain fails).
 */
export declare function recordSkillFailure(skillId: string): void;
//# sourceMappingURL=skill-library.d.ts.map
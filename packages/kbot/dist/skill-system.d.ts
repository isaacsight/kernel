export interface Skill {
    /** Unique slug (filename without .md) */
    id: string;
    /** Human-readable title */
    title: string;
    /** Short description for search matching */
    description: string;
    /** Keywords for search */
    keywords: string[];
    /** Domain: general, music, code, research, devops, security */
    domain: string;
    /** The step-by-step procedure */
    steps: string[];
    /** Common issues and fixes */
    issues: string[];
    /** Tools used */
    tools: string[];
    /** Success rate (0-1) */
    successRate: number;
    /** Times executed */
    executions: number;
    /** Version (incremented on patches) */
    version: number;
    /** Created timestamp */
    created: string;
    /** Last used timestamp */
    lastUsed: string;
    /** Last patched timestamp */
    lastPatched: string;
}
/** List all skills */
export declare function listSkills(domain?: string): Skill[];
/** Find skills matching a query */
export declare function findSkills(query: string, domain?: string): Skill[];
/** Get a specific skill by ID */
export declare function getSkill(id: string): Skill | null;
/** Create a new skill from a completed task */
export declare function createSkill(input: {
    title: string;
    description: string;
    keywords: string[];
    domain: string;
    steps: string[];
    issues?: string[];
    tools: string[];
}): Skill;
/** Record a skill execution (success or failure) */
export declare function recordSkillExecution(id: string, success: boolean): void;
/** Patch a skill (update steps, add issues) */
export declare function patchSkill(id: string, patches: {
    addSteps?: string[];
    removeSteps?: string[];
    addIssues?: string[];
    replaceSteps?: string[];
}): void;
/** Delete a skill */
export declare function deleteSkill(id: string): boolean;
/**
 * Analyze a tool call sequence and create a skill if it's complex enough.
 * Call this at the end of a conversation with the tool history.
 */
export declare function maybeCreateSkill(toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
}>, userMessage: string, domain?: string): Skill | null;
export declare function registerSkillTools(): void;
//# sourceMappingURL=skill-system.d.ts.map
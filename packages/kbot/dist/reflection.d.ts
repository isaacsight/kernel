export interface Perspective {
    agent: string;
    critique: string;
}
export interface Reflection {
    id: string;
    taskMessage: string;
    failureType: 'low_score' | 'error_correction' | 'user_rejection';
    perspectives: Perspective[];
    synthesis: string;
    lesson: string;
    created: string;
}
/**
 * Generate reflections from 5 key specialist perspectives.
 * All heuristic-based — no LLM calls.
 */
export declare function generateReflections(message: string, response: string, failureType: 'low_score' | 'error_correction' | 'user_rejection'): Reflection;
/**
 * Retrieve past reflections relevant to a given message.
 * Uses keyword overlap to find similar past failures.
 */
export declare function getRelevantReflections(message: string, max?: number): Reflection[];
/**
 * Format reflections for injection into the system prompt.
 * Returns an empty string if no reflections exist.
 */
export declare function formatReflectionsForPrompt(reflections: Reflection[]): string;
/**
 * Detect if a user message indicates rejection of the previous response.
 */
export declare function isUserRejection(message: string): boolean;
//# sourceMappingURL=reflection.d.ts.map
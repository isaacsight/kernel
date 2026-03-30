/**
 * Load behaviour rules from a file.
 * Returns an array of rule strings.
 */
export declare function loadRules(path: string): string[];
/**
 * Add a new rule, avoiding exact duplicates.
 * Returns true if the rule was added (not a duplicate).
 */
export declare function addRule(path: string, rule: string, header: string): boolean;
/**
 * Remove a rule by partial match.
 */
export declare function removeRule(path: string, search: string, header: string): boolean;
/** Get all general behaviour rules */
export declare function getGeneralRules(): string[];
/** Get all music behaviour rules */
export declare function getMusicRules(): string[];
/** Get all rules combined, formatted for system prompt injection */
export declare function getBehaviourPrompt(): string;
/** Add a general behaviour rule */
export declare function learnGeneral(rule: string): boolean;
/** Add a music behaviour rule */
export declare function learnMusic(rule: string): boolean;
/** Remove a general rule */
export declare function forgetGeneral(search: string): boolean;
/** Remove a music rule */
export declare function forgetMusic(search: string): boolean;
export declare function registerBehaviourTools(): void;
//# sourceMappingURL=behaviour.d.ts.map
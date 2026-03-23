/** Creative agent definition — matches the shape used by PRESETS and BUILTIN_AGENTS in matrix.ts */
export declare const CREATIVE_PRESET: {
    name: string;
    prompt: string;
};
/** Creative agent built-in registration — matches BUILTIN_AGENTS shape in matrix.ts */
export declare const CREATIVE_BUILTIN: {
    name: string;
    icon: string;
    color: string;
    prompt: string;
};
/** Creative agent keyword list for learned-router.ts */
export declare const CREATIVE_KEYWORDS: string[];
/** Creative agent routing patterns for learned-router.ts */
export declare const CREATIVE_PATTERNS: {
    pattern: RegExp;
    agent: "creative";
    confidence: number;
}[];
/** Bridge/IDE agent entry for getAgents() in bridge.ts */
export declare const CREATIVE_AGENT_ENTRY: {
    id: string;
    name: string;
    description: string;
};
//# sourceMappingURL=creative.d.ts.map
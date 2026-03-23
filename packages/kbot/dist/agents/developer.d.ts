/** Developer agent definition — matches the shape used by PRESETS and BUILTIN_AGENTS in matrix.ts */
export declare const DEVELOPER_PRESET: {
    name: string;
    prompt: string;
};
/** Developer agent built-in registration — matches BUILTIN_AGENTS shape in matrix.ts */
export declare const DEVELOPER_BUILTIN: {
    name: string;
    icon: string;
    color: string;
    prompt: string;
};
/** Developer agent keyword list for learned-router.ts */
export declare const DEVELOPER_KEYWORDS: string[];
/** Developer agent routing patterns for learned-router.ts */
export declare const DEVELOPER_PATTERNS: {
    pattern: RegExp;
    agent: "developer";
    confidence: number;
}[];
/** Bridge/IDE agent entry for getAgents() in bridge.ts */
export declare const DEVELOPER_AGENT_ENTRY: {
    id: string;
    name: string;
    description: string;
};
//# sourceMappingURL=developer.d.ts.map
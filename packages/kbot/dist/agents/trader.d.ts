/** Trader agent definition — matches the shape used by PRESETS and BUILTIN_AGENTS in matrix.ts */
export declare const TRADER_PRESET: {
    name: string;
    prompt: string;
};
/** Trader agent built-in registration — matches BUILTIN_AGENTS shape in matrix.ts */
export declare const TRADER_BUILTIN: {
    name: string;
    icon: string;
    color: string;
    prompt: string;
};
/** Trader agent keyword list for learned-router.ts */
export declare const TRADER_KEYWORDS: string[];
/** Trader agent routing patterns for learned-router.ts */
export declare const TRADER_PATTERNS: RegExp[];
/** Entry point for dynamic agent loading */
export declare const agent: {
    preset: {
        name: string;
        prompt: string;
    };
    builtin: {
        name: string;
        icon: string;
        color: string;
        prompt: string;
    };
    keywords: string[];
    patterns: RegExp[];
};
//# sourceMappingURL=trader.d.ts.map
/**
 * Build the ground-truth prompt block. Cached after first call since
 * version/provider/hardware don't change mid-session.
 */
export declare function getSelfAwarenessPrompt(): string;
/** Reset the cache — used by tests and if the provider changes mid-session. */
export declare function resetSelfAwarenessCache(): void;
//# sourceMappingURL=self-awareness.d.ts.map
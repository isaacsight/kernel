export interface ProjectContext {
    isGitRepo: boolean;
    repoRoot?: string;
    branch?: string;
    language?: string;
    framework?: string;
    packageManager?: string;
    fileTree: string;
    recentChanges?: string;
    /** Contents of .kbot.md or KBOT.md (like CLAUDE.md) */
    projectInstructions?: string;
}
/** Gather full project context. Called once at startup and cached. */
export declare function gatherContext(): ProjectContext;
/** Format context as a system prompt snippet */
export declare function formatContextForPrompt(ctx: ProjectContext): string;
//# sourceMappingURL=context.d.ts.map
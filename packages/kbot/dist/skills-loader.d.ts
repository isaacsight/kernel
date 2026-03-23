export interface SkillFile {
    name: string;
    path: string;
    content: string;
    tokens: number;
}
/**
 * Discover and load skill files from project and global directories.
 * Returns formatted string ready to inject into system prompt.
 */
export declare function loadSkills(projectRoot: string): string;
/**
 * Discover .md files from both project-local and global skill directories.
 * Project skills take precedence (loaded first, consume token budget first).
 */
export declare function discoverSkillFiles(projectRoot: string): SkillFile[];
//# sourceMappingURL=skills-loader.d.ts.map
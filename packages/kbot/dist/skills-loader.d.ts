export interface SkillFile {
    name: string;
    path: string;
    content: string;
    description: string;
    tags: string[];
    tokens: number;
    /** Skill only activates when these toolsets are available (Hermes: requires_toolsets) */
    requiresToolsets: string[];
    /** Skill only activates when these toolsets are UNAVAILABLE (fallback path) */
    fallbackForToolsets: string[];
    /** OS platforms this skill supports; empty = all */
    platforms: string[];
    /** Related skill names */
    relatedSkills: string[];
    /** True for skills that ship with kbot or declare `metadata.kbot.*` — boosted in ranking */
    native: boolean;
}
export interface SkillLoadContext {
    /** Toolsets currently available — skills can require/fall-back based on these */
    availableToolsets?: string[];
    /** Current OS platform, e.g. 'darwin' | 'linux' | 'win32' */
    platform?: string;
}
/**
 * Discover and load skill files. Returns a prompt-ready string.
 * When `message` is provided, skills are scored for relevance and only the
 * most relevant are included (keeps token budget tight with a large library).
 */
export declare function loadSkills(projectRoot: string, message?: string, ctx?: SkillLoadContext): string;
/**
 * Walk both skill roots and return every skill document found.
 * Handles flat files (name.md) AND subdirectory layouts (cat/name/SKILL.md).
 * Project skills take precedence over global skills with the same name.
 */
export declare function discoverSkillFiles(projectRoot: string): SkillFile[];
export interface ImportResult {
    imported: number;
    skipped: number;
    source: string;
    destination: string;
}
/**
 * Copy (as symlinks) every SKILL.md under a foreign skills directory
 * into ~/.kbot/skills/imported/<category>/<name>/SKILL.md.
 * Non-destructive: existing symlinks are replaced, real files are skipped.
 */
export declare function importExternalSkills(sourceRoot: string): Promise<ImportResult>;
//# sourceMappingURL=skills-loader.d.ts.map
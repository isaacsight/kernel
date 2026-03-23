export interface KbotProjectConfig {
    /** Detected project name */
    name: string;
    /** Detected language */
    language: string;
    /** Detected framework (if any) */
    framework?: string;
    /** Package manager */
    packageManager?: string;
    /** Preferred default agent */
    defaultAgent: string;
    /** Key files kbot should know about */
    keyFiles: string[];
    /** Custom commands detected from package.json/Makefile/etc */
    commands: Record<string, string>;
    /** Forged tools created during init */
    forgedTools: string[];
    /** When this config was generated */
    createdAt: string;
}
export declare function initProject(root: string): Promise<KbotProjectConfig>;
export declare function formatInitReport(config: KbotProjectConfig): string;
//# sourceMappingURL=init.d.ts.map
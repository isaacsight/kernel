export interface BuildTarget {
    id: string;
    name: string;
    category: 'mobile' | 'desktop' | 'embedded' | 'web' | 'server' | 'wasm';
    /** Architecture: arm64, x86_64, armv7, riscv, wasm32, universal */
    arch: string[];
    /** Docker image for sandboxed builds (null = requires local tools) */
    dockerImage: string | null;
    /** Required CLI tools on the host */
    requiredTools: string[];
    /** How to detect if the project targets this platform */
    detectFiles: string[];
    /** Setup commands to initialize a project for this target */
    initCommands: string[];
    /** Build commands */
    buildCommands: string[];
    /** Run/test commands */
    runCommands: string[];
    /** Package/distribute commands */
    packageCommands: string[];
    /** Description shown to user */
    description: string;
}
export declare const BUILD_TARGETS: Record<string, BuildTarget>;
/** Check if a CLI tool is available */
export declare function isToolAvailable(tool: string): boolean;
/** Detect which build targets the current project supports */
export declare function detectProjectTargets(cwd?: string): BuildTarget[];
/** Check which required tools are missing for a target */
export declare function getMissingTools(target: BuildTarget): string[];
/** Get all targets in a category */
export declare function getTargetsByCategory(category: BuildTarget['category']): BuildTarget[];
/** Format target info for display */
export declare function formatTargetInfo(target: BuildTarget): string;
/** Format a compact target list */
export declare function formatTargetList(targets: BuildTarget[]): string;
//# sourceMappingURL=build-targets.d.ts.map
/** Replit environment info */
export interface ReplitEnv {
    /** Running inside Replit */
    detected: boolean;
    /** Repl ID */
    replId?: string;
    /** Repl slug (project name) */
    slug?: string;
    /** Repl owner */
    owner?: string;
    /** Replit DB URL for key-value storage */
    dbUrl?: string;
    /** Public URL for the repl (for serve mode) */
    publicUrl?: string;
    /** Persistent home directory */
    homePath: string;
    /** Whether Replit Secrets has API keys configured */
    hasSecrets: boolean;
}
/** Detect if running inside Replit and gather environment info */
export declare function detectReplit(): ReplitEnv;
/** Check if running inside Replit */
export declare function isReplit(): boolean;
/**
 * Modules to SKIP in lite mode (Replit or --lite flag).
 * These require Docker, native binaries, display servers, or excessive disk/RAM.
 */
export declare const LITE_SKIP_MODULES: Set<string>;
/** Get the kbot home directory, respecting Replit environment */
export declare function getKbotHome(): string;
/** Print Replit-specific onboarding message */
export declare function printReplitWelcome(): string;
//# sourceMappingURL=replit.d.ts.map
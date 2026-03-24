export type PrivacyLevel = 'local-only' | 'local-preferred' | 'cloud-allowed';
export interface PrivacyPolicy {
    /** Default routing: local-only, local-preferred, cloud-allowed */
    defaultLevel: PrivacyLevel;
    /** Patterns that ALWAYS force local (never sent to cloud) */
    sensitivePatterns: string[];
    /** Domains/hosts allowed for cloud inference */
    allowedCloudHosts: string[];
    /** File path patterns that are always private */
    privateFilePaths: string[];
    /** Whether to log routing decisions */
    auditLog: boolean;
}
export interface RoutingDecision {
    /** Where to send: local or cloud */
    target: 'local' | 'cloud';
    /** Why this decision was made */
    reason: string;
    /** Was sensitive content detected? */
    sensitiveDetected: boolean;
    /** What patterns matched (if any) */
    matchedPatterns: string[];
}
declare const PRIVACY_POLICY_FILE: string;
declare const DEFAULT_POLICY: PrivacyPolicy;
/** Load privacy policy from YAML-like config, or return defaults */
export declare function loadPrivacyPolicy(): PrivacyPolicy;
/** Write the default policy file so users can customize it */
export declare function writeDefaultPolicy(): void;
/** Check if content contains sensitive patterns */
export declare function detectSensitiveContent(content: string, policy: PrivacyPolicy): {
    sensitive: boolean;
    matches: string[];
};
/** Check if a file path is private */
export declare function isPrivateFilePath(filePath: string, policy: PrivacyPolicy): boolean;
/**
 * Decide whether a prompt/tool call should go to local or cloud.
 * This is called BEFORE every inference request.
 */
export declare function routeForPrivacy(content: string, policy?: PrivacyPolicy, options?: {
    filePaths?: string[];
    forceLocal?: boolean;
    forceCloud?: boolean;
}): RoutingDecision;
export declare function logRoutingDecision(decision: RoutingDecision, prompt: string): void;
export { DEFAULT_POLICY, PRIVACY_POLICY_FILE };
//# sourceMappingURL=privacy-router.d.ts.map
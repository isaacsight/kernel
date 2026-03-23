export interface SystemComponent {
    id: string;
    name: string;
    type: 'provider' | 'tool' | 'memory' | 'model' | 'connection';
    status: 'healthy' | 'degraded' | 'failed' | 'unknown';
    lastChecked: number;
    failureCount: number;
    /** How critical is this component? 0-1 */
    criticality: number;
    /** Can the system compensate if this fails? */
    compensable: boolean;
    /** What compensates for this component */
    fallback?: string;
}
export interface HealthReport {
    /** Overall system viability (0-1) */
    viability: number;
    /** Components by status */
    healthy: string[];
    degraded: string[];
    failed: string[];
    /** Self-healing actions taken */
    healingActions: string[];
    /** Is the system in a viable state? */
    isViable: boolean;
    /** Boundary integrity: are internal/external correctly distinguished? */
    boundaryIntact: boolean;
}
export interface AdaptiveResponse {
    /** Action taken to maintain viability */
    action: string;
    /** Component affected */
    component: string;
    /** Was the action successful? */
    success: boolean;
    /** New state after action */
    newStatus: SystemComponent['status'];
}
/**
 * Autopoietic System — self-maintaining operational integrity.
 *
 * The system continuously:
 * 1. Monitors its own components (providers, tools, memory, models)
 * 2. Detects degradation before failure
 * 3. Self-heals by activating fallbacks
 * 4. Maintains its operational boundary
 *
 * If viability drops below threshold, it signals for external help
 * rather than continuing in a degraded state.
 */
export declare class AutopoieticSystem {
    private components;
    private healingLog;
    private readonly viabilityThreshold;
    constructor();
    /** Register the core components that constitute kbot */
    private initializeComponents;
    /**
     * Report a component's health status.
     * Called by the agent loop after each operation.
     */
    reportHealth(componentId: string, healthy: boolean): void;
    /**
     * Attempt self-healing for a degraded or failed component.
     * Uses the full Limitless Execution stack:
     *   1. Static fallback (existing component)
     *   2. Tool discovery (search for MCP replacement)
     *   3. Self-extension (forge a replacement tool)
     */
    selfHeal(componentId: string): AdaptiveResponse | null;
    /** Pending tool discoveries (consumed by the agent loop) */
    private pendingDiscoveries;
    /** Consume pending discovery requests (called by agent loop) */
    consumeDiscoveries(): Array<{
        componentId: string;
        capability: string;
        reason: string;
    }>;
    /**
     * Register a forged tool as a new component.
     * Called after forge_tool successfully creates a runtime tool.
     * This is autopoiesis: the system creates a new part of itself.
     */
    registerForgedComponent(toolName: string, description: string): void;
    /**
     * Recommend model speed based on system health.
     * When the system is degraded, conserve resources by using fast/cheap models.
     * When healthy, use the default (more capable) model.
     */
    recommendModelSpeed(): 'fast' | 'default';
    /**
     * Process tool result and update component health.
     * This is the structural coupling point — the system observes its own
     * operations and updates its self-model accordingly.
     */
    observeToolResult(toolName: string, success: boolean, errorMessage?: string): void;
    /**
     * Compute overall system viability.
     * Weighted average of component health, weighted by criticality.
     * Only includes components that have been checked (ignores unknown/unchecked).
     */
    computeViability(): number;
    /**
     * Full health check — assess all components, self-heal if needed.
     */
    healthCheck(): HealthReport;
    /**
     * Should the agent continue operating, or signal for help?
     * Only blocks when components have actually been checked and found failing —
     * never blocks on startup before any checks have run.
     */
    shouldContinue(): {
        continue: boolean;
        reason?: string;
    };
    /** Get the healing log */
    getHealingLog(): AdaptiveResponse[];
    /** Get a specific component's status */
    getComponent(id: string): SystemComponent | undefined;
    /** Register a new component (e.g., when an MCP server connects) */
    registerComponent(component: Omit<SystemComponent, 'status' | 'lastChecked' | 'failureCount'>): void;
    /** Reset for new session */
    reset(): void;
}
//# sourceMappingURL=autopoiesis.d.ts.map
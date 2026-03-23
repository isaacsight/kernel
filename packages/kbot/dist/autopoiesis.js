// kbot Autopoiesis — Self-Maintaining, Self-Creating System
//
// Based on Maturana & Varela's Autopoiesis theory (1972):
// Living systems are "self-making" — they continuously produce and
// maintain the components that constitute them. An autopoietic system
// is organizationally closed but structurally coupled to its environment.
//
// For kbot: the agent monitors its own health, detects degradation,
// self-heals broken components, and maintains its operational boundary.
// kbot doesn't just run — it actively maintains its ability to run.
//
// LIMITLESS EXECUTION INTEGRATION (v3.4.0):
//   Self-healing now uses the full Limitless Execution stack:
//   - Self-Extension: forge replacement tools when components fail
//   - Tool Discovery: search MCP servers for missing capabilities
//   - Fallback Chains: integrated with tool-pipeline DEFAULT_FALLBACK_RULES
//   - Cost Regulation: adjust model routing based on system health
//   - Specialist Routing: escalate to the right agent for complex repairs
//
// References:
//   - Maturana, H.R. & Varela, F.J. (1980). Autopoiesis and Cognition.
//   - Varela, F.J. (1979). Principles of Biological Autonomy.
//   - Thompson, E. (2007). Mind in Life: Biology, Phenomenology, and the Sciences of Mind.
//   - Di Paolo, E.A. (2005). Autopoiesis, adaptivity, teleology, agency.
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
export class AutopoieticSystem {
    components = new Map();
    healingLog = [];
    viabilityThreshold = 0.4;
    constructor() {
        this.initializeComponents();
    }
    /** Register the core components that constitute kbot */
    initializeComponents() {
        const defaults = [
            // Providers
            { id: 'anthropic', name: 'Anthropic API', type: 'provider', criticality: 0.9, compensable: true, fallback: 'openai' },
            { id: 'openai', name: 'OpenAI API', type: 'provider', criticality: 0.7, compensable: true, fallback: 'ollama' },
            { id: 'ollama', name: 'Ollama (local)', type: 'provider', criticality: 0.5, compensable: true, fallback: 'embedded' },
            { id: 'embedded', name: 'Embedded llama.cpp', type: 'model', criticality: 0.4, compensable: false },
            // Core tools
            { id: 'filesystem', name: 'File System Access', type: 'tool', criticality: 1.0, compensable: false },
            { id: 'bash', name: 'Shell Execution', type: 'tool', criticality: 0.9, compensable: false },
            { id: 'git', name: 'Git Operations', type: 'tool', criticality: 0.7, compensable: false },
            // Memory
            { id: 'local-memory', name: 'Local Memory (~/.kbot/memory/)', type: 'memory', criticality: 0.6, compensable: true, fallback: 'session-context' },
            { id: 'session-context', name: 'Session Context', type: 'memory', criticality: 0.8, compensable: false },
            // External connections
            { id: 'internet', name: 'Internet Connectivity', type: 'connection', criticality: 0.5, compensable: true, fallback: 'ollama' },
            { id: 'mcp-servers', name: 'MCP Server Connections', type: 'connection', criticality: 0.3, compensable: true },
        ];
        for (const d of defaults) {
            this.components.set(d.id, {
                ...d,
                status: 'unknown',
                lastChecked: 0,
                failureCount: 0,
            });
        }
    }
    /**
     * Report a component's health status.
     * Called by the agent loop after each operation.
     */
    reportHealth(componentId, healthy) {
        const comp = this.components.get(componentId);
        if (!comp)
            return;
        comp.lastChecked = Date.now();
        if (healthy) {
            comp.status = 'healthy';
            // Gradually reduce failure count on success
            comp.failureCount = Math.max(0, comp.failureCount - 1);
        }
        else {
            comp.failureCount++;
            comp.status = comp.failureCount >= 3 ? 'failed' : 'degraded';
        }
    }
    /**
     * Attempt self-healing for a degraded or failed component.
     * Uses the full Limitless Execution stack:
     *   1. Static fallback (existing component)
     *   2. Tool discovery (search for MCP replacement)
     *   3. Self-extension (forge a replacement tool)
     */
    selfHeal(componentId) {
        const comp = this.components.get(componentId);
        if (!comp || comp.status === 'healthy')
            return null;
        // Level 1: Static fallback — activate a known alternative
        if (comp.compensable && comp.fallback) {
            const fallback = this.components.get(comp.fallback);
            if (fallback && fallback.status !== 'failed') {
                const response = {
                    action: `Activated fallback: ${comp.name} → ${fallback.name}`,
                    component: componentId,
                    success: true,
                    newStatus: 'degraded',
                };
                comp.status = 'degraded';
                this.healingLog.push(response);
                return response;
            }
        }
        // Level 2: Tool discovery — flag for MCP search
        // (Actual MCP search is async; we record the intent for the agent loop to act on)
        if (comp.type === 'tool' || comp.type === 'connection') {
            this.pendingDiscoveries.push({
                componentId,
                capability: comp.name,
                reason: `${comp.name} failed ${comp.failureCount} times, no static fallback available`,
            });
            const response = {
                action: `Queued MCP discovery for: ${comp.name} (no static fallback)`,
                component: componentId,
                success: true,
                newStatus: 'degraded',
            };
            comp.status = 'degraded';
            this.healingLog.push(response);
            return response;
        }
        // Level 3: Record inability — will be surfaced to agent for forge_tool consideration
        const response = {
            action: `Cannot self-heal: ${comp.name} — escalate to agent for forge_tool`,
            component: componentId,
            success: false,
            newStatus: comp.status,
        };
        this.healingLog.push(response);
        return response;
    }
    // ── Limitless Execution: Self-Extension ──
    /** Pending tool discoveries (consumed by the agent loop) */
    pendingDiscoveries = [];
    /** Consume pending discovery requests (called by agent loop) */
    consumeDiscoveries() {
        const discoveries = [...this.pendingDiscoveries];
        this.pendingDiscoveries = [];
        return discoveries;
    }
    /**
     * Register a forged tool as a new component.
     * Called after forge_tool successfully creates a runtime tool.
     * This is autopoiesis: the system creates a new part of itself.
     */
    registerForgedComponent(toolName, description) {
        this.registerComponent({
            id: `forged:${toolName}`,
            name: `Forged: ${description}`,
            type: 'tool',
            criticality: 0.3, // forged tools start at low criticality
            compensable: true, // can be re-forged if lost
        });
        this.reportHealth(`forged:${toolName}`, true);
        this.healingLog.push({
            action: `Self-extended: forged new tool "${toolName}" — ${description}`,
            component: `forged:${toolName}`,
            success: true,
            newStatus: 'healthy',
        });
    }
    // ── Limitless Execution: Cost Regulation ──
    /**
     * Recommend model speed based on system health.
     * When the system is degraded, conserve resources by using fast/cheap models.
     * When healthy, use the default (more capable) model.
     */
    recommendModelSpeed() {
        const viability = this.computeViability();
        // Below 60% viability: conserve resources, use fast model
        if (viability < 0.6)
            return 'fast';
        // Count failed providers — if most are down, conserve what's left
        const providers = [...this.components.values()].filter(c => c.type === 'provider');
        const failedProviders = providers.filter(c => c.status === 'failed').length;
        if (failedProviders >= providers.length - 1)
            return 'fast';
        return 'default';
    }
    // ── Limitless Execution: Structural Coupling ──
    /**
     * Process tool result and update component health.
     * This is the structural coupling point — the system observes its own
     * operations and updates its self-model accordingly.
     */
    observeToolResult(toolName, success, errorMessage) {
        // Map tool names to component IDs
        const toolToComponent = {
            read_file: 'filesystem', write_file: 'filesystem', edit_file: 'filesystem',
            glob: 'filesystem', grep: 'filesystem', list_directory: 'filesystem',
            bash: 'bash',
            git_status: 'git', git_diff: 'git', git_commit: 'git', git_log: 'git',
            web_search: 'internet', url_fetch: 'internet',
            mcp_search: 'mcp-servers', mcp_connect: 'mcp-servers', mcp_call: 'mcp-servers',
        };
        const componentId = toolToComponent[toolName];
        if (componentId) {
            this.reportHealth(componentId, success);
        }
        // Check if a forged tool is reporting
        const forgedId = `forged:${toolName}`;
        if (this.components.has(forgedId)) {
            this.reportHealth(forgedId, success);
        }
        // If a tool failed, check if the system needs intervention
        if (!success && componentId) {
            const comp = this.components.get(componentId);
            if (comp && comp.status === 'failed') {
                this.selfHeal(componentId);
            }
        }
    }
    /**
     * Compute overall system viability.
     * Weighted average of component health, weighted by criticality.
     * Only includes components that have been checked (ignores unknown/unchecked).
     */
    computeViability() {
        let weightedHealth = 0;
        let totalWeight = 0;
        for (const comp of this.components.values()) {
            // Skip components that have never been checked — they shouldn't drag viability down.
            // An unchecked cloud provider when using Ollama shouldn't penalize the system.
            if (comp.status === 'unknown' && comp.lastChecked === 0)
                continue;
            const healthScore = comp.status === 'healthy' ? 1.0 :
                comp.status === 'degraded' ? 0.5 :
                    comp.status === 'failed' ? 0.0 : 0.5; // unknown but checked = neutral
            weightedHealth += healthScore * comp.criticality;
            totalWeight += comp.criticality;
        }
        // If nothing has been checked yet, assume viable (don't block startup)
        return totalWeight > 0 ? weightedHealth / totalWeight : 0.8;
    }
    /**
     * Full health check — assess all components, self-heal if needed.
     */
    healthCheck() {
        const healthy = [];
        const degraded = [];
        const failed = [];
        const healingActions = [];
        for (const [id, comp] of this.components) {
            switch (comp.status) {
                case 'healthy':
                    healthy.push(comp.name);
                    break;
                case 'degraded':
                    degraded.push(comp.name);
                    // Attempt self-healing for degraded components
                    const healResult = this.selfHeal(id);
                    if (healResult)
                        healingActions.push(healResult.action);
                    break;
                case 'failed':
                    failed.push(comp.name);
                    // Attempt self-healing for failed components
                    const failHeal = this.selfHeal(id);
                    if (failHeal)
                        healingActions.push(failHeal.action);
                    break;
            }
        }
        const viability = this.computeViability();
        // Boundary check: are we correctly distinguishing internal from external?
        const internalOk = ['filesystem', 'session-context'].every(id => {
            const c = this.components.get(id);
            return c && c.status !== 'failed';
        });
        return {
            viability,
            healthy,
            degraded,
            failed,
            healingActions,
            isViable: viability >= this.viabilityThreshold,
            boundaryIntact: internalOk,
        };
    }
    /**
     * Should the agent continue operating, or signal for help?
     * Only blocks when components have actually been checked and found failing —
     * never blocks on startup before any checks have run.
     */
    shouldContinue() {
        // Don't block if nothing has been checked yet (startup state)
        const checkedComponents = [...this.components.values()].filter(c => c.lastChecked > 0);
        if (checkedComponents.length === 0)
            return { continue: true };
        const viability = this.computeViability();
        if (viability < this.viabilityThreshold) {
            return {
                continue: false,
                reason: `System viability critically low (${(viability * 100).toFixed(0)}%). Core components degraded.`,
            };
        }
        // Check if filesystem is available (absolute requirement)
        const fs = this.components.get('filesystem');
        if (fs && fs.status === 'failed') {
            return { continue: false, reason: 'File system access lost — cannot operate.' };
        }
        return { continue: true };
    }
    /** Get the healing log */
    getHealingLog() {
        return [...this.healingLog];
    }
    /** Get a specific component's status */
    getComponent(id) {
        return this.components.get(id);
    }
    /** Register a new component (e.g., when an MCP server connects) */
    registerComponent(component) {
        this.components.set(component.id, {
            ...component,
            status: 'unknown',
            lastChecked: 0,
            failureCount: 0,
        });
    }
    /** Reset for new session */
    reset() {
        for (const comp of this.components.values()) {
            comp.status = 'unknown';
            comp.failureCount = 0;
            comp.lastChecked = 0;
        }
        this.healingLog = [];
    }
}
//# sourceMappingURL=autopoiesis.js.map
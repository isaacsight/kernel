// K:BOT Autopoiesis — Self-Maintaining System
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
// References:
//   - Maturana, H.R. & Varela, F.J. (1980). Autopoiesis and Cognition.
//   - Varela, F.J. (1979). Principles of Biological Autonomy.
//   - Thompson, E. (2007). Mind in Life: Biology, Phenomenology, and the Sciences of Mind.
//   - Di Paolo, E.A. (2005). Autopoiesis, adaptivity, teleology, agency.

export interface SystemComponent {
  id: string
  name: string
  type: 'provider' | 'tool' | 'memory' | 'model' | 'connection'
  status: 'healthy' | 'degraded' | 'failed' | 'unknown'
  lastChecked: number
  failureCount: number
  /** How critical is this component? 0-1 */
  criticality: number
  /** Can the system compensate if this fails? */
  compensable: boolean
  /** What compensates for this component */
  fallback?: string
}

export interface HealthReport {
  /** Overall system viability (0-1) */
  viability: number
  /** Components by status */
  healthy: string[]
  degraded: string[]
  failed: string[]
  /** Self-healing actions taken */
  healingActions: string[]
  /** Is the system in a viable state? */
  isViable: boolean
  /** Boundary integrity: are internal/external correctly distinguished? */
  boundaryIntact: boolean
}

export interface AdaptiveResponse {
  /** Action taken to maintain viability */
  action: string
  /** Component affected */
  component: string
  /** Was the action successful? */
  success: boolean
  /** New state after action */
  newStatus: SystemComponent['status']
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
export class AutopoieticSystem {
  private components = new Map<string, SystemComponent>()
  private healingLog: AdaptiveResponse[] = []
  private readonly viabilityThreshold = 0.4

  constructor() {
    this.initializeComponents()
  }

  /** Register the core components that constitute kbot */
  private initializeComponents(): void {
    const defaults: Array<Omit<SystemComponent, 'status' | 'lastChecked' | 'failureCount'>> = [
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
    ]

    for (const d of defaults) {
      this.components.set(d.id, {
        ...d,
        status: 'unknown',
        lastChecked: 0,
        failureCount: 0,
      })
    }
  }

  /**
   * Report a component's health status.
   * Called by the agent loop after each operation.
   */
  reportHealth(componentId: string, healthy: boolean): void {
    const comp = this.components.get(componentId)
    if (!comp) return

    comp.lastChecked = Date.now()

    if (healthy) {
      comp.status = 'healthy'
      // Gradually reduce failure count on success
      comp.failureCount = Math.max(0, comp.failureCount - 1)
    } else {
      comp.failureCount++
      comp.status = comp.failureCount >= 3 ? 'failed' : 'degraded'
    }
  }

  /**
   * Attempt self-healing for a degraded or failed component.
   * Returns the adaptive response taken.
   */
  selfHeal(componentId: string): AdaptiveResponse | null {
    const comp = this.components.get(componentId)
    if (!comp || comp.status === 'healthy') return null

    // If compensable, activate fallback
    if (comp.compensable && comp.fallback) {
      const fallback = this.components.get(comp.fallback)
      if (fallback && fallback.status !== 'failed') {
        const response: AdaptiveResponse = {
          action: `Activated fallback: ${comp.name} → ${fallback.name}`,
          component: componentId,
          success: true,
          newStatus: 'degraded',
        }
        comp.status = 'degraded'
        this.healingLog.push(response)
        return response
      }
    }

    // If not compensable, report inability to self-heal
    const response: AdaptiveResponse = {
      action: `Cannot self-heal: ${comp.name} has no viable fallback`,
      component: componentId,
      success: false,
      newStatus: comp.status,
    }
    this.healingLog.push(response)
    return response
  }

  /**
   * Compute overall system viability.
   * Weighted average of component health, weighted by criticality.
   */
  computeViability(): number {
    let weightedHealth = 0
    let totalWeight = 0

    for (const comp of this.components.values()) {
      const healthScore =
        comp.status === 'healthy' ? 1.0 :
        comp.status === 'degraded' ? 0.5 :
        comp.status === 'failed' ? 0.0 : 0.3 // unknown

      weightedHealth += healthScore * comp.criticality
      totalWeight += comp.criticality
    }

    return totalWeight > 0 ? weightedHealth / totalWeight : 0
  }

  /**
   * Full health check — assess all components, self-heal if needed.
   */
  healthCheck(): HealthReport {
    const healthy: string[] = []
    const degraded: string[] = []
    const failed: string[] = []
    const healingActions: string[] = []

    for (const [id, comp] of this.components) {
      switch (comp.status) {
        case 'healthy':
          healthy.push(comp.name)
          break
        case 'degraded':
          degraded.push(comp.name)
          // Attempt self-healing for degraded components
          const healResult = this.selfHeal(id)
          if (healResult) healingActions.push(healResult.action)
          break
        case 'failed':
          failed.push(comp.name)
          // Attempt self-healing for failed components
          const failHeal = this.selfHeal(id)
          if (failHeal) healingActions.push(failHeal.action)
          break
      }
    }

    const viability = this.computeViability()

    // Boundary check: are we correctly distinguishing internal from external?
    const internalOk = ['filesystem', 'session-context'].every(id => {
      const c = this.components.get(id)
      return c && c.status !== 'failed'
    })

    return {
      viability,
      healthy,
      degraded,
      failed,
      healingActions,
      isViable: viability >= this.viabilityThreshold,
      boundaryIntact: internalOk,
    }
  }

  /**
   * Should the agent continue operating, or signal for help?
   */
  shouldContinue(): { continue: boolean; reason?: string } {
    const viability = this.computeViability()

    if (viability < this.viabilityThreshold) {
      return {
        continue: false,
        reason: `System viability critically low (${(viability * 100).toFixed(0)}%). Core components degraded.`,
      }
    }

    // Check if filesystem is available (absolute requirement)
    const fs = this.components.get('filesystem')
    if (fs && fs.status === 'failed') {
      return { continue: false, reason: 'File system access lost — cannot operate.' }
    }

    return { continue: true }
  }

  /** Get the healing log */
  getHealingLog(): AdaptiveResponse[] {
    return [...this.healingLog]
  }

  /** Get a specific component's status */
  getComponent(id: string): SystemComponent | undefined {
    return this.components.get(id)
  }

  /** Register a new component (e.g., when an MCP server connects) */
  registerComponent(component: Omit<SystemComponent, 'status' | 'lastChecked' | 'failureCount'>): void {
    this.components.set(component.id, {
      ...component,
      status: 'unknown',
      lastChecked: 0,
      failureCount: 0,
    })
  }

  /** Reset for new session */
  reset(): void {
    for (const comp of this.components.values()) {
      comp.status = 'unknown'
      comp.failureCount = 0
      comp.lastChecked = 0
    }
    this.healingLog = []
  }
}

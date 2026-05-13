/**
 * Core types for @kernel.chat/agent-os.
 *
 * Eight primitives — synthesized from the May 2026 frontier research:
 *
 *   1. spawn(manifest)     — fork an agent with declared identity
 *   2. acap                — signed, revocable capability tokens
 *   3. ns                  — keyed namespaces (memory, tools, audit log)
 *   4. ulimit-tok          — per-agent token/$/wall-clock/spawn quotas
 *   5. chexec              — trust-channel exec with taint tracking
 *   6. audit               — append-only, content-addressed event log
 *   7. handoff             — task transfer with explicit downscoping
 *   8. snapshot            — content-addressed agent state freeze
 *
 * The OS runs above Modal-class sandbox providers (Modal, Daytona,
 * RunPod, E2B, local Docker, bare process) and below MCP/A2A as the
 * wire formats agents speak to each other.
 *
 * See docs/frontier-2027.md and docs/frontier-2027-research.md for
 * the strategic positioning.
 */

// ─── Agent identity ──────────────────────────────────────────────

export type AgentId = string & { readonly __agent_id: unique symbol }

/** Cryptographic provenance of a manifest. Ed25519 signature in v0.2;
 *  HMAC-SHA256 in v0.1 for parity with kbot-finance's governance.ts. */
export interface ManifestSignature {
  readonly algorithm: 'hmac-sha256' | 'ed25519'
  readonly signer: string
  readonly signature: string
  readonly signed_at: string
}

/** The declarative declaration of who an agent is and what it claims
 *  to be capable of. Spawned through `spawn(manifest)`. */
export interface AgentManifest {
  readonly id: AgentId
  /** Parent agent that spawned this one. The root agent has parent = null. */
  readonly parent: AgentId | null
  /** Human-readable purpose statement. Editorial — does not affect runtime. */
  readonly purpose: string
  /** Capabilities this agent claims to need. Granted (or denied) by the parent. */
  readonly requested_capabilities: ACapRequest[]
  /** Resource budget the parent allocates to the child. */
  readonly budget: AgentBudget
  /** Namespace mounts visible to this agent. */
  readonly namespace: NamespaceSpec
  /** Optional cryptographic signature from the parent attesting to the manifest. */
  readonly signature?: ManifestSignature
  /** ISO 8601 UTC. */
  readonly created_at: string
}

// ─── ACap — agent capability ─────────────────────────────────────

/** Discriminated union of capability subjects. Extensible — anything an
 *  agent could be granted permission to do or access goes here. */
export type ACapSubject =
  | { readonly kind: 'tool'; readonly name: string }
  | { readonly kind: 'mcp_server'; readonly server: string }
  | { readonly kind: 'resource'; readonly uri: string }
  | { readonly kind: 'memory_block'; readonly block_id: string }
  | { readonly kind: 'audit_log'; readonly namespace: string }
  | { readonly kind: 'agent_handoff'; readonly target_pattern: string }

export interface ACapRequest {
  readonly subject: ACapSubject
  /** Scope tags — interpreted by the granting agent. Examples: 'read',
   *  'write', 'invoke', 'material'. The OS does not enumerate; the grant
   *  contract does. */
  readonly scope: ReadonlyArray<string>
  /** Maximum invocations before this capability must be re-requested.
   *  Null = unlimited within ttl. */
  readonly max_invocations?: number
  /** Reason the parent should grant. Editorial; surfaces in audit log. */
  readonly justification: string
}

export interface ACap extends ACapRequest {
  readonly id: string
  readonly granted_to: AgentId
  readonly granted_by: AgentId
  readonly granted_at: string
  /** ISO 8601 UTC expiry. */
  readonly expires_at: string
  /** Cryptographic attestation from the granting agent. */
  readonly signature: ManifestSignature
  /** Monotonic counter — how many times this capability has been used. */
  readonly invocations: number
}

// ─── Namespaces ──────────────────────────────────────────────────

export interface NamespaceSpec {
  /** Stable identifier for the agent's view onto shared resources. */
  readonly name: string
  /** Memory blocks visible to this agent — subset of the parent's. */
  readonly memory: ReadonlyArray<string>
  /** Tool catalog visible to this agent — subset of the parent's. */
  readonly tools: ReadonlyArray<string>
  /** Audit-log namespace this agent writes to. Cannot read other
   *  namespaces unless explicitly granted via acap. */
  readonly audit_namespace: string
  /** Parent namespaces this agent inherits read-only views from. */
  readonly mounts: ReadonlyArray<{
    readonly namespace: string
    readonly mode: 'read' | 'read-write'
  }>
}

// ─── ulimit-tok ──────────────────────────────────────────────────

export interface AgentBudget {
  /** Maximum input tokens across the agent's lifetime. */
  readonly max_input_tokens: number
  /** Maximum output tokens across the agent's lifetime. */
  readonly max_output_tokens: number
  /** Maximum wall-clock seconds. */
  readonly max_wall_clock_seconds: number
  /** Maximum dollar cost (assumed to be tracked by the model provider). */
  readonly max_cost_usd: number
  /** Maximum direct child agents that can be spawned. */
  readonly max_children: number
  /** Soft-warn thresholds (0.0-1.0 of the corresponding hard limit). */
  readonly warn_at?: {
    readonly tokens?: number
    readonly wall_clock?: number
    readonly cost?: number
  }
}

export interface BudgetUsage {
  readonly input_tokens: number
  readonly output_tokens: number
  readonly wall_clock_seconds: number
  readonly cost_usd: number
  readonly children_spawned: number
}

// ─── chexec — taint-tracked tool execution ──────────────────────

/** A taint label tracks the provenance of a value through the system.
 *  Tainted inputs (e.g. fetched HTML, email body, untrusted file) cannot
 *  reach high-privilege tools without an explicit untaint operation.
 *  Echoes the EchoLeak class of LLM Scope Violation vulnerabilities. */
export interface Taint {
  readonly source: 'fetched_url' | 'email' | 'user_input' | 'untrusted_file' | 'agent_message'
  readonly origin: string
  /** ISO 8601 UTC when this taint was introduced. */
  readonly introduced_at: string
}

export interface ToolCall {
  readonly tool: string
  readonly args: unknown
  readonly caller: AgentId
  readonly acap: string
  readonly taints: ReadonlyArray<Taint>
}

export interface ToolCallResult {
  readonly tool: string
  readonly value: unknown
  readonly produced_at: string
  /** Taints flow forward: outputs inherit the union of input taints. */
  readonly taints: ReadonlyArray<Taint>
}

// ─── Handoff ─────────────────────────────────────────────────────

export interface HandoffRequest {
  readonly from: AgentId
  readonly to: AgentId
  readonly task: string
  /** Capabilities transferred. MUST be a subset of `from`'s ACaps;
   *  the OS rejects attempts to escalate. */
  readonly transferred_acaps: ReadonlyArray<string>
  /** Audit-log namespace the receiving agent should write to (typically
   *  the receiver's own namespace, not the sender's). */
  readonly audit_namespace: string
}

// ─── Snapshot ────────────────────────────────────────────────────

export interface AgentSnapshot {
  readonly agent_id: AgentId
  /** Content-addressed identifier; same state → same cid. */
  readonly cid: string
  readonly taken_at: string
  /** Frozen state: manifest, current acaps, budget usage, namespace,
   *  outstanding tool calls. */
  readonly state: {
    readonly manifest: AgentManifest
    readonly acaps: ReadonlyArray<ACap>
    readonly usage: BudgetUsage
    readonly pending_calls: ReadonlyArray<ToolCall>
  }
}

// ─── Result types ────────────────────────────────────────────────

/** Discriminated outcome type — never throws across module boundaries. */
export type OSResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: OSError }

export interface OSError {
  readonly code:
    | 'capability_denied'
    | 'capability_expired'
    | 'capability_exhausted'
    | 'budget_exceeded'
    | 'namespace_violation'
    | 'taint_violation'
    | 'handoff_escalation_denied'
    | 'manifest_invalid'
    | 'snapshot_not_found'
    | 'parent_not_found'
  readonly message: string
  readonly details?: Record<string, unknown>
}

export function ok<T>(value: T): OSResult<T> {
  return { ok: true, value }
}

export function err(code: OSError['code'], message: string, details?: Record<string, unknown>): OSResult<never> {
  return {
    ok: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  }
}

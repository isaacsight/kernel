/**
 * Workspace Agents — long-running named agents bound to a workspace with
 * permissions and resumable state. Parity with OpenAI's Workspace Agents
 * (Apr 2026). Wraps the hierarchical planner at ./planner/hierarchical/.
 *
 * State JSON shape (one file per agent at <root>/<id>.json):
 *   { id, name, mission, allowedTools, scopes, status, createdAt, updatedAt,
 *     currentPlanId?, history: [{ ts, event, data }] }
 *
 * Storage root: process.env.KBOT_WORKSPACE_AGENTS_ROOT
 *               ?? <homedir>/.kbot/workspace-agents
 *
 * Permissions: every tool invocation must pass through `gate(toolName)` which
 * checks `allowedTools`. Scopes are recorded but enforcement is per-tool via
 * the allowedTools whitelist.
 */
import type { AgentOptions } from './agent.js';
export type WorkspaceAgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type Scope = string;
export interface HistoryEvent {
    ts: string;
    event: string;
    data?: unknown;
}
export interface WorkspaceAgentState {
    id: string;
    name: string;
    mission: string;
    allowedTools: string[];
    scopes: Scope[];
    status: WorkspaceAgentStatus;
    createdAt: string;
    updatedAt: string;
    currentPlanId?: string;
    history: HistoryEvent[];
}
export interface CreateOptions {
    name: string;
    mission: string;
    allowedTools?: string[];
    scopes?: Scope[];
}
export interface CreateResult {
    id: string;
    name: string;
}
export interface StartResult {
    id: string;
    status: WorkspaceAgentStatus;
    planId?: string;
    steps: unknown[];
}
export interface ListEntry {
    id: string;
    name: string;
    status: WorkspaceAgentStatus;
}
export declare class ScopeError extends Error {
    readonly toolName: string;
    constructor(toolName: string, message?: string);
}
export declare class WorkspaceAgentError extends Error {
    constructor(message: string);
}
export declare function defaultRoot(): string;
/** A single tool call surfaced by the planner, ready to be gated + recorded. */
export interface PlannerToolCall {
    tool: string;
    args?: unknown;
    result?: unknown;
}
export interface PlannerStartResult {
    planId: string;
    steps: unknown[];
    /**
     * Optional list of tool calls the planner produced. When present, the
     * WorkspaceAgent will run each through `gate()` and `recordToolCall()`,
     * capturing `tool_blocked` events for any that ScopeError out.
     */
    toolCalls?: PlannerToolCall[];
    /**
     * Free-form notes the planner wants surfaced as history events. Each entry
     * becomes a `planner_note` event on the agent's timeline.
     */
    notes?: string[];
}
export type PlannerStartFn = (taskInput: string, state: WorkspaceAgentState, agentOpts?: AgentOptions | null) => Promise<PlannerStartResult>;
/**
 * Default planner adapter — implements the 3-tier strategy:
 *
 *   Tier 1: KBOT_PLANNER=hierarchical AND non-null agentOpts → real
 *           HierarchicalPlanner.planAndExecute. Tool calls extracted from
 *           the resulting Action.steps and surfaced for gating.
 *   Tier 2: HierarchicalPlanner module loadable but no agentOpts → call
 *           createGoal only; emit a TODO note; return early.
 *   Tier 3: Module import fails (e.g. test env) → deterministic stub
 *           `{ planId: 'stub', steps: [] }`.
 *
 * The function never throws on planner-internal failures: each tier degrades
 * to the next so the WorkspaceAgent.start() lifecycle stays predictable.
 */
export declare const defaultPlannerStart: PlannerStartFn;
export interface WorkspaceAgentOptions {
    /** Override storage root. Defaults to env or ~/.kbot/workspace-agents. */
    root?: string;
    /** Override planner adapter (used by tests). */
    plannerStart?: PlannerStartFn;
}
export declare class WorkspaceAgent {
    private readonly root;
    private readonly plannerStart;
    constructor(opts?: WorkspaceAgentOptions);
    create(opts: CreateOptions): Promise<CreateResult>;
    start(agentId: string, taskInput: string, agentOpts?: AgentOptions | null): Promise<StartResult>;
    resume(agentId: string): Promise<WorkspaceAgentState>;
    stop(agentId: string): Promise<WorkspaceAgentState>;
    status(agentId: string): Promise<WorkspaceAgentState>;
    list(): Promise<ListEntry[]>;
    /**
     * Permission gate. Throws ScopeError if the tool isn't in allowedTools and
     * appends a `tool_denied` event to history. On allow, appends `tool_allowed`.
     */
    gate(agentId: string, toolName: string): Promise<void>;
    /**
     * Append a tool-call record to the agent's history. Caller must call
     * `gate()` first; this method does NOT enforce permissions.
     */
    recordToolCall(agentId: string, toolName: string, args: unknown, result?: unknown): Promise<void>;
    private appendEvent;
    private requireState;
}
//# sourceMappingURL=workspace-agents.d.ts.map
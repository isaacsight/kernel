import { type AgentOptions } from './agent.js';
export interface WorkflowNode {
    id: string;
    type: 'agent' | 'tool' | 'condition' | 'parallel' | 'human';
    agent?: string;
    tool?: string;
    prompt?: string;
    condition?: string;
    children?: string[];
    retryOnFail?: boolean;
    maxRetries?: number;
}
export interface WorkflowEdge {
    from: string;
    to: string;
    label?: string;
}
export interface Workflow {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    variables: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}
export interface WorkflowRun {
    workflowId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    currentNode: string;
    results: Record<string, string>;
    startedAt: string;
    completedAt?: string;
}
/**
 * Create an empty workflow with the given name and description.
 */
export declare function createWorkflow(name: string, description: string): Workflow;
/**
 * Add a node to a workflow. Returns the mutated workflow.
 */
export declare function addNode(workflow: Workflow, node: WorkflowNode): Workflow;
/**
 * Connect two nodes with a directed edge. Returns the mutated workflow.
 */
export declare function addEdge(workflow: Workflow, from: string, to: string, label?: string): Workflow;
/**
 * Save a workflow to ~/.kbot/workflows/<id>.json
 */
export declare function saveWorkflow(workflow: Workflow): Promise<string>;
/**
 * Load a workflow from disk by ID.
 */
export declare function loadWorkflow(id: string): Promise<Workflow>;
/**
 * List all saved workflows.
 */
export declare function listWorkflows(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    updatedAt: string;
}>>;
/**
 * Export a workflow as shareable JSON string.
 */
export declare function exportWorkflow(workflow: Workflow): string;
/**
 * Execute a complete workflow through kbot's agent system.
 *
 * Walks the topologically-sorted node list. Parallel nodes execute their
 * children concurrently. Condition nodes branch based on expression evaluation.
 * Human nodes pause for user input.
 */
export declare function executeWorkflow(workflow: Workflow, agentOpts: AgentOptions, variables?: Record<string, string>): Promise<WorkflowRun>;
/**
 * Convert kbot planner output (array of step descriptions) into a workflow graph.
 * Creates a linear chain of agent nodes with edges between sequential steps.
 */
export declare function planToWorkflow(planSteps: string[], name?: string): Workflow;
/**
 * Export a workflow as a Mermaid diagram syntax for visualization.
 */
export declare function toMermaid(workflow: Workflow): string;
/**
 * Register workflow management tools for agent access.
 */
export declare function registerWorkflowTools(): void;
//# sourceMappingURL=workflows.d.ts.map
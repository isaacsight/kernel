import { type AgentOptions } from './agent.js';
export interface PlanNode {
    id: string;
    parentId: string | null;
    depth: number;
    action: string;
    toolHint: string;
    value: number;
    visits: number;
    children: string[];
    status: 'pending' | 'executing' | 'success' | 'failure';
}
export interface PlanTree {
    root: string;
    nodes: Record<string, PlanNode>;
    bestPath: string[];
    explorationConstant: number;
}
/**
 * Create a plan tree for a task.
 * Generates the root node + first-level branches (2-3 alternative approaches).
 */
export declare function createPlanTree(task: string, context?: string): Promise<PlanTree>;
/**
 * Expand a node by generating child alternatives for its next step.
 * Uses the same heuristic approach as createPlanTree but adapted for mid-plan branching.
 */
export declare function expandNode(tree: PlanTree, nodeId: string): Promise<string[]>;
/**
 * Select the best path from root to leaf using UCB1.
 * At each level, picks the child with the highest UCB1 score.
 */
export declare function selectBestPath(tree: PlanTree): string[];
/**
 * Backpropagate a reward up the tree from a leaf node.
 * Updates value and visit count for all ancestors.
 *
 * @param reward - 1.0 for success, 0.0 for failure, 0.5 for partial
 */
export declare function backpropagate(tree: PlanTree, leafId: string, reward: number): void;
/**
 * Get the highest-value complete path as a linear plan.
 * Returns the path with the highest average value from root to leaf.
 */
export declare function getBestPlan(tree: PlanTree): Array<{
    action: string;
    toolHint: string;
    value: number;
}>;
/**
 * Format the plan tree as an ASCII visualization for terminal display.
 */
export declare function formatTreeForDisplay(tree: PlanTree): string;
/**
 * Execute the tree plan — selects the best path, runs each step,
 * backpropagates results, and adapts if steps fail.
 */
export declare function executeTreePlan(task: string, agentOpts: AgentOptions): Promise<{
    tree: PlanTree;
    success: boolean;
    summary: string;
}>;
//# sourceMappingURL=tree-planner.d.ts.map
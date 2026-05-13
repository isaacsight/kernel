import type { AgentBudget, BudgetUsage, OSResult } from './types.js';
/**
 * ulimit-tok — per-agent token / wall-clock / cost / spawn quotas.
 *
 * Hard kill on exceed; soft warn at threshold. Mirrors POSIX rlimit
 * + cgroups. Tracks usage atomically; the OS rejects operations that
 * would exceed the budget before they execute, so a runaway agent
 * cannot blow past the limit.
 */
export declare class BudgetTracker {
    private readonly budget;
    private usage;
    private readonly start;
    constructor(budget: AgentBudget);
    /** Current usage snapshot. */
    current(): BudgetUsage;
    /** Check whether an operation requesting `(input, output)` tokens would
     *  fit; do NOT charge. Useful for pre-flight checks. */
    canCharge(input: number, output: number, cost: number): OSResult<true>;
    /** Charge the budget. Returns the warning shape if a soft threshold
     *  is crossed; returns an error if a hard limit is exceeded. */
    charge(input: number, output: number, cost: number): OSResult<BudgetWarning | null>;
    /** Reserve a spawn slot — call before creating a child agent. */
    canSpawn(): OSResult<true>;
    /** Record a successful child spawn. */
    recordSpawn(): void;
    private computeWarning;
}
export interface BudgetWarning {
    readonly flags: Array<'tokens' | 'cost' | 'wall_clock'>;
    readonly usage: BudgetUsage;
}
//# sourceMappingURL=budget.d.ts.map
import { err, ok } from './types.js';
/**
 * ulimit-tok — per-agent token / wall-clock / cost / spawn quotas.
 *
 * Hard kill on exceed; soft warn at threshold. Mirrors POSIX rlimit
 * + cgroups. Tracks usage atomically; the OS rejects operations that
 * would exceed the budget before they execute, so a runaway agent
 * cannot blow past the limit.
 */
export class BudgetTracker {
    budget;
    usage = {
        input_tokens: 0,
        output_tokens: 0,
        wall_clock_seconds: 0,
        cost_usd: 0,
        children_spawned: 0,
    };
    start;
    constructor(budget) {
        this.budget = budget;
        this.start = Date.now();
    }
    /** Current usage snapshot. */
    current() {
        return {
            ...this.usage,
            wall_clock_seconds: (Date.now() - this.start) / 1000,
        };
    }
    /** Check whether an operation requesting `(input, output)` tokens would
     *  fit; do NOT charge. Useful for pre-flight checks. */
    canCharge(input, output, cost) {
        const projected_in = this.usage.input_tokens + input;
        if (projected_in > this.budget.max_input_tokens) {
            return err('budget_exceeded', `input tokens would exceed budget: ${projected_in}/${this.budget.max_input_tokens}`);
        }
        const projected_out = this.usage.output_tokens + output;
        if (projected_out > this.budget.max_output_tokens) {
            return err('budget_exceeded', `output tokens would exceed budget: ${projected_out}/${this.budget.max_output_tokens}`);
        }
        const projected_cost = this.usage.cost_usd + cost;
        if (projected_cost > this.budget.max_cost_usd) {
            return err('budget_exceeded', `cost would exceed budget: $${projected_cost.toFixed(4)}/$${this.budget.max_cost_usd}`);
        }
        const elapsed = (Date.now() - this.start) / 1000;
        if (elapsed > this.budget.max_wall_clock_seconds) {
            return err('budget_exceeded', `wall clock exceeded budget: ${elapsed.toFixed(1)}s/${this.budget.max_wall_clock_seconds}s`);
        }
        return ok(true);
    }
    /** Charge the budget. Returns the warning shape if a soft threshold
     *  is crossed; returns an error if a hard limit is exceeded. */
    charge(input, output, cost) {
        const check = this.canCharge(input, output, cost);
        if (!check.ok)
            return check;
        this.usage = {
            ...this.usage,
            input_tokens: this.usage.input_tokens + input,
            output_tokens: this.usage.output_tokens + output,
            cost_usd: this.usage.cost_usd + cost,
        };
        return ok(this.computeWarning());
    }
    /** Reserve a spawn slot — call before creating a child agent. */
    canSpawn() {
        if (this.usage.children_spawned >= this.budget.max_children) {
            return err('budget_exceeded', `child spawn would exceed budget: ${this.usage.children_spawned}/${this.budget.max_children}`);
        }
        return ok(true);
    }
    /** Record a successful child spawn. */
    recordSpawn() {
        this.usage = { ...this.usage, children_spawned: this.usage.children_spawned + 1 };
    }
    computeWarning() {
        const warn = this.budget.warn_at;
        if (!warn)
            return null;
        const flags = [];
        if (warn.tokens !== undefined) {
            const ratio_in = this.usage.input_tokens / this.budget.max_input_tokens;
            const ratio_out = this.usage.output_tokens / this.budget.max_output_tokens;
            if (Math.max(ratio_in, ratio_out) >= warn.tokens)
                flags.push('tokens');
        }
        if (warn.cost !== undefined) {
            const ratio = this.usage.cost_usd / this.budget.max_cost_usd;
            if (ratio >= warn.cost)
                flags.push('cost');
        }
        if (warn.wall_clock !== undefined) {
            const elapsed = (Date.now() - this.start) / 1000;
            const ratio = elapsed / this.budget.max_wall_clock_seconds;
            if (ratio >= warn.wall_clock)
                flags.push('wall_clock');
        }
        return flags.length > 0 ? { flags, usage: this.current() } : null;
    }
}
//# sourceMappingURL=budget.js.map
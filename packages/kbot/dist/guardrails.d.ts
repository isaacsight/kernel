export interface Guardrail {
    id: string;
    name: string;
    type: 'input' | 'output' | 'tool';
    severity: 'block' | 'warn' | 'log';
    /** Regex pattern to match against content */
    pattern?: RegExp;
    /** Name of a built-in validator function */
    validator?: string;
    /** Message shown when the guardrail triggers */
    message: string;
    enabled: boolean;
}
export interface GuardrailViolation {
    guardrailId: string;
    severity: 'block' | 'warn' | 'log';
    message: string;
    evidence: string;
}
export interface GuardrailResult {
    passed: boolean;
    violations: GuardrailViolation[];
}
/**
 * Load built-in guardrails and merge with user-defined custom guardrails
 * from ~/.kbot/guardrails.json.
 */
export declare function loadGuardrails(): Guardrail[];
/**
 * Check input message before the agent processes it.
 * Runs all 'input' type guardrails.
 */
export declare function checkInput(message: string): GuardrailResult;
/**
 * Check agent output before showing to the user.
 * Runs all 'output' type guardrails.
 */
export declare function checkOutput(response: string): GuardrailResult;
/**
 * Check a tool call before execution.
 * Runs all 'tool' type guardrails against the tool name + serialized args.
 */
export declare function checkToolCall(toolName: string, args: Record<string, unknown>): GuardrailResult;
/**
 * Add a custom guardrail at runtime and persist to ~/.kbot/guardrails.json.
 */
export declare function addGuardrail(guardrail: Guardrail): void;
/**
 * Remove a custom guardrail by ID. Built-in guardrails cannot be removed
 * (they can only be disabled).
 */
export declare function removeGuardrail(id: string): boolean;
/**
 * Set the token budget for the output token-budget guardrail.
 */
export declare function setTokenBudget(budget: number): void;
/**
 * Get all currently loaded guardrails (built-in + custom).
 */
export declare function getGuardrails(): readonly Guardrail[];
//# sourceMappingURL=guardrails.d.ts.map
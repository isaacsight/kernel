import type { JsonValue } from "../envelope.js";

/**
 * Regulatory verifier — Norm-AI-pattern, ported.
 *
 * Every action passes through the verifier before reaching the engine.
 * Rules are pure functions over (action, context); failures emit a reason
 * code analogous to ECOA adverse-action notices.
 *
 * Jurisdiction-specific rulesets are composed by selecting which rules
 * are active. SR 11-7 / SR 26-02 / MiFID II / RTS 6 / FINRA 2026 / FCA
 * Consumer Duty all become libraries of these predicates.
 */

export interface VerifierAction {
  /** Operation, e.g. "polymarket.market_make", "alts.nav_compute". */
  readonly operation: string;
  /** The request payload the agent is asking to execute. */
  readonly inputs: JsonValue;
  /** Materiality classification — used by rules to scale scrutiny. */
  readonly materiality: "informational" | "operational" | "material";
}

export interface VerifierContext {
  /** Session ID. */
  readonly session_id: string;
  /** Current positions, exposure, or other state rules may need to inspect. */
  readonly state: JsonValue;
  /** Jurisdiction tag — selects the active ruleset. */
  readonly jurisdiction: "US" | "EU" | "UK" | "SG" | "HK" | "UAE" | "GLOBAL";
}

export interface RuleEvidence {
  readonly code: string;
  readonly summary: string;
  readonly details: JsonValue;
}

export type RuleResult =
  | { readonly pass: true }
  | { readonly pass: false; readonly reason: RuleEvidence };

export interface Rule {
  /** Stable identifier, e.g. "rule.position_limit", "rule.kelly_cap". */
  readonly id: string;
  /** Jurisdictions where this rule applies. */
  readonly jurisdictions: ReadonlyArray<VerifierContext["jurisdiction"]>;
  /** Operations the rule cares about. Match-all = "*". */
  readonly operations: ReadonlyArray<string>;
  /** Pure evaluator. */
  evaluate(action: VerifierAction, context: VerifierContext): RuleResult;
}

export interface VerifierReport {
  readonly ok: boolean;
  readonly checks: ReadonlyArray<{
    readonly rule_id: string;
    readonly result: RuleResult;
  }>;
}

/**
 * Run all applicable rules. Returns a structured report. Short-circuit
 * is intentionally not used: every applicable rule runs so audit logs
 * record the full evaluation, not just the first failure.
 */
export function runVerifier(
  rules: ReadonlyArray<Rule>,
  action: VerifierAction,
  context: VerifierContext,
): VerifierReport {
  const applicable = rules.filter(
    (r) =>
      (r.jurisdictions.includes(context.jurisdiction) || r.jurisdictions.includes("GLOBAL")) &&
      (r.operations.includes("*") || r.operations.includes(action.operation)),
  );
  const checks = applicable.map((rule) => ({
    rule_id: rule.id,
    result: rule.evaluate(action, context),
  }));
  return {
    ok: checks.every((c) => c.result.pass),
    checks,
  };
}

export * from "./position-limit.js";
export * from "./kelly-cap.js";
export * from "./eu-rts6.js";
export * from "./model-version.js";

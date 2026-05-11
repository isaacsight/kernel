import type { Rule, VerifierAction, VerifierContext, RuleResult } from "./index.js";

/**
 * Kelly criterion cap — refuses position sizes above the Kelly fraction for
 * the AI agent's stated probabilistic edge. The math: f* = (bp - q) / b
 * where p = win prob, q = 1-p, b = decimal odds payoff.
 *
 * The agent must declare its `edge_probability` and `payoff_b` for any
 * trade-shaped action. If the requested size exceeds Kelly, the rule
 * vetoes. Half-Kelly is enforced by default — full Kelly is empirically
 * too aggressive for any realistic edge estimate.
 */

export interface KellyCapConfig {
  /** Fraction of full Kelly allowed. 0.5 (half-Kelly) is the conventional default. */
  readonly kelly_fraction: number;
  /** Bankroll the Kelly fraction is computed against. */
  readonly bankroll: number;
}

interface KellyInputs {
  edge_probability?: number;
  payoff_b?: number;
  notional?: number;
}

export function makeKellyCapRule(config: KellyCapConfig): Rule {
  return {
    id: "rule.kelly_cap",
    jurisdictions: ["GLOBAL"],
    operations: ["polymarket.trade", "polymarket.market_make", "alts.allocate"],
    evaluate(action: VerifierAction, _context: VerifierContext): RuleResult {
      const inputs = action.inputs as KellyInputs;
      const p = inputs?.edge_probability;
      const b = inputs?.payoff_b;
      const requested_notional = inputs?.notional ?? 0;
      if (p === undefined || b === undefined) {
        return {
          pass: false,
          reason: {
            code: "KELLY_INPUTS_MISSING",
            summary:
              "Trade-shaped action must declare edge_probability and payoff_b for Kelly sizing.",
            details: { edge_probability: p ?? null, payoff_b: b ?? null },
          },
        };
      }
      if (!(p > 0 && p < 1) || b <= 0) {
        return {
          pass: false,
          reason: {
            code: "KELLY_INPUTS_INVALID",
            summary: "edge_probability must be in (0,1) and payoff_b must be > 0.",
            details: { edge_probability: p, payoff_b: b },
          },
        };
      }
      const q = 1 - p;
      const full_kelly = (b * p - q) / b;
      if (full_kelly <= 0) {
        return {
          pass: false,
          reason: {
            code: "KELLY_NEGATIVE_EDGE",
            summary: "Implied Kelly fraction is non-positive; the bet has no edge.",
            details: { kelly_fraction: full_kelly, p, b },
          },
        };
      }
      const allowed_notional = config.kelly_fraction * full_kelly * config.bankroll;
      if (requested_notional > allowed_notional) {
        return {
          pass: false,
          reason: {
            code: "KELLY_CAP_EXCEEDED",
            summary: `Notional ${requested_notional.toFixed(2)} exceeds ${(config.kelly_fraction * 100).toFixed(0)}%-Kelly cap of ${allowed_notional.toFixed(2)}.`,
            details: {
              full_kelly_fraction: full_kelly,
              applied_fraction: config.kelly_fraction,
              bankroll: config.bankroll,
              allowed_notional,
              requested_notional,
            },
          },
        };
      }
      return { pass: true };
    },
  };
}

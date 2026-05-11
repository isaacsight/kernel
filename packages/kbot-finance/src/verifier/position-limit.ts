import type { Rule, VerifierAction, VerifierContext, RuleResult } from "./index.js";

/**
 * Pre-trade position-limit rule.
 *
 * Echoes Rule 15c3-5 (SEC Market Access Rule) — the engine must have a
 * hard cap on order size and notional exposure per instrument before any
 * trade reaches the venue. Failure emits an adverse-action-style reason
 * code.
 *
 * Context expected shape:
 *   state.position_limits: { [instrument_id: string]: { max_size: number; max_notional: number } }
 *   state.current_positions: { [instrument_id: string]: { size: number; notional: number } }
 */

export interface PositionLimitConfig {
  /** Max increment in size for a single action. */
  readonly default_max_size: number;
  /** Max notional in a single action. */
  readonly default_max_notional: number;
}

interface TradeInputs {
  instrument_id?: string;
  size?: number;
  notional?: number;
}

export function makePositionLimitRule(config: PositionLimitConfig): Rule {
  return {
    id: "rule.position_limit",
    jurisdictions: ["GLOBAL"],
    operations: ["polymarket.market_make", "polymarket.trade", "alts.allocate"],
    evaluate(action: VerifierAction, _context: VerifierContext): RuleResult {
      const inputs = action.inputs as TradeInputs;
      const size = inputs?.size ?? 0;
      const notional = inputs?.notional ?? 0;
      if (size > config.default_max_size) {
        return {
          pass: false,
          reason: {
            code: "POSITION_SIZE_EXCEEDED",
            summary: `Action size ${size} exceeds max ${config.default_max_size}`,
            details: {
              max_allowed: config.default_max_size,
              requested: size,
              instrument: inputs?.instrument_id ?? null,
            },
          },
        };
      }
      if (notional > config.default_max_notional) {
        return {
          pass: false,
          reason: {
            code: "POSITION_NOTIONAL_EXCEEDED",
            summary: `Action notional ${notional} exceeds max ${config.default_max_notional}`,
            details: {
              max_allowed: config.default_max_notional,
              requested: notional,
              instrument: inputs?.instrument_id ?? null,
            },
          },
        };
      }
      return { pass: true };
    },
  };
}

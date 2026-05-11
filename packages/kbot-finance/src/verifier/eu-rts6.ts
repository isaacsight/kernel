import type { Rule, VerifierAction, VerifierContext, RuleResult } from "./index.js";

/**
 * EU MiFID II RTS 6 — algorithmic trading declaration.
 *
 * Commission Delegated Regulation 2017/589 requires algorithmic trading
 * systems to be identified by a declared algorithm ID, retained for
 * regulator inspection. The ESMA Feb 26, 2026 supervisory briefing
 * reinforces this for ML-influenced trading.
 *
 * This rule fires on any operation classified as a trade and refuses
 * actions whose envelope inputs lack an `rts6_algorithm_id`. The check
 * is shape-only — the value is not validated against any registry in
 * v0.1; that lands when the per-jurisdiction module ships in v0.3.
 */

interface AlgoInputs {
  rts6_algorithm_id?: string;
}

const TRADE_OPERATIONS = new Set<string>([
  "polymarket.trade",
  "polymarket.market_make",
  "alts.allocate",
  "rates.swap_execute",
  "equities.order",
]);

export function makeRts6AlgorithmDeclaredRule(): Rule {
  return {
    id: "rule.eu_rts6_algorithm_declared",
    jurisdictions: ["EU"],
    operations: Array.from(TRADE_OPERATIONS),
    evaluate(action: VerifierAction, _context: VerifierContext): RuleResult {
      const inputs = action.inputs as AlgoInputs;
      const id = inputs?.rts6_algorithm_id;
      if (typeof id !== "string" || id.trim().length === 0) {
        return {
          pass: false,
          reason: {
            code: "RTS6_ALGO_ID_MISSING",
            summary:
              "MiFID II RTS 6 requires every algorithmic-trading action to carry an algorithm declaration ID.",
            details: {
              required_field: "rts6_algorithm_id",
              regulation: "Commission Delegated Regulation 2017/589, Article 9",
              esma_briefing: "ESMA74-1505669079-10311 (26 Feb 2026)",
            },
          },
        };
      }
      // Cheap shape check — typical IDs are alphanumeric with optional hyphens.
      if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) {
        return {
          pass: false,
          reason: {
            code: "RTS6_ALGO_ID_INVALID_SHAPE",
            summary: `rts6_algorithm_id "${id}" does not match the expected 3-64 char alphanumeric format.`,
            details: { received: id },
          },
        };
      }
      return { pass: true };
    },
  };
}

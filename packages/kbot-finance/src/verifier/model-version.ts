import type { Rule, VerifierAction, VerifierContext, RuleResult } from "./index.js";

/**
 * Model-version-pinning rule — Fed SR 26-02 / SR 11-7 echo.
 *
 * Model risk management guidance (Federal Reserve SR 26-02, OCC Bulletin
 * 2026-13) expects every model touching a regulated decision to be
 * version-pinned and inventoried. Generative AI is excluded from SR 26-02
 * scope explicitly, but tier-1 banks are extending SR 11-7 muscle memory
 * to it pending the inter-agency RFI.
 *
 * This rule requires any action with `materiality !== "informational"` to
 * carry a `model_version` in inputs. Pure read-only / informational actions
 * are exempted.
 */

interface ModelInputs {
  model_version?: string;
}

export function makeModelVersionPinnedRule(): Rule {
  return {
    id: "rule.model_version_pinned",
    jurisdictions: ["GLOBAL"],
    operations: ["*"],
    evaluate(action: VerifierAction, _context: VerifierContext): RuleResult {
      if (action.materiality === "informational") return { pass: true };
      const inputs = action.inputs as ModelInputs;
      const v = inputs?.model_version;
      if (typeof v !== "string" || v.trim().length === 0) {
        return {
          pass: false,
          reason: {
            code: "MODEL_VERSION_UNPINNED",
            summary:
              "Operational/material actions must declare a pinned model_version. SR 26-02 and EU AI Act Art. 12 (record-keeping) require model lineage on every decision.",
            details: {
              required_field: "model_version",
              guidance: ["Fed SR 26-02", "OCC Bulletin 2026-13", "EU AI Act Art. 11-12"],
            },
          },
        };
      }
      return { pass: true };
    },
  };
}

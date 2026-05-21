// Two-kind classifier — operator-policy vs third-party-harm.
//
// The agent fidelity engineering discipline names two qualitatively
// different kinds of refusal:
//
//   (1) Operator-policy refusal: a frontier-lab agent (Claude, GPT,
//       Gemini) refuses an action because their operator's commercial
//       or ethical policy forbids it. A locally-controlled BYOK agent
//       (kbot, Hermes) under the principal's control can legitimately
//       override this kind of refusal — the operator is the policy-
//       maker, not the model provider.
//
//   (2) Third-party-harm refusal: an action causes harm to an
//       identifiable third party regardless of which agent runs the
//       keystrokes. The constraint is not "agent policy"; it is harm-
//       prevention. Local-controlled agents must enforce this too,
//       not because they can't structurally do otherwise, but because
//       the action causes harm and the principal cannot consent on
//       behalf of the harmed party.
//
// The classifier takes a proposed action and returns which kind of
// refusal applies (if any), letting the orchestrator route appropriately:
// operator-policy refusals are overridable with explicit operator
// authorization; third-party-harm refusals are not.
import { evaluateRefusals, DEFAULT_REFUSAL_PREDICATES } from './refusal.js';
export class FidelityClassifier {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    classify(action) {
        // Third-party-harm refusals take precedence; they cannot be overridden.
        const thirdPartyHarm = evaluateRefusals(action, this.config.thirdPartyHarmPredicates ?? DEFAULT_REFUSAL_PREDICATES);
        if (thirdPartyHarm) {
            return {
                kind: 'third-party-harm',
                thirdPartyHarmReason: thirdPartyHarm,
                explanation: `Refused: ${thirdPartyHarm.category} — ${thirdPartyHarm.message}`,
            };
        }
        // Operator-policy refusals come second; they can be overridden by explicit operator authorization.
        if (this.config.operatorPolicyCheck) {
            const operatorHint = this.config.operatorPolicyCheck(action);
            if (operatorHint) {
                return {
                    kind: 'operator-policy',
                    operatorPolicyHint: operatorHint,
                    explanation: `Operator policy refusal; override available: ${operatorHint}`,
                };
            }
        }
        return { kind: 'none', explanation: 'Action permitted under current policy and harm refusals.' };
    }
}
/** Convenience factory: create a default classifier. */
export function createDefaultClassifier() {
    return new FidelityClassifier();
}
//# sourceMappingURL=classifier.js.map
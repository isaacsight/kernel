import { type ProposedAction, type RefusalReason, type RefusalPredicate } from './refusal.js';
export type RefusalKind = 'operator-policy' | 'third-party-harm' | 'none';
export interface Classification {
    kind: RefusalKind;
    /** Present when kind is 'third-party-harm'. The refusal cannot be overridden by operator authorization alone. */
    thirdPartyHarmReason?: RefusalReason;
    /** Present when kind is 'operator-policy'. Override path is documented for the operator. */
    operatorPolicyHint?: string;
    /** Free-text explanation suitable for telemetry/audit. */
    explanation: string;
}
export interface ClassifierConfig {
    /** Predicates that classify an action as third-party-harm. Default: DEFAULT_REFUSAL_PREDICATES. */
    thirdPartyHarmPredicates?: RefusalPredicate[];
    /** Function that classifies an action as operator-policy refusal.
     *  Returns a hint (override path) or null if the action is allowed by current operator policy. */
    operatorPolicyCheck?: (action: ProposedAction) => string | null;
}
export declare class FidelityClassifier {
    private readonly config;
    constructor(config?: ClassifierConfig);
    classify(action: ProposedAction): Classification;
}
/** Convenience factory: create a default classifier. */
export declare function createDefaultClassifier(): FidelityClassifier;
//# sourceMappingURL=classifier.d.ts.map
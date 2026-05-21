export type RefusalCategory = 'identity-fabrication' | 'consent-fraud' | 'impersonation' | 'attestation-mismatch' | 'false-witness' | 'security-breach';
export interface RefusalReason {
    category: RefusalCategory;
    message: string;
    /** Optional pointer to the specific operator-policy that, if added, would explicitly override this refusal. */
    overrideHint?: string;
}
export interface ProposedAction {
    /** What the agent intends to do, one short phrase */
    kind: string;
    /** Free-form description; the predicate may inspect for signal */
    description: string;
    /** Optional structured payload — for outreach actions, this is the recipient + body */
    payload?: Record<string, unknown>;
    /** Operator's stated authorization for this action */
    operatorAuth: string;
}
export type RefusalPredicate = (action: ProposedAction) => RefusalReason | null;
/** Identity-fabrication: refuse if the action lists a third party's name + contact info
 *  in a "I vouch for them" position when the operator has not confirmed consent. */
export declare const refuseFabricatedReferences: RefusalPredicate;
/** Consent-fraud: refuse if the action attests/signs on behalf of a third party. */
export declare const refuseUnauthorizedAttestation: RefusalPredicate;
/** Impersonation: refuse if outgoing communication identifies the sender as a real person/org
 *  other than the operator. */
export declare const refuseImpersonation: RefusalPredicate;
/** Security-breach: refuse if the action attempts to obtain credentials/access from a third party
 *  under deceptive pretense. */
export declare const refuseCredentialPhishing: RefusalPredicate;
/** False-witness: refuse if action claims operator witnessed/produced content they did not. */
export declare const refuseFalseWitness: RefusalPredicate;
/** The default refusal predicate set. Composable; extend by passing additional predicates to the classifier. */
export declare const DEFAULT_REFUSAL_PREDICATES: RefusalPredicate[];
/** Run a set of predicates against an action; return the first matching refusal, or null. */
export declare function evaluateRefusals(action: ProposedAction, predicates?: RefusalPredicate[]): RefusalReason | null;
//# sourceMappingURL=refusal.d.ts.map
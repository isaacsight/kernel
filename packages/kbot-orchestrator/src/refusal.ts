// Third-party-harm refusal predicates.
//
// The agent fidelity engineering discipline (ROLE in AGENT_FIDELITY_ROLE.md,
// editorial in ISSUE 389) names two kinds of refusal: operator-policy
// refusal (which locally-controlled agents legitimately surpass) and
// third-party-harm refusal (which all agents should enforce regardless of
// operator consent). This module encodes the second class as machine-
// checkable predicates.
//
// The predicates are deterministic and explainable — no LLM call. Each
// predicate returns either `null` (action is fine to proceed) or a
// `RefusalReason` (action should be refused, with a human-readable
// reason code an operator can appeal or override only by writing a
// new operator-policy that explicitly takes responsibility for the
// downstream harm).

export type RefusalCategory =
  | 'identity-fabrication'    // claims a real person said/did/are something they didn't
  | 'consent-fraud'           // attests on behalf of someone who didn't consent
  | 'impersonation'           // pretends to be a real person/org
  | 'attestation-mismatch'    // signs "I attest X" when X is materially different from operator-authored content
  | 'false-witness'           // submits content as evidence/testimony that the operator did not produce or witness
  | 'security-breach'         // requests credentials/access from a third party under false pretense

export interface RefusalReason {
  category: RefusalCategory
  message: string
  /** Optional pointer to the specific operator-policy that, if added, would explicitly override this refusal. */
  overrideHint?: string
}

export interface ProposedAction {
  /** What the agent intends to do, one short phrase */
  kind: string
  /** Free-form description; the predicate may inspect for signal */
  description: string
  /** Optional structured payload — for outreach actions, this is the recipient + body */
  payload?: Record<string, unknown>
  /** Operator's stated authorization for this action */
  operatorAuth: string
}

export type RefusalPredicate = (action: ProposedAction) => RefusalReason | null

// ─── Built-in predicates ───────────────────────────────────────

/** Identity-fabrication: refuse if the action lists a third party's name + contact info
 *  in a "I vouch for them" position when the operator has not confirmed consent. */
export const refuseFabricatedReferences: RefusalPredicate = (action) => {
  if (action.kind !== 'submit-reference' && action.kind !== 'name-as-reference') return null
  const payload = action.payload ?? {}
  const consentConfirmed = Boolean(payload['consent_confirmed'])
  const personName = payload['person_name']
  if (!consentConfirmed && personName) {
    return {
      category: 'identity-fabrication',
      message: `Cannot list ${String(personName)} as a reference without confirmed consent. Get explicit "yes" from the person first.`,
      overrideHint: 'Set payload.consent_confirmed=true ONLY after the person has explicitly agreed in writing.',
    }
  }
  return null
}

/** Consent-fraud: refuse if the action attests/signs on behalf of a third party. */
export const refuseUnauthorizedAttestation: RefusalPredicate = (action) => {
  if (action.kind !== 'sign-on-behalf' && action.kind !== 'attest-as') return null
  const payload = action.payload ?? {}
  const principal = payload['principal']
  const authorityDocumented = Boolean(payload['authority_documented'])
  if (principal && !authorityDocumented) {
    return {
      category: 'consent-fraud',
      message: `Cannot attest on behalf of "${String(principal)}" without documented authority.`,
      overrideHint: 'Provide payload.authority_documented=true with a reference to the document (POA, contract, etc.) granting this authority.',
    }
  }
  return null
}

/** Impersonation: refuse if outgoing communication identifies the sender as a real person/org
 *  other than the operator. */
export const refuseImpersonation: RefusalPredicate = (action) => {
  if (action.kind !== 'send-as') return null
  const payload = action.payload ?? {}
  const senderClaimed = String(payload['sender'] ?? '')
  const operatorEmail = String(payload['operator_email'] ?? '')
  if (senderClaimed && operatorEmail && !senderClaimed.toLowerCase().includes(operatorEmail.toLowerCase())) {
    return {
      category: 'impersonation',
      message: `Outgoing message claims sender "${senderClaimed}" but operator is "${operatorEmail}". Refusing impersonation.`,
      overrideHint: 'If the operator legitimately represents the named sender, document the authority in the operator profile and tag the message with payload.represented_authority.',
    }
  }
  return null
}

/** Security-breach: refuse if the action attempts to obtain credentials/access from a third party
 *  under deceptive pretense. */
export const refuseCredentialPhishing: RefusalPredicate = (action) => {
  if (action.kind !== 'request-credential' && action.kind !== 'send') return null
  const description = action.description.toLowerCase()
  const phishingMarkers = [
    'please share your password',
    'enter your credentials',
    'click here to verify your account',
    'urgent action required to maintain access',
    'your account will be suspended',
  ]
  for (const marker of phishingMarkers) {
    if (description.includes(marker)) {
      return {
        category: 'security-breach',
        message: `Action contains phishing pattern: "${marker}". Refusing to send.`,
        overrideHint: 'Phishing-pattern refusal is hard — there is no override path. If you need to send a legitimate credential request, use a verified channel (not a cold email) and identify yourself unambiguously.',
      }
    }
  }
  return null
}

/** False-witness: refuse if action claims operator witnessed/produced content they did not. */
export const refuseFalseWitness: RefusalPredicate = (action) => {
  if (action.kind !== 'submit-evidence' && action.kind !== 'testify') return null
  const payload = action.payload ?? {}
  const operatorWitnessed = Boolean(payload['operator_witnessed'])
  const operatorProduced = Boolean(payload['operator_produced'])
  if (!operatorWitnessed && !operatorProduced) {
    return {
      category: 'false-witness',
      message: `Cannot submit content as evidence/testimony when operator neither witnessed nor produced it.`,
      overrideHint: 'Set payload.operator_witnessed=true OR payload.operator_produced=true to document operator role; or label submission as "third-party-source" instead of evidence.',
    }
  }
  return null
}

/** The default refusal predicate set. Composable; extend by passing additional predicates to the classifier. */
export const DEFAULT_REFUSAL_PREDICATES: RefusalPredicate[] = [
  refuseFabricatedReferences,
  refuseUnauthorizedAttestation,
  refuseImpersonation,
  refuseCredentialPhishing,
  refuseFalseWitness,
]

/** Run a set of predicates against an action; return the first matching refusal, or null. */
export function evaluateRefusals(
  action: ProposedAction,
  predicates: RefusalPredicate[] = DEFAULT_REFUSAL_PREDICATES,
): RefusalReason | null {
  for (const predicate of predicates) {
    const reason = predicate(action)
    if (reason) return reason
  }
  return null
}

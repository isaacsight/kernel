# Federal alignment — kbot-finance audit substrate against US federal AI guidance

*A mapping from `@kernel.chat/kbot-finance` audit primitives to the AI
governance frameworks active in the US federal government as of May 2026:
NIST AI Risk Management Framework, the White House Executive Order on AI,
DoD AI Ethical Principles, and FedRAMP applicability for federal cloud
agent deployments.*

Dated 2026-05-21. Filed alongside [`ROLE.md`](./ROLE.md) and
[`docs/agentic-engineering.md`](../../docs/agentic-engineering.md).

Licensed CC BY 4.0.

---

## Why this document exists

The May 2026 US federal AI posture has converged on three load-bearing
asks of any AI agent operating in regulated workflows:

1. **Make agent actions auditable and replayable** — required by NIST AI
   RMF "Manage" function, DoD AI Ethical Principles #3 (traceable),
   and emerging White House EO drafts.
2. **Surface the model + prompt + decision chain that led to each
   consequential action** — required by NIST AI RMF "Govern" function,
   FedRAMP audit-readiness controls, and the regulatory verifier
   pattern that kbot-finance's `verifier` package implements.
3. **Refuse to act in ways that violate jurisdictional rules** — required
   by the regulatory verifier discipline (rules-as-code with
   jurisdiction tagging), which kbot-finance ships in its
   `verifier/` adapter set.

This document maps each of those asks to the specific kbot-finance
substrate primitive that addresses it. The mapping is intended for two
audiences: federal contractors evaluating kbot-finance as an
infrastructure dependency, and AI safety / governance teams seeking
reference implementations for their own federal-track work.

---

## Federal frameworks covered

### NIST AI Risk Management Framework (NIST AI RMF 1.0 + Generative AI Profile)

The framework has four functions: GOVERN, MAP, MEASURE, MANAGE.
kbot-finance addresses each:

| NIST AI RMF function | kbot-finance primitive |
|---|---|
| GOVERN | Hash-chained append-only audit log records every agent decision under a named policy. Policy versioning + jurisdiction tagging in the regulatory verifier maps to GOVERN-1.1 (policies are documented) and GOVERN-1.2 (policies are reviewed). |
| MAP | Content-addressed envelopes around every model call record what the agent saw, asked, and received. Maps to MAP-3.5 (impacts are characterized) and MAP-4.1 (context-of-use is documented). |
| MEASURE | Regulatory verifier emits adverse-action reason codes on every failed check. Per-rule pass/fail telemetry maps to MEASURE-2.1 (metrics established) and MEASURE-3 (functionality verified). |
| MANAGE | Material-gate approval at consequential actions ensures human-in-the-loop for high-impact decisions. Maps to MANAGE-1.2 (incident response procedures) and MANAGE-2.1 (resources allocated). |

### Executive Order on AI (and the May 2026 amendment expected this week)

The EO frames trust, security, and accountability around three things:
content provenance (covered by C2PA support — roadmap), pre-deployment
testing (covered by kbot's evaluation harness — roadmap), and audit
trail (kbot-finance's substrate).

kbot-finance specifically addresses the audit trail requirement:

- Every AI-driven action records a content-addressed envelope of inputs
- Every output is signed with the agent's identity
- Every regulator-facing artifact can be exported in a deterministic
  format suitable for federal review (WORM-compatible, hash-chained)

### DoD AI Ethical Principles (2020, applied via the JAIC/CDAO posture)

Five principles: Responsible, Equitable, Traceable, Reliable, Governable.
kbot-finance addresses the traceable + reliable + governable categories
directly:

| DoD Principle | kbot-finance primitive |
|---|---|
| Traceable | Hash-chained audit log; replayable byte-for-byte under audit |
| Reliable | Deterministic engine adapters separate AI orchestration from source-of-truth computation; the AI does not produce the regulated number |
| Governable | Material-gate approval; downscoped handoff (planned) |
| Responsible | Regulatory verifier with jurisdiction-aware rules; refusal predicates with adverse-action reason codes |
| Equitable | (Partial) — jurisdiction-aware rules can encode fairness/non-discrimination requirements but kbot-finance does not currently ship a fairness adapter. Roadmap item. |

### FedRAMP applicability

For federal cloud deployments, FedRAMP requires:
- Continuous monitoring (ConMon) — kbot-finance audit log provides
  this data substrate; an exporter to STIG-format monitoring is q3 2026.
- DISA STIG compliance — kbot's bash + filesystem tools have been
  hardened for cross-platform safety (see v4.2 Windows sprint); full
  STIG scanning + remediation is q4 2026.
- ATO (Authority To Operate) artifact production — the audit log
  export format is designed to be re-purposed for ATO-required
  artifacts; a specific ATO-bundle exporter is q4 2026.

---

## Mapping primitives to frameworks (summary table)

| kbot-finance primitive | NIST AI RMF | EO on AI | DoD AI Principle | FedRAMP |
|---|---|---|---|---|
| Hash-chained audit log | GOVERN-1.1, MAP-3.5 | Audit trail | Traceable | ConMon data source |
| Content-addressed envelopes | MAP-3.5 | Audit trail | Traceable | Audit artifact source |
| Regulatory verifier (rules-as-code) | MEASURE-2.1, GOVERN-1.2 | Pre-deployment compliance | Responsible | Control set source |
| Material-gate approval | MANAGE-1.2 | Human oversight | Governable | High-impact controls |
| Deterministic engine adapters | MEASURE-3 (functionality verified) | Output reliability | Reliable | Repeatability |
| Adverse-action reason codes | MEASURE-3 | Decision rationale | Traceable | Audit detail |
| Jurisdiction-aware rule packages | GOVERN-1.1 | Multi-jurisdiction compliance | Responsible | Geographic deployment controls |

---

## What this document explicitly does NOT claim

- **kbot-finance is not FedRAMP authorized.** ATO requires specific
  federal-side activities (3PAO assessment, JAB or agency authorization)
  that have not been performed. This document maps primitives to
  framework requirements; it does not claim certification.
- **kbot-finance is not classified or cleared.** The substrate is
  unclassified open-source; specific deployment-side classification work
  remains the responsibility of the deploying federal contractor.
- **The audit substrate is necessary but not sufficient.** Federal
  alignment requires the deploying organization to operate the substrate
  correctly (policy versioning, human approval discipline, incident
  response). The substrate enables compliance; it does not enforce it.

---

## Federal procurement readiness checklist

For federal contractors considering kbot-finance:

- [ ] Apache 2.0 license review (kbot-finance is Apache 2.0, no restrictive
      clauses for federal use)
- [ ] FOSS supply-chain review (npm package, kernel.chat-published, GitHub
      source open; SBOM generation is q3 2026 roadmap)
- [ ] Connectivity / air-gap review (kbot-finance can run fully local;
      no required external dependencies for the audit substrate)
- [ ] ATO artifact mapping (use this document + the audit log export
      format as starting point)
- [ ] Continuous-monitoring integration (kbot-finance audit log is the
      data source; integration with STIG/Splunk pipelines is the
      deploying-side work)
- [ ] Incident response wiring (material-gate denials emit adverse-action
      reason codes suitable for IR workflows)

---

## How to engage with kernel.chat about federal deployments

- **Public dialogue:** issues + PRs at https://github.com/isaacsight/kernel.
  We respond to security + governance questions in the open whenever
  the topic doesn't require classification.
- **Specific procurement-side conversations:** reach via kernel.chat
  contact channels. Federal contractor inquiries are welcome.
- **The discipline behind the substrate:** see
  [`packages/kbot-finance/ROLE.md`](./ROLE.md) for the provenance-
  engineering role definition, and [`docs/agentic-engineering.md`](../../docs/agentic-engineering.md)
  for the field map this discipline sits inside.

---

*Filed under [`packages/kbot-finance/`](.). Licensed CC BY 4.0. The
mapping captures the May 2026 federal posture; revisions will land as
the EO posture, NIST AI RMF updates, and FedRAMP applicability shifts
in subsequent months.*

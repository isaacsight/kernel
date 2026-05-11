# Contributing to kbot-finance

Thank you for considering a contribution. This document is the working
contract between contributors and the project.

## Project shape

- **License:** Apache 2.0. By contributing, you agree your work is
  licensed under Apache 2.0 with the standard DCO sign-off.
- **Maintainer:** isaacsight (founder). Future maintainers are added
  via the ladder described below.
- **Scope:** Audit-grade AI infrastructure — content-addressed
  envelopes, hash-chained audit log, regulatory verifier, MCP server,
  engine adapters. Vertical-specific work (alts-CDM, jurisdiction
  modules) goes in adjacent packages, not core.

## Ground rules

1. **Live smoke is required for adapters.** Stub-driven tests pass
   against the spec, not reality. Every new adapter must include a
   `*.live.test.ts` that hits the real API at least once, gated by
   `KBOT_FINANCE_OFFLINE=1` for offline CI. This is the rule that
   caught the Peekaboo 4.4.1 bug; we don't relax it.
2. **The AI never produces the number.** No PR that has the AI layer
   compute a financial value gets merged. Engines compute; AI
   orchestrates. If you find a place where the line is blurred, file
   an issue and we'll fix the architecture.
3. **Honesty primitive: `byte_identical_replayable: false` is a
   feature, not a bug.** Don't claim determinism you can't deliver.
   If your adapter runs through live HTTPS, GPU inference, or any
   non-deterministic substrate, declare it false.
4. **No emojis in code or user-visible copy** unless the user has
   explicitly asked. (Inherited from the parent kernel.chat project.)
5. **Every regulator-facing artifact must be replayable from the audit
   log alone.** If your exporter needs auxiliary state to reconstruct a
   bundle, fix the exporter — not the deployment.

## The contribution ladder

| Level | Required | Privileges |
|---|---|---|
| **Contributor** | One merged PR | Listed in CONTRIBUTORS, can submit further PRs |
| **Reviewer** | Five merged PRs OR one substantial subsystem PR | Can review and approve other contributors' PRs (binding) |
| **Committer** | Reviewer for 3+ months, demonstrated judgment, recommended by a maintainer | Can merge PRs in their domain |
| **Maintainer** | Committer for 6+ months, multiple subsystems, recommended by an existing maintainer | Can publish to npm, set roadmap, accept license-impacting changes |

There is no shortcut. The ladder is intentionally slow because
audit-grade infrastructure requires trust, and trust accrues through
working code over time.

## Good first issues

Three concrete entry points that don't require deep onboarding:

1. **A new verifier rule.** Pick one paragraph from MiFID II RTS 6, Fed
   SR 26-02, FCA SS1/23, MAS FEAT, or HKMA's GenAI sandbox guidance.
   Encode it as a `Rule` against the existing verifier interface. Tests
   required. The pattern is mechanical once you see it
   (`src/verifier/eu-rts6.ts` is a good template).
2. **A new engine adapter.** Pick a public, free, audit-relevant data
   source (FRED, USPTO, ClinicalTrials.gov, an open-banking endpoint,
   a Kalshi sibling to Polymarket). Wrap it in the five-file adapter
   pattern (`types.ts`, `client.ts`, `commands.ts`, `index.ts`, +
   a live smoke test). The Polymarket adapter is the template.
3. **An export format.** v0.1 ships markdown Annex IV bundles. PDF
   output for regulator portals, structured JSON for machine
   consumption, or a HTML render with embedded hash links are all
   useful additions.

## Larger contributions worth discussing first

Before writing code on any of these, open an issue or RFC PR:

- **Zero-knowledge replay primitives** (zkML / zk-STARKs for
  regulator-side verification without input disclosure).
- **Cross-implementation MCP-extension conformance tests** for the
  content-addressed envelope spec.
- **Hardware-deterministic inference paths** (CRlibm integration,
  integer-only inference, pinned-architecture configurations).
- **License-strategy changes** (anything that affects the Apache 2.0
  core / commercial-premium split requires maintainer consensus).

## PR checklist

Before opening:

- [ ] `npm run typecheck` clean
- [ ] `npm test` green (offline)
- [ ] `npm run test:live` green if you touched an adapter
- [ ] New behavior has tests
- [ ] Public surface changes (anything in `src/index.ts` exports) noted
      in the PR body
- [ ] No emojis in code or comments

PRs that don't meet the checklist will get a polite ping rather than
a merge.

## Review timing

- Maintainer response on a new PR: **within 7 days**, usually within 2
- Merge or actionable feedback: **within 14 days** for small PRs,
  longer for subsystem-shaped work (we'll tell you the estimate)
- Bug fixes for live customer-impacting issues: **within 48 hours**

If we exceed any of these and don't acknowledge, please ping. We're a
small team; backlogs happen; we'd rather you nudge than disappear.

## Disagreement process

Provenance engineering is opinionated. Reasonable people will
disagree. The process for resolving:

1. **RFC pull request.** Open a markdown doc in `rfcs/` proposing the
   change. Discuss in the PR thread.
2. **Maintainer call.** If RFC discussion doesn't converge in 30 days,
   the maintainers decide and document the rationale.
3. **Fork.** Apache 2.0 means you can fork at any time if the
   maintainers' decision doesn't match your needs. We won't take it
   personally.

## What we don't accept

- **Closed-source contributions.** All work must be under Apache 2.0.
- **Anonymous contributions.** DCO sign-off requires a real identity.
- **AI-generated code without disclosure.** Use AI assistance freely,
  but disclose it in the PR description and verify the output yourself
  before submitting. The audit-grade discipline applies to us too.
- **Bundled features.** One PR, one concern. Split sprawling PRs.
- **Style-only changes.** Unless you're fixing a real bug or making a
  real improvement, don't reformat for its own sake.

## Code of conduct

Be the kind of person other people want to ship infrastructure with.
We don't have a longer code; if you need more specific guidance,
imagine what you'd want a maintainer to do if a contributor behaved
the way you're about to, and don't do that.

## Getting set up

```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel/packages/kbot-finance
npm install
npm run typecheck
npm test
KBOT_FINANCE_OFFLINE=1 npm test   # for CI without network
npm run demo                       # end-to-end against live Polymarket
```

## Questions

Open an issue with the `question` label, or — for sensitive matters
(security, license, employment) — email **isaacsight@gmail.com**.

Welcome aboard. Ship something audit-grade.

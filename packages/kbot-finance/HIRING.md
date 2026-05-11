# Hiring: Provenance Engineer (Founding) — kbot-finance

> This is a hireable job description. If you're reading it because you're
> interested, see [Apply](#apply) at the bottom. If you're forking it for
> your own team, see also [`ROLE.md`](./ROLE.md) for the broader
> field definition.

## Headline

We're building the open-source audit-grade substrate for AI agents in
regulated industries — starting with capital markets. v0.2 of
`@kernel.chat/kbot-finance` shipped May 11, 2026. The package is on npm,
integrated into kbot, demonstrated against live Polymarket and SEC EDGAR.

We're hiring the **second engineer** on the project — the first being
the founder. You'll own the next layer of substrate: QuantLib pricing
integration, the alts-CDM schema design, the MCP audit-extension RFC
process, and the per-jurisdiction module ecosystem.

## What you'll ship in the first 90 days

Concrete milestones, not aspirations:

1. **A QuantLib pricing adapter** (vanilla IR swaps + listed equities)
   wired into the existing content-addressed envelope pattern. Includes
   the bit-deterministic floating-point engineering — CRlibm or
   pinned-architecture cloud. This is the gate between *audit-trail* and
   *audit-grade*; you'll define how we cross it.
2. **The MCP audit-extension RFC** moved from draft to working-group
   conversation. We've published the draft (`RFC-content-addressed-mcp.md`)
   in the v0.2 package. You'll drive engagement with the
   `modelcontextprotocol/spec` community and ship the reference
   implementation refinements that come out of feedback.
3. **One per-jurisdiction module shipped end-to-end.** Pick EU (Annex IV
   pipeline) or US (SR 26-02 model-risk integration). The module is a
   verifier rule pack + an exporter + a deployment-config preset, sold
   as a single `npm install @kernel.chat/kbot-finance-eu`-shape package.

If those three things ship clean in 90 days, you're succeeding.

## What you'll do in the first year

- Design the **alts-CDM schema** — the open standard for private-markets
  pricing/NAV/lineage. Doesn't exist publicly today; this is greenfield
  work with regulatory tailwind.
- Lead the **first paid design partner deployment.** Walking a Tier-2
  buy-side or fintech infrastructure firm through installing kbot-finance,
  wiring their first audit-grade workflow, and producing the first
  examiner-exportable Annex IV bundle from production traffic.
- Build the **second and third engine adapters** beyond Polymarket and
  EDGAR. Likely candidates: FRED, ISDA CDM trade representations,
  on-chain settlement layers (specifically picking adapters that
  demonstrate the pattern generalizes).
- Coauthor the spec when the first nine-figure AI enforcement action lands
  and the inter-agency RFI process accelerates.

## What you should be familiar with on day one

You don't need depth in all six provenance-engineering disciplines
([see ROLE.md](./ROLE.md#the-six-discipline-overlap)). You need depth in
**at least three**, and demonstrated ability to ramp into the others.

The minimum bar:

- **TypeScript or Rust** in production at scale. (The substrate is
  TypeScript today; Rust is the obvious next-layer language for the
  deterministic-FP work.)
- **Distributed systems comfort.** You've shipped something with
  append-only logs, state machine replication, or content-addressed
  storage. You can discuss FLP and CAP trade-offs from experience, not
  just textbooks.
- **Cryptographic primitives.** You've used SHA-256 content addressing,
  HMAC signatures, or Merkle proofs in production. Comfort with
  Ed25519, BLAKE3, or zk-proofs is a strong plus.
- **One regulated domain.** Finance is the wedge but not the
  requirement. Healthcare (FDA SaMD), drug discovery, defense,
  aviation, nuclear, tax — anywhere "deterministic engine + AI overlay +
  human governance" already exists. You'll bring pattern transfer.
- **MCP or equivalent agent protocol fluency.** You've built an MCP
  server, or you've built tooling that integrates with Claude Code /
  Cursor / similar agent platforms.

The stretch bar:

- **Numerical analysis depth.** You know what catastrophic cancellation
  is without looking it up. You've thought about reproducible BLAS or
  CRlibm. You can explain why IEEE 754 doesn't guarantee bit-identical
  reduction order.
- **Regulatory text fluency.** You've read EU AI Act Annex IV in the
  original. You know what RTS 6 Article 9 self-assessment actually
  requires. You can pair with counsel without an interpreter.
- **Open-source maintainership.** You've been a committer or maintainer
  on a project with non-trivial outside contribution traffic.

## Working setup

- **Remote.** Permanently. Headquarters is wherever you are.
- **Time zone.** Within ±6 hours of US Eastern for sync overlap with the
  founder and most early design partners.
- **Async-by-default communication.** GitHub issues, RFCs, and PRs are
  the primary surface. Synchronous time is reserved for design reviews
  and customer calls.
- **kernel.chat is the company.** Open-source-first; commercial-premium
  revenue tier landing later. kbot-finance is the first product; the
  magazine and broader kernel.chat AI engine are sibling surfaces.

## Compensation

- **Cash:** $180k–$280k base, calibrated to location and seniority.
- **Equity:** Meaningful founding-engineer grant. We use standard
  4-year vest with 1-year cliff; specific percentage discussed openly
  in the first conversation.
- **Provenance engineering market rates** as we read them in May 2026:
  - Senior quant developer NYC: $400–650k all-in
  - Senior applied AI engineer SF: $350–550k all-in
  - The combined-disciplines provenance role: $500–800k by 2028 when
    the title lands.
  - We're below that today because we're early. We won't be below it
    in 18 months.
- **No "competitive benefits" boilerplate.** What you get is health
  insurance, a real laptop, conference budget when it matters, and
  the time to do the work.

## What we're not

To save time:

- **Not a model lab.** We don't train models. If you want to do
  pre-training, post-training, or fine-tuning research, go to Anthropic
  or OpenAI.
- **Not a trading firm.** We don't take market positions. If you want
  P&L responsibility from market-making or alpha generation, go to
  Jane Street or a quant fund.
- **Not a closed-source enterprise vendor.** We don't sell six-figure
  per-seat licenses with NDA evaluation cycles. If you want the Palantir
  forward-deployed-engineer experience, that's a different company.
- **Not a consultancy.** We don't bill hours; we ship infrastructure
  that other people use.

## The honest pitch

This is an early-stage substrate engineering role on a one-person team
that just shipped v0.2. The product exists; the company doesn't yet.
You'd be the second engineer and the first hire. The upside is
defining the spec for what audit-grade AI infrastructure looks like
across regulated industries, with your name on the early commits and
the early RFCs. The downside is the company shape isn't proven yet;
the funding isn't raised yet (we're bootstrapping the first deployment
before raising); the buyers aren't lined up yet.

If "ship the substrate that becomes the standard, and own that surface
for the next decade" is your bet, this is the role. If you want
clearer rails and a bigger team, come back in 12 months.

## Apply

Email **isaacsight@gmail.com** with the subject
`provenance engineer — <your name>` and include:

1. **A link to one public commit, PR, or repo** you're proud of in the
   audit-grade / substrate / distributed-systems space. Code beats
   resume.
2. **A 200-word answer to:** *Pick one paragraph from EU AI Act Annex IV
   or Fed SR 26-02. Describe how you'd encode it as a verifier rule in
   the kbot-finance `Rule` interface. Don't over-engineer — show how
   you'd ship the smallest correct thing.*
3. **What you'd want to ship first if hired today.** Honest answer,
   not what you think we want to hear.

No cover letter required. No "tell me about a time you" questions in
the interview. The conversation is design-doc-shaped: we'll pair on a
real substrate problem for 90 minutes and decide if the working
relationship makes sense.

---

*This JD is licensed CC BY 4.0. Fork it. Hire your own provenance
engineers with it. Adapt the bar to your domain.*

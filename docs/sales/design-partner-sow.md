# Design-Partner Pilot — Statement of Work

> **Purpose:** A one-page-ish SOW template you send within 24 hours of
> a validation call that ended with "yes, interested in a pilot."
> Pre-written so the friction from interest to signature is hours,
> not weeks.
>
> **Two versions below** — copy the one that fits the buyer profile
> and find-replace the `<...>` placeholders.
>
> The standard pilot terms:
> - 30-90 days from signature to first regulator-exportable artifact
> - $25,000-$75,000 fixed fee, scoped to first deliverable
> - You get the deployment; we get a case study + a quotable testimonial
> - You can extend into an ongoing subscription if it works

---

## Version A — Engineering-led buyer (they have devs)

```
STATEMENT OF WORK · KBOT-FINANCE PILOT
————————————————————————————————————————

PARTIES
  Provider:   kernel.chat group (Isaac Hernandez, sole proprietor)
              isaacsight@gmail.com
              < address optional >
  Customer:   < Firm name >
              Attention: < name, title >
              < address >

EFFECTIVE DATE
  < ISO date >

PILOT TERM
  < 30 / 60 / 90 > days from the Effective Date, with one 30-day
  extension available at Customer's request.

PILOT GOAL
  Deploy @kernel.chat/kbot-finance into Customer's environment such
  that:
    (1) Customer's AI agents call deterministic engines through
        content-addressed envelopes;
    (2) Every AI-influenced decision is recorded in a hash-chained,
        WORM-compatible audit log;
    (3) Customer can export a regulator-ready bundle (EU AI Act
        Annex IV / Fed SR 26-02 / FINRA 2026 ROR shape — Customer
        picks the jurisdiction) on demand from the audit log.

SCOPE

  In scope:
    - Installation of @kernel.chat/kbot-finance into a Customer-
      designated environment (cloud, on-prem, or air-gapped).
    - Configuration of the regulatory verifier with rules specific
      to Customer's jurisdiction(s): < US / EU / UK / SG / HK / UAE >.
    - Wiring of one (1) Customer engine adapter — typically the
      pricing API, brokerage API, or filing-data source that
      Customer's AI agents already call.
    - Configuration of audit-log storage on Customer-designated
      WORM-compatible infrastructure (S3 Object Lock, immudb,
      Aeron log, or equivalent — Customer's choice).
    - One regulator-ready export bundle generated from the audit
      log at end of pilot, suitable for handoff to Customer's
      compliance team or auditor.
    - Up to < 8 / 16 / 24 > hours of synchronous engineering
      consultation across the pilot term.
    - Async support via shared Slack/Discord/email channel during
      pilot term.

  Out of scope (separate engagement if desired):
    - Custom regulatory verifier rules beyond the pre-built
      jurisdiction libraries.
    - Integration with more than one of Customer's engine adapters.
    - SOC 2 / ISO 27001 attestation (we'll provide the architectural
      documentation needed; the audit itself is Customer's).
    - Production trading or live order placement; pilot is read-only
      unless Customer's compliance officer has signed off
      separately on automated execution.
    - Training of Customer staff beyond the consultation hours
      noted above.

DELIVERABLES

  D1. Installed kbot-finance package in Customer environment,
      version-pinned to the @kernel.chat/kbot-finance release
      current at signing.
  D2. Verifier-rule pack for Customer's selected jurisdiction(s),
      configured against Customer's pre-trade limits and
      materiality thresholds.
  D3. Audit-log storage configured against Customer-designated
      WORM substrate.
  D4. One (1) regulator-ready export bundle (Annex IV / SR 26-02
      / RTS 6 shape), generated against ≥7 days of accumulated
      audit log entries.
  D5. A short post-pilot brief (≤5 pages) summarizing what was
      built, what was learned, and what an ongoing subscription
      would cover — handed to Customer for internal use.

PRICING

  Fixed fee: $< 25,000 / 50,000 / 75,000 > USD, payable in two
  installments:
    50% upon signature
    50% upon delivery of D4 (the export bundle)

  No additional charges for travel, calls, or async support
  during the pilot term. If Customer requests work outside
  the scope above, Provider will quote separately before
  starting.

CASE-STUDY RIGHTS (NON-MONETARY CONSIDERATION)

  In exchange for the discounted pilot pricing relative to a
  full implementation, Customer grants Provider:
    - The right to publicly disclose that < Firm name > is a
      kbot-finance design partner.
    - The right to publish a case study describing the work
      done (with Customer review of the draft, and the right
      to redact any commercially sensitive detail).
    - The right to quote one or two sentences from Customer's
      designated representative about the work (with the same
      review-and-redaction right).

  Customer may decline any of the above and the pilot continues
  unchanged; pricing in that case is renegotiated to standard
  implementation rates.

SUBSCRIPTION OPTION

  Upon successful pilot completion (defined as Customer's
  acceptance of D4), Customer has a 60-day exclusive option to
  enter into an ongoing subscription at the following rate:
    $< 24,000 / 50,000 > USD annually for hosted audit-log
    retention, jurisdiction-rule updates, and 4 quarterly
    refresh cycles.

  Subscription pricing locks for 24 months from the date of
  conversion. Customer has no obligation to convert.

INTELLECTUAL PROPERTY

  The kbot-finance package remains licensed under Apache 2.0;
  Customer's use is governed by that license. Customer-specific
  configuration, audit-log content, and any custom code written
  during the pilot remain Customer's property and are not
  contributed back unless Customer chooses to do so.

  General improvements made to the open-source package during the
  pilot (bug fixes, performance improvements, new adapters that
  Customer agrees to publish) will be released under Apache 2.0
  to the public repository.

WARRANTIES + LIMITATIONS

  Provider warrants the pilot deliverables will operate as
  described in the README and RFC documents shipped with the
  package version in use at the time of delivery. Provider does
  not warrant the package against use cases outside the scoped
  jurisdiction(s) or against regulator interpretations not in
  effect at the time of signing.

  Provider's total liability under this SOW is limited to the
  total fees paid by Customer.

TERMINATION

  Either party may terminate this SOW with 14 days written
  notice. If terminated before D4 is delivered, Provider refunds
  the unearned portion of fees paid (pro-rata against time
  elapsed).

GOVERNING LAW

  < State / country > law, < jurisdiction > courts.

SIGNATURES

  For Provider:                For Customer:

  ___________________          ___________________
  Isaac Hernandez              < Name, Title >
  kernel.chat group            < Firm name >

  Date: ____________           Date: ____________
```

---

## Version B — Non-engineering-led buyer (compliance / GC champion)

Same shape as Version A, with these substitutions:

- **Scope** — remove the "Customer engine adapter" wiring line; add
  an "Implementation engineer assigned by Provider for the duration
  of the pilot" line.
- **Pricing** — bump the fixed fee to **$50,000-$100,000** (it now
  includes implementation labor that Version A's customer would do
  themselves).
- **Deliverables** — add **D0: turnkey deployment** (Customer's IT
  receives a working install at no further configuration cost) as the
  first deliverable.
- **Subscription option** — bump to **$50,000-$100,000 annually**
  to reflect the implementation services being bundled in ongoing.
- **Consultation hours** — bump to 40-80 hours, spread across the
  pilot term.

---

## How to use this SOW in the wild

1. **Don't send it cold.** Send it only after a validation call where
   the buyer explicitly said "yes, interested in a pilot." The doc
   is a confirmation tool, not a pitch tool.

2. **Match the version to the buyer.** Engineering-led? Version A.
   Compliance / general counsel champion? Version B.

3. **Fill in the placeholders before sending.** A SOW with `<Firm
   name>` left as-is reads as templated; even three minutes of
   fill-in makes it feel bespoke.

4. **Quote one specific call detail in the cover email.** "Based on
   your concern about your auditor asking for AI-decision evidence
   six months later, the most relevant piece is D4." Signals you
   listened.

5. **Set the price deliberately.** First three pilots: aim toward
   the low end ($25-50K). The reference accounts are worth more
   than the cash. After five pilots: price at the high end ($75-100K)
   because by then you have proof and the buyer is paying for
   certainty.

6. **The 60-day exclusive option matters.** It's not a contract
   commitment — it's optionality. Buyers like optionality, and
   it gives you 60 days to negotiate the subscription without
   competitive pressure.

---

## What you don't put in this SOW

- **NDA boilerplate.** Don't ask for one; offer to sign theirs if
  needed. Asking for an NDA before they've engaged makes you look
  larger than you are.
- **Acceptance criteria** beyond what's in the deliverables. Vague
  acceptance criteria are how pilots become unending. Pin to the
  artifacts.
- **Service-level agreements (SLAs).** Pilots don't have SLAs. They
  have deliverables. SLAs come with the subscription, not the pilot.
- **A liability cap higher than fees.** You're a sole proprietor or
  small team. Don't take on uncapped liability for early customers.

---

## The cover email when you send it

```
Subject: SOW for the kbot-finance pilot · <Firm short name>

<First name>,

Per Thursday's call — here's the one-page SOW for the pilot we
discussed. The shape:

  - 60-day pilot, fixed fee, two-installment payment.
  - Deliverable: a regulator-ready Annex IV export bundle from
    7+ days of your real audit-log traffic.
  - Includes the verifier-rule pack for <jurisdiction> and one
    engine adapter wired against <their AI workflow>.
  - You get the deployment; I get case-study rights (with your
    review).
  - 60-day option to convert to ongoing subscription if it works.

If the shape looks right and the fee is workable, I can have
you live and writing audit log entries within two weeks of
signing.

Happy to revise — usually 1-2 rounds before signature. Or if
something here is clearly off-shape for <Firm>, just tell me
what to change.

— Isaac
  isaacsight@gmail.com
  github.com/isaacsight/kbot-finance
```

---

## What "yes" to the SOW looks like

- **Same-day "looks good, sending to legal"** → you've found a buyer
  who's already decided. Expect signature within 7-14 days.
- **"Can we discuss the price / scope / case-study clause?"** → real
  negotiation. Expect signature within 14-30 days. Worth it.
- **"Let me share with our compliance officer"** → champion is in the
  building, decision-maker isn't yet. Expect 30-60 days.
- **No reply for 14 days** → soft no. Send one polite follow-up,
  then close the loop on your side.

---

*SOW template v0.1 · May 2026 · CC BY 4.0 · Edit aggressively as
real signed deals teach you what should and shouldn't be in it.*

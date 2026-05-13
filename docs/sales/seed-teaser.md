# Seed-Round Teaser — kernel.chat / kbot-finance

> **Purpose:** Six slides of content for the moment an investor catches
> the conversation. Not a full pitch deck — a *teaser* that earns the
> follow-up meeting and lets you walk into that meeting with the deck
> already half-built in their head.
>
> Use this when:
> - A VC reaches out after seeing the npm publish or an HN post
> - An angel asks "what are you actually building" over coffee
> - A potential design partner's CEO wants to understand the business
>   shape, not just the pilot
>
> Don't use this when:
> - You haven't done the five validation calls yet (the deck has a
>   "traction" slide that's currently empty)
> - You're not actually raising — sending this signals you are,
>   which constrains your optionality
>
> Written in markdown; convert to Keynote/Figma/Slides only after the
> story is settled in text. **Words first, design later** — the
> wordsmithing is the hard part.

---

## Slide 1 — Title + one-line claim

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              kernel.chat                                   │
│                                                            │
│              The open-source audit substrate               │
│              for AI agents in regulated industries.        │
│                                                            │
│              Isaac Hernandez · isaacsight@gmail.com        │
│              May 2026                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- No "Inc." yet. "kernel.chat" is the brand.
- The one-liner is the sharpest version of the thesis. Don't add
  qualifiers. "Open-source audit substrate for AI agents in
  regulated industries" — eight words that name what, who, and why.

---

## Slide 2 — The problem (one sentence + receipts)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   When an AI agent makes a decision in a regulated         │
│   industry, no one can prove what it saw, what it          │
│   computed, or who approved it.                            │
│                                                            │
│   ─ Two Sigma: $90M + $165M settlement (2024) for model    │
│     governance failure                                     │
│   ─ EU AI Act high-risk obligations: enforceable Aug 2026  │
│   ─ Fed SR 26-02 supersedes SR 11-7 (Apr 2026)             │
│   ─ FINRA 2026 ROR: GenAI now exam-priority                │
│                                                            │
│   Today's answer: "we have logs, sort of."                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- Open with the sentence that names the problem in human language.
  Investors don't yet have the vocabulary; you're teaching it on
  this slide.
- Receipts are dated and specific. Vague regulatory hand-waving
  reads as wishful thinking; named rules + actual enforcement
  reads as inevitable.
- The closing line ("we have logs, sort of") is the dry-fact
  framing investors love. Honest, slightly funny, very clear.

---

## Slide 3 — The insight (the architectural rule)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   The structural rule:                                     │
│                                                            │
│   AI never produces the source-of-truth number.            │
│   Deterministic engines do.                                │
│   Humans approve at material gates.                        │
│   Every step is content-addressed and replayable.          │
│                                                            │
│   ─────────                                                │
│                                                            │
│   This is how Bloomberg ASKB ships internally (Feb 2026).  │
│   We're building the open equivalent.                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- Don't paraphrase the rule. Read it verbatim. The cadence
  matters; it sounds like a constitutional principle, not a
  product feature.
- Pointing at Bloomberg ASKB does two jobs: (a) validates that
  serious infrastructure adopts this shape, (b) names a closed
  competitor so the "why open" follow-up question is teed up.
- Don't go to the technical detail in this slide. Save it for
  the deeper meeting.

---

## Slide 4 — The product (one diagram, no jargon)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  AI Intelligence Layer (kbot / Claude / GPT)        │  │
│   └─────────────┬───────────────────────────────────────┘  │
│                 │  content-addressed request envelope      │
│                 ▼                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Regulatory Verifier (rules-as-code per jurisdiction)│  │
│   └─────────────┬───────────────────────────────────────┘  │
│                 │  pass / adverse-action reason code       │
│                 ▼                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Material-Gate Approval (signed token, if material)  │  │
│   └─────────────┬───────────────────────────────────────┘  │
│                 ▼                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Deterministic Engine (pricing / risk / NAV / etc.) │  │
│   └─────────────┬───────────────────────────────────────┘  │
│                 │  sealed envelope: request_hash + value   │
│                 ▼                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Hash-Chained Audit Log (WORM-ready)                │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                            │
│   v0.2 live on npm · 198KB · Apache 2.0                    │
│   npm install @kernel.chat/kbot-finance                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- The diagram does the talking. Read aloud only the layer names.
- The "v0.2 live on npm" line is the proof slide. They land on
  this and click the npm link in their head; that's the goal.
- The npm command is a tactile detail — investors who paste it
  into a terminal see the demo before the next meeting.

---

## Slide 5 — Market timing (the window)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   12-18 month spec-freeze window:                          │
│                                                            │
│   Feb 2026   Bloomberg ASKB ships pattern (closed)         │
│   Apr 2026   Fed SR 26-02 supersedes SR 11-7               │
│   May 2026   @kernel.chat/kbot-finance v0.2 published      │
│              ↑ we are here                                 │
│   Aug 2026   EU AI Act high-risk obligations enforceable   │
│   2026-27   First nine-figure US AI enforcement action     │
│              (baseline rate suggests inevitable)           │
│   2027      MCP audit-extension spec ratifies              │
│   2028      "Provenance engineering" becomes a JD term     │
│                                                            │
│   Whoever ships the reference implementation first         │
│   inside this window owns the spec.                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- Timelines on a vertical scroll feel inevitable. Investors who see
  named regulations + dates think the train is leaving the station.
- The "we are here" arrow is the moment of urgency. Investors hear
  "next 12-18 months" as "I should decide quickly."
- Don't oversell the enforcement-action prediction. It's a baseline-
  rate inference, not a guarantee. Say so in the conversation.

---

## Slide 6 — Traction + the team (honest)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Today (May 2026):                                        │
│                                                            │
│   ─ @kernel.chat/kbot      ~7,000 monthly downloads        │
│   ─ @kernel.chat/kbot-finance  v0.2 published <X> days ago │
│   ─ <N> validation calls completed                         │
│       <K> firms said byte-identical replay is must-have    │
│   ─ <N> design-partner pilots in negotiation               │
│       <list specific firms if signed, else "named accounts"│
│        in tier-2 financial services">                      │
│   ─ MCP audit-extension RFC drafted; submission scheduled  │
│   ─ kernel.chat magazine: ISSUE 381 names the field        │
│                                                            │
│   ─────────                                                │
│                                                            │
│   Team:                                                    │
│     Isaac Hernandez · founder, sole engineer today         │
│     Hiring: founding provenance engineer                   │
│     (JD live at github.com/.../HIRING.md)                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- Don't fabricate numbers. If you haven't done validation calls
  yet, leave that line out. If pilots haven't started, leave that
  line out. Half-empty is fine; half-fake is not.
- The "sole engineer today" + "hiring founding engineer" + "JD
  live" combo is the right honesty register. Solo today, building
  the team, transparent about both.
- The JD URL is a real-world thing the investor can click. The
  click is more persuasive than the resume slide most decks lead
  with.

---

## Slide 7 — The ask (one sentence + use of funds)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   We're raising:                                           │
│   $< 2.0 - 3.0 >M seed at $< 15 - 25 >M post-money         │
│                                                            │
│   18 months of runway buys:                                │
│                                                            │
│   ─ 2 additional engineers (provenance + implementation)   │
│   ─ SOC 2 Type II attestation                              │
│   ─ 3-5 paid design partners → first $500K-$1M ARR         │
│   ─ MCP audit-extension RFC through to ratification        │
│   ─ Per-jurisdiction modules: EU + US v1.0                 │
│                                                            │
│   Goal at month 18: $1.5M-$3M ARR, Series A-ready, named   │
│   on the MCP spec.                                         │
│                                                            │
│   Open to: strategic seed leads with infra/regtech         │
│   experience. Looking for board observer, not voting       │
│   board seat at this stage.                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- The dollar figures are negotiable but honest. Pick the smaller
  number to start; investors push up if they want to.
- Use of funds is concrete and bounded. Not "marketing / growth /
  team" — actual line items with named outcomes.
- The board-seat preference signals that you've thought about
  control. Investors respect this even if they push back.
- "Strategic seed leads" filters for the right kind of money.
  Generalists slow you down here.

---

## Appendix slide (optional, in deeper meeting)

If the meeting goes 30+ minutes, an appendix slide that adds:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Why this is hard to copy:                                │
│                                                            │
│   1. Six-discipline overlap rare in one team:              │
│      quant finance + distributed systems + cryptography    │
│      + numerical analysis + regulatory + AI engineering    │
│                                                            │
│   2. Spec ownership compounds:                             │
│      first implementer of MCP audit extension owns the     │
│      reference position for the next decade                │
│                                                            │
│   3. Open-source + commercial premium dual-shape:          │
│      Apache 2.0 core means buyers can't be locked in;      │
│      premium SKU funds the substrate                       │
│                                                            │
│   4. Magazine as eponymous trade publication:              │
│      kernel.chat already publishes ~monthly on this        │
│      discipline — the audience for the product is the      │
│      audience for the magazine                             │
│                                                            │
│   5. Eight-version-in-thirteen-days kbot ship cadence:     │
│      observable proof that the team executes               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Voice notes:
- The "five reasons it's hard to copy" slide is the moat slide.
  Investors map this onto their internal "is this defensible" check.
- Don't lead with this slide; you'll sound defensive. Use it only
  if asked or if the meeting is going deep.

---

## What investors will ask (be ready)

Three questions every investor asks; pre-write the answers:

### 1. "Why won't Bloomberg / Palantir just do this?"

**Honest answer:**
> *"They will, in some shape, eventually. But (a) they'll do it closed,
> for their existing customer footprint, and the rest of the market
> wants an open alternative; (b) the spec ownership goes to whoever
> publishes first — that's already us; (c) Bloomberg's footprint is
> tier-1 sell-side, not the tier-2/3 buy-side and fintech infra layer
> we sell into. We're solving for a buyer set the incumbents don't bid
> on."*

### 2. "What's the revenue model again?"

**Honest answer:**
> *"Open-source Apache 2.0 core for the substrate. Revenue from seven
> adjacent products the substrate enables: hosted audit-log retention,
> SOC 2 attestation, certified deterministic inference, per-jurisdiction
> rule modules, Annex IV exporter as a managed service, implementation
> services, and provenance-engineer certification. Same shape as
> HashiCorp / MongoDB / Stripe — sell the operational guarantees, not
> the code."*

### 3. "How do you compete for talent with Anthropic / OpenAI?"

**Honest answer:**
> *"We don't compete on cash; we compete on substrate depth. The role
> we're hiring is at the overlap of six disciplines — most candidates
> at frontier labs only need three. The work is more concrete (you
> see the spec land), and the equity stake is meaningful in a way it
> isn't at a $50B private company. Our first hire's bar is the same
> bar Steinberger's first hire would have been at Peekaboo."*

---

## What to send before the meeting

```
Subject: kernel.chat / kbot-finance — quick read before <date>

<First name>,

Looking forward to <day>. Two-minute pre-read:

  npx -y @kernel.chat/kbot-finance demo
  ── runs against live Polymarket, prints the audit log,
     verifies the hash chain. 30 seconds, no setup.

  github.com/isaacsight/kbot-finance ── the package
  RFC-content-addressed-mcp.md ── the spec we're proposing for MCP

The teaser deck is attached. Six slides. The conversation will be
better than the slides; the slides exist so the conversation can
skip the intro.

— Isaac
```

---

*Teaser content v0.1 · May 2026 · Convert to slides only after the
words feel right out loud. Read every slide aloud once before you
move it into Keynote — anything that sounds awkward read aloud will
sound worse in a meeting.*

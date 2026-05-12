/* ──────────────────────────────────────────────────────────────
   ISSUE 381 — MAY 2026
   ON PROVENANCE
   来歴について — 五年の賭けに名前をつける

   A forecast-format manifesto. The issue names the discipline
   the magazine — and the work the magazine sits beside — has been
   building, and commits to it as the throughline for the next
   five years. Provenance engineering: the substrate underneath
   AI agents in regulated industries, where the deterministic
   engine produces the number and the AI orchestrates and
   interprets. The week before this issue, the substrate's first
   public artifact (kbot-finance v0.2) shipped to npm; the issue
   after the shipping is the issue that names what was shipped.

   Identity decisions:

     • coverStock = 'ink' — manifesto / archival / nocturnal,
       the same register 376 (ON STANDARDS) used. A declaration
       reads on ink in a way it does not on cream. The stock
       signals the temperature of the claim: this is the issue
       the magazine commits, in writing, to a five-year direction.

     • coverLayout = 'monument-hero' — the issue number IS the
       cover art. Used sparingly: anniversaries, milestones,
       absences. This issue is a milestone — the act of naming
       a discipline is a numbered event that the magazine wants
       to be able to point back to. The headline shrinks; the
       number 381 carries the cover. Read it again in 2031 and
       the cover will still know what it was.

     • coverOrnament = 'asterisk-stamp' — the small mark that
       should have shipped beside the v0.2 release notes but did
       not. 374 introduced this ornament for AGAINST VIRAL
       BENCHMARKS — the asterisk that should have been on the
       headline. 380 reused it for THREE IDIOMS. 381 uses it for
       the same reason: the magazine adding the footnote that the
       repo did not have room for.

     • coverSeal = DECLARED · BET · V·26 — the verb shifts. 376
       FILED · STANDARDS, 377 FILED · API TIER, 378 FILED · BENCH
       were filings; 380 NOTED · IDIOMS was a recognition; 381
       DECLARED · BET is, finally, a commitment. The seal is the
       record of the verb, not the register of style. The verbs
       are getting honest.

     • accent = 'amethyst' — explicit. The cabinet entry: "When
       the issue is about kernel.chat itself — mastheads,
       anniversaries." This issue is exactly that — the magazine
       declaring its own next five years. Amethyst is the right
       register. Cobalt would have made it sound like a systems
       essay (380's voice); pool would have made it sound like
       a toolkit announcement; tomato would have made it sound
       like a regular drop. Amethyst is the masthead voice the
       magazine reserves for issues about itself.

     • spread.type = 'forecast' — manifesto-shaped. Seven
       numbered propositions, the format the magazine reserves
       for stakes filed against a direction. 370 (HOW TO FIND A
       DESIGN LANGUAGE) used the same form when the magazine
       declared the design grammar; 381 uses it for the editorial
       throughline. The shape of the claim matches the shape of
       370's: this is what we are committing to and why.

   The kbot-finance discipline:

     • kbot-finance v0.2 shipped to npm and the kernel monorepo
       three days before this issue. The release notes are public
       (RELEASE_NOTES_4_5.md in the kbot package); the substrate
       package exists; the MCP audit-extension RFC is drafted.
       This issue names what the substrate is FOR — the five-year
       editorial commitment to documenting the discipline as it
       names itself, hires its first practitioners, gets cited in
       regulatory text, and becomes (or fails to become) standard.

     • The artifact is not the subject. The discipline is. The
       artifact appears in the margin, as 380 reported peekaboo
       in its margin. ISSUE follows the substrate; the substrate
       follows the work; the work has now been named.

   Voice constraints (continued from 377/378/380):
     • Sober, slightly puzzled, instructive. No selling.
     • No "POPEYE" string. No app/dashboard/widget vocabulary.
     • No "this changes everything" register. No "we are excited
       to" register.
     • The bet is named once, in the title; the propositions
       carry the body without restating the headline.

   Identity-catalog row to add to docs/design-language.md (handed
   to the editor — do not edit that file from inside this issue):

     | 381 | ink | monument-hero | asterisk-stamp | seal: DECLARED · BET · V·26 | amethyst | forecast | First amethyst-on-ink masthead-shape issue since 370. Monument-hero used for the second time after 370 — both issues that named a five-year-shape commitment, both that wanted the number itself to do the cover work. Seal verb DECLARED is new — adjacent to 380's NOTED and the 376/377/378 FILED arc, but honest about being a commitment rather than a noticing or a filing. The asterisk-stamp ornament returns for a third time in the small-mark-as-footnote register. |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_381: IssueRecord = {
  number: '381',
  month: 'MAY',
  year: '2026',
  feature: 'ON PROVENANCE',
  featureJp: '「来歴について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ink stock + monument-hero layout, the
      masthead-shape used for milestone issues. The number 381 is
      the cover; the headline yields to it. Amethyst accent in
      the masthead voice the magazine reserves for issues about
      itself. */
  coverStock: 'ink',
  coverLayout: 'monument-hero',
  coverOrnament: 'asterisk-stamp',

  /** Registry stamp — verb DECLARED, new to the seal catalogue.
      A commitment rather than a filing or a noticing. The seal
      records the verb. */
  coverSeal: {
    label: 'DECLARED · BET · V·26',
    date: 'V·26',
  },

  /** Amethyst — explicit. The cabinet entry reserved for issues
      about kernel.chat itself — mastheads, anniversaries. This is
      that kind of issue. */
  accent: 'amethyst',

  /** First back cover under the spec at docs/back-cover-spec.md.
      The issue that names provenance engineering as a discipline
      gets, on its verso, the physical artefact provenance is
      modelled on — a hand-stamped notary mark on cream paper.
      Ledger stock (front is ink; the back wants the daylight
      register). Image asset to be commissioned; the renderer falls
      back to a textured placeholder until it lands. */
  backCover: {
    subject: 'HAND-STAMPED NOTARY MARK ON CREAM PAPER',
    subjectJp: '公証印',
    stock: 'ledger',
    // image: '/back-covers/381-notary.jpg',  // commissioned, not yet shipped
  },

  headline: {
    prefix: 'On',
    emphasis: 'Provenance.',
    suffix: '',
    swash: 'The discipline the magazine — and the substrate beside it — commits to for the next five years.',
  },

  contents: [
    { n: '001', en: 'Name what you have been building', jp: '名づけ', tag: 'OPENING' },
    { n: '002', en: 'The structural rule', jp: '構造の規則', tag: 'RULE' },
    { n: '003', en: 'Six disciplines, one vocabulary', jp: '六つの分野、一つの語彙', tag: 'OVERLAP' },
    { n: '004', en: 'Ship the substrate, not the strategy', jp: '基盤を出す', tag: 'METHOD' },
    { n: '005', en: 'The window', jp: '窓', tag: 'TIMING' },
    { n: '006', en: 'The editorial throughline', jp: '編集の通り線', tag: 'DISCIPLINE' },
    { n: '007', en: 'The bet does not know it is a bet yet', jp: '賭けはまだ自分が賭けと知らない', tag: 'CLOSING' },
  ],

  spread: {
    type: 'forecast',
    kicker: 'THE FORECAST · ★ · 2031までの五年',
    title: 'On Provenance.',
    titleJp: '来歴について。',
    deck: 'Seven stakes filed at issue number 381 — the issue that names the discipline this magazine, and the substrate it sits beside, will spend the next five years inside. Provenance engineering: the architectural rule that AI never produces the source-of-truth number. The seven propositions name the rule, the overlap of disciplines that make the rule possible, the method, the window, and the bet the next year does not get to redraft.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ink',

    intro: 'The discipline has been the work for a year. The discipline did not have a name until this week. The name, like all good names, was older than the thing it now belongs to — provenance is the word libraries use for "where this came from and how we can prove it." Provenance engineering is what the substrate underneath an AI agent in a regulated industry has to do: prove what was asked, what was returned, what was computed, what was decided, who approved it, and replay the decision byte-for-byte under audit. Seven stakes follow, drawn from a year of building exactly that.',

    propositions: [
      {
        n: '01',
        title: 'Name what you have been building.',
        titleJp: '名づけよ',
        body: [
          'The work has been provenance engineering for a year. The magazine called the work "infrastructure," then "audit substrate," then "the thing underneath the agents," then "what comes after MCP gets serious." None of the working names landed. The library shelf had the right word all along: provenance — the chain of custody an object carries, the lineage that lets a reader believe the object is what it claims to be. Engineering the substrate that produces that chain, for AI agents operating inside regulated industries, is provenance engineering. The word was older than the discipline; the discipline is younger than the work; the work has, until this week, been unnamed.',
          'Names matter for the same reason datelines matter. A discipline without a name has no curriculum, no JD, no conference, no certification, no canonical reading list. A discipline with a name has all of those, eventually. The cost of leaving the work unnamed is that the work compounds slower — because the people who could be doing the work alongside you do not yet know what to call themselves. The cost of naming the work too early is that the name might not stick. We are choosing the second cost, because the first cost has now been paid for a year, and is paid by everyone in the field at once.',
        ],
      },
      {
        n: '02',
        title: 'The structural rule.',
        titleJp: '構造の規則',
        body: [
          'There is one rule that organises every other decision in this discipline. The rule is: the AI never produces the source-of-truth number. Deterministic engines produce numbers. The AI orchestrates the requests and interprets the results. Humans approve at the material gates. The rule is not a recommendation; it is the structural separation that makes everything downstream possible — the audit log that can be replayed, the regulator portal that can be exported to, the incident report that can identify what went wrong, the certification that can survive a court.',
          'The rule sounds obvious once it is named. It is not, in 2026, how most AI products are built. Most products let the model produce the number; the audit trail records what the model said; and when the regulator asks for proof, the answer is a transcript of the model\'s output, which is not proof. The discipline that calls itself provenance engineering refuses that shape. The number comes from a function whose inputs are recorded, whose version is pinned, whose result is hashable, and whose run is replayable. Everything else — the prose, the recommendation, the explanation, the alert — is interpretation. The interpretation is helpful; the interpretation is not the number.',
        ],
      },
      {
        n: '03',
        title: 'Six disciplines, one vocabulary.',
        titleJp: '六つの分野、一つの語彙',
        body: [
          'A provenance engineer is fluent in six normally-separate engineering disciplines at once. Quantitative finance, enough to know what not to compute in the AI layer. Distributed systems, enough to design an append-only log and reason about consensus. Cryptography, enough to choose hash functions and signature schemes. Numerical analysis, enough to know what IEEE 754 does and does not guarantee. Regulatory literacy, enough to read EU AI Act Annex IV alongside counsel and produce code that satisfies both the prose and the spirit. AI engineering, enough to wire all of the above into an MCP server an agent can call.',
          'Most engineers have two of the six. Some have three. Almost no team in 2026 has four. The unusual completeness of the overlap is the moat of this discipline — and the bottleneck of its hiring. The role JD published alongside this issue (`HIRING.md`, in the kbot-finance package) names this explicitly: the requirement is depth in three of the six, with demonstrated ability to ramp into the others. The certification that will eventually exist will test all six. The certification does not exist yet. The work that will define it is the work the next year produces.',
        ],
      },
      {
        n: '04',
        title: 'Ship the substrate, not the strategy.',
        titleJp: '基盤を出す',
        body: [
          'The discipline produces artifacts before it produces theory. The first artifact of provenance engineering as a public field is the kbot-finance package — published to npm under Apache 2.0, public on GitHub, running against live Polymarket markets and SEC EDGAR filings, integrated into the kbot terminal agent. The package is small (about two hundred kilobytes, fewer than two thousand lines of TypeScript) and the package is real. The strategy is downstream of the artifact, not upstream of it. The substrate exists, and the rest of the field is now negotiating with that existence.',
          'A discipline that produces strategy first produces consultants. A discipline that produces substrate first produces standards. The choice between the two is a choice between selling certainty and selling code. We are choosing code. The substrate carries the argument the strategy can only hint at — that this shape works, that this shape ships, that this shape is installable today. Pasting `npm install @kernel.chat/kbot-finance` into a Shell is more persuasive than a forty-slide deck, and the deck is welcome to follow.',
        ],
      },
      {
        n: '05',
        title: 'The window.',
        titleJp: '窓',
        body: [
          'Bloomberg shipped the architectural pattern this discipline rests on — the agent emits a query, the engine produces the number, the result is reproducible inside the terminal — in February 2026, inside the closed Terminal product they call ASKB. The European Union\'s AI Act high-risk obligations take effect in August 2026, possibly deferred to December 2027. The Federal Reserve replaced the long-standing model-risk guidance (SR 11-7) with a more agentic-aware version (SR 26-02) in April 2026. The first nine-figure enforcement action against an AI-driven trading failure lands somewhere between H2 2026 and H1 2027 — the magazine cannot say which case, but the base rate of regulated trading failures plus the new visibility of AI as a load-bearing layer makes the event the kind of thing one bets on rather than waits for.',
          'The window between Bloomberg validating the pattern and regulators codifying it is twelve to eighteen months. Inside that window, the spec is up for grabs — whichever implementation ships first, in the open, becomes the reference. After the window closes, the spec freezes around whoever was there. We are early on purpose. The window is the structural reason this issue is being filed in May 2026 and not later. The discipline that wants to define what good provenance looks like has roughly six hundred days to make the case before the case is made for it.',
        ],
      },
      {
        n: '06',
        title: 'The editorial throughline.',
        titleJp: '編集の通り線',
        body: [
          'The magazine and the substrate are now one operation. Every issue from 381 forward sits adjacent to provenance engineering as the discipline the work is in, even when the issue is about something else — three idioms of agent input, the shape of a real magazine, the design language of a small publication. The substrate is the body of work the writing reports on; the writing is the documentation the substrate would not, on its own, produce. Neither is the other; both are necessary. Five years of issues will, by 2031, constitute the readable history of how this discipline came to be named, hired into, regulated, standardised, and (in the lucky case) widely deployed.',
          'The editorial discipline is the constraint that keeps the substrate honest. A package shipped without an issue beside it is a package the field has no narrative for. A narrative without a package beside it is consultancy. The magazine and the npm registry are two halves of the same shape — one publishes the artifact, one publishes the recognition. We are committing, in this issue, to keeping both halves in motion for the next five years and not to letting either one lap the other. The artifact informs the writing; the writing forces the artifact to be the thing the writing claims it is.',
        ],
      },
      {
        n: '07',
        title: 'The bet does not know it is a bet yet.',
        titleJp: '賭けはまだ自分が賭けと知らない',
        body: [
          'The bet is named here. The bet is not yet won, lost, or even resolved enough to bet against. Five years is a long time. In five years, provenance engineering is either a recognised discipline with conferences and certifications and JDs that use the term, or it is a phrase one magazine used for a while in 2026 before the field settled on something else. In five years, kbot-finance is either the reference implementation of an MCP audit-extension that has ratified, or it is an archived repo at version 0.7 that nobody updated after the company that did adopt the pattern got acquired and closed it. In five years, the seven stakes filed in this issue are either the framing the field reads back to itself, or they are an interesting artefact a researcher finds when writing the history of a field that ended up being named something else.',
          'We do not yet know which set is which. The next year is the year that decides most of the resolution. The bet, like most bets worth making, looks larger from inside the year it is being placed than it will look from outside the decade it landed in. We will know which set we picked by the time issue 442 is on the press. Until then: the work continues, the writing continues, the substrate ships, the magazine reports, and the verb on the seal is honest about what just happened. We declared a bet. The next year does not get to redraft it.',
          '街のコーダーたちへ — 五年は長い。仕事は続く。',
        ],
      },
    ],

    outro: 'A discipline that produces strategy first produces consultants. A discipline that produces substrate first produces standards. We are choosing code. The name is older than the discipline; the discipline is younger than the work; the work, at last, is named.',

    signoff: '街のコーダーたちへ — 五年は長い。仕事は続く。',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'in-house',
    copy: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}

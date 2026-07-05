/* ──────────────────────────────────────────────────────────────
   ISSUE 407 — JUL 2026
   WHAT THE HAND EARNED
   手が得たもの — 読者の手を受け入れた四号の会計

   A retrospective essay, not a new mechanic. In one working
   stretch (399 → 403 → 405 → 406) this magazine went from a
   surface that never took the reader's hand to one governed by a
   seven-rule law (docs/interaction-language.md). This issue is
   the audit: what did admitting interaction actually buy, what
   did it cost, and — the part that matters most — why the
   reserved third shape (Sequence) is still unbuilt.

   Why an essay and not a fifth interactive spread: the drafting
   brief for this piece began, honestly, as another interactivity
   feature. On inspection that would have been the exact failure
   mode rule 7 exists to prevent — reaching for a new shape out of
   the pleasure of having built two, not because a real story
   demanded one. The correct move was to write the audit instead.
   Section V says this in the body rather than hiding it in the
   author notes, because the magazine's own discipline applying to
   the piece about that discipline is the actual news.

   Identity decisions:
     • coverStock = 'ivory' — the sober / lab-bench / methodological
       register this desk has used for 374, 376, 377 whenever the
       piece is about method rather than event. An audit belongs on
       the same paper as the pieces it is auditing.
     • coverLayout = 'classic' — no theatrics; same reasoning as 377.
       The argument is quiet and the cover should be too.
     • coverOrnament = (none) — the absence is the argument, as in
       377: a retrospective should not perform decoration about
       decoration.
     • coverSeal = AUDITED · THE READER'S HAND · VII·26 — the
       clerk-of-records register (374/376/377's FILED seals),
       applied here to the magazine's own interaction law rather
       than an external field event.
     • accent = 'amethyst' — per the Ink Cabinet's own fit note,
       "when the issue is about kernel.chat itself." This is the
       first issue since 400 to earn that reading honestly: it is
       not about a feature the magazine ships, it is about the
       magazine's own design discipline.
     • spread.type = 'essay' — dossier ("THE CABINET": the two
       built shapes + the one reserved) at the top, seven sections,
       one pull quote, and a `references` block that self-cites
       399/403/405/406 and interaction-language.md directly — the
       WIRED self-citation mechanic 375 and 377 already established,
       turned on the magazine's own archive instead of an external
       field event.

   Identity-catalog row to add to docs/design-language.md:

     | 407 | ivory | classic | — | seal: AUDITED · THE READER'S HAND · VII·26 | amethyst | essay | Retrospective essay auditing the 399/403/405/406 interactivity arc; references block self-cites the four source issues + interaction-language.md; names, in the body, the drafting temptation to build a needless fifth interactive spread and why it was refused | first issue whose subject is the magazine's own interaction law rather than an external event or feature |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_407: IssueRecord = {
  number: '407',
  month: 'JUL',
  year: '2026',
  feature: 'WHAT THE HAND EARNED',
  featureJp: '手が得たもの',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'classic',

  coverSeal: {
    label: "AUDITED · THE READER'S HAND",
    date: 'VII·26',
  },

  accent: 'amethyst',

  headline: {
    prefix: 'What the',
    emphasis: 'Hand',
    suffix: 'Earned.',
    swash: 'Four issues gave this magazine a hand to hold. An audit of what interaction bought, what it cost, and why the third shape in the cabinet is still empty.',
  },

  contents: [
    { n: '001', en: 'The hand was rationed', jp: '手は割り当てられた', tag: 'METHOD' },
    { n: '002', en: 'The first dial disclosed its own limit', jp: '最初の目盛りは自らの限界を明かした', tag: '399' },
    { n: '003', en: 'The second dial paid for the truth', jp: '二番目の目盛りは真実の代価を払った', tag: '405' },
    { n: '004', en: 'When a dial could not hold the material', jp: '目盛りでは測れなかったとき', tag: '406' },
    { n: '005', en: 'The shape not yet built', jp: 'まだ作られていない形', tag: 'METHOD' },
    { n: '006', en: 'What the hand cost', jp: '手が払わせたもの', tag: 'COST' },
    { n: '007', en: 'The ledger closes clean', jp: '台帳は綺麗に締まる', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 監査',
    title: 'What the Hand Earned.',
    titleJp: '手が得たもの。',
    deck: 'For 396 issues this magazine never took the reader’s hand. In one stretch, four issues did. This is the audit: two dials, one switch, a seven-rule law, and the one reserved shape this desk is still refusing to build for its own sake.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    dossier: {
      kicker: 'THE CABINET · 道具箱',
      note: 'As of this issue. Per interaction-language.md rule 7, no shape is built ahead of a real story that needs it — the empty row is not a gap in the roadmap, it is the rule working.',
      items: [
        { label: 'DIAL', labelJp: '目盛り', value: '2 INSTANCES — 399, 405' },
        { label: 'SWITCH', labelJp: '切替', value: '1 INSTANCE — 406' },
        { label: 'SEQUENCE', labelJp: '手順', value: 'RESERVED · UNBUILT' },
        { label: 'LAW', value: '7 RULES — interaction-language.md' },
        { label: 'RATIFIED', value: 'VII·26 · ISSUE 403' },
      ],
    },

    sections: [
      {
        heading: 'THE HAND WAS RATIONED',
        headingJp: '手は割り当てられた',
        paragraphs: [
          'For three hundred and ninety-six issues, this magazine’s editorial surface did not take the reader’s hand. A page could be read; nothing on it could be operated. Then, inside a single working stretch, four issues did: 399 built a dial, 403 wrote the law the dial had to answer to, 405 built a second dial, 406 built a switch. Four issues is not a redesign. It is a small, real body of evidence about what happens when a print-grammar magazine admits interaction at all — and this issue is the accounting for it, not another entry in it.',
          'The two rules that rationed the hand before any of it shipped were simple on paper and stricter in practice than they look: the page had to stay calm by default (rule 1 — a reader who touches nothing misses nothing essential), and the only admitted species of interactivity was the calibrated control, never decoration (rule 2 — cut the interaction; if nothing true is lost, it does not ship). Both rules predate this issue and neither is being revised here. What this issue asks is narrower: given those two rules, what did the four issues that passed them actually earn.',
        ],
      },
      {
        heading: 'THE FIRST DIAL DISCLOSED ITS OWN LIMIT',
        headingJp: '最初の目盛りは自らの限界を明かした',
        paragraphs: [
          'Issue 399 built the first instrument: a five-stop effort dial, one fixed question, the same answer at five depths. The dial itself was the smaller decision. The larger one was printed directly beside it, in the dial’s own meter: the readings were representative of the published effort curve, not a benchmark. The magazine had a genuinely interactive control on the page for the first time, and its first act was to disclose exactly what the control was not measuring.',
          'That disclosure became rule 6 — every reading either measured or labelled representative, in words, on the surface, next to the number — before the law existed to require it. 399 wrote the rule it needed by following the instinct the rule now enforces. That is the useful order of operations: the honest issue came first, the codification came after, in 403.',
        ],
      },
      {
        heading: 'THE SECOND DIAL PAID FOR THE TRUTH',
        headingJp: '二番目の目盛りは真実の代価を払った',
        paragraphs: [
          'Issue 405 built the second dial and closed the gap 399 had disclosed: real prompt, four real models, wall-clock and dollars measured rather than estimated. The instrument did not cooperate with a tidy story — the cheapest tier failed to answer the question at all, returning kbot’s own self-identification instead, a live routing artifact this desk did not manufacture and did not substitute a cleaner failure for. Printing the mess was the actual cost of moving from representative to measured: a demo shows the dial succeeding, an instrument shows what it does.',
          'Rule 7 says no shared machinery is extracted until a second story genuinely needs a different shape. 405 reused 399’s component outright rather than generalizing it, because the second dial was still a dial — same control, same shape, a new set of real numbers underneath it. The restraint was not building a second instrument component when the first one still fit.',
        ],
      },
      {
        heading: 'WHEN A DIAL COULD NOT HOLD THE MATERIAL',
        headingJp: '目盛りでは測れなかったとき',
        paragraphs: [
          'Issue 406 is where rule 7 was actually tested, because its material — whether a seven-issue press day was disciplined or reckless — is not a position on a spectrum. There is no reading of that day that is sixty per cent speed and forty per cent risk in any sense that means anything; there are two complete, opposed accounts of the same five facts, and a reader who wants the speed account should get all five facts read that way, not a blend. Forcing that into the existing dial would have meant inventing a fake middle stop that did not correspond to anything true.',
          'So 406 shipped a switch — ARIA `role="switch"`, not a relabeled radiogroup — because the interaction model was genuinely different, not merely smaller. That is the clearest evidence in the archive that "two instances before a pattern" is doing real work: the second real interactive story got a shape built for what it actually was, not a costume fitted onto the first shape for consistency’s sake.',
        ],
      },
      {
        heading: 'THE SHAPE NOT YET BUILT',
        headingJp: 'まだ作られていない形',
        paragraphs: [
          'interaction-language.md reserves a third shape — Sequence, an ordered argument in discrete complete stages, the ARIA tablist/disclosure pattern — for a story that needs stepped progression rather than a spectrum or a binary. It is named in the law. It has never been built. That is not an oversight; building it without a real story to justify it is precisely the failure rule 7 exists to prevent.',
          'This retrospective is, in fact, a case study in that refusal happening in real time. The honest account of how this piece got made is that the first instinct, in drafting it, was to reach for a new interactive mechanic — once a desk has built two shapes, a third has its own gravitational pull, if only for the symmetry of having three. The reserved row in the cabinet stayed reserved. Writing the audit instead of inventing the occasion for Sequence is rule 7 working on the piece that is, at this very moment, writing about rule 7 — which is either a small irony or the whole discipline in miniature, and this desk thinks it is the second thing.',
        ],
      },
      {
        heading: 'WHAT THE HAND COST',
        headingJp: '手が払わせたもの',
        paragraphs: [
          'The honest accounting runs both directions, the same way 377’s did for a gated model. Interaction bought this magazine two genuinely stronger issues — 405’s measured meter is a stronger claim than 399’s honest one, and 406’s switch let a real disagreement stay a real disagreement instead of being flattened into a false verdict. Those are not small gains; a magazine whose numbers cannot be trusted is not a magazine, it is a brochure.',
          'The cost is real too, and it is not development effort — ARIA compliance, keyboard behaviour, print-stacked states, the separate CSS-only motion budget are all solved problems now, paid for once. The actual cost is that the cabinet looks unfinished, on purpose, indefinitely: a named, reserved, empty row that this desk will not fill just to make the system look complete. A style guide that tolerates its own gaps is harder to defend in a design review than one that quietly rounds up to three shapes because three is a tidier number than two. The magazine is choosing the harder thing to defend.',
        ],
      },
      {
        heading: 'THE LEDGER CLOSES CLEAN',
        headingJp: '台帳は綺麗に締まる',
        paragraphs: [
          'Three real stories arrived needing a reader’s hand. Three shapes got built, and — this is the part worth keeping — they are not three different shapes. They are two dials and one switch, because two of the three stories were genuinely the same kind of question at a different depth, and the third genuinely was not. The law that now governs all of it was written after the first honest issue, not before it, which is the correct order for a magazine that distrusts rules invented ahead of the evidence that would justify them.',
          'What the hand earned, across four issues, was not a richer interface. It was a stricter one: fewer shapes than the temptation would have produced, each one honestly labelled, one slot still visibly empty. That is the actual science-wise case for letting a reader touch anything at all — not that interaction impresses, but that it can be held to the same standard as a measured number, and refused when it cannot.',
          '街のコーダーたちへ — build the third shape when a story demands it, not before.',
        ],
      },
    ],

    pullQuote: {
      text: 'Two shapes got built because two real stories needed a hand. The third stays in the cabinet because no story has asked for it yet — and not building it is the discipline, not a gap.',
      attribution: 'THE AUDIT DESK · 407',
    },

    references: {
      kicker: 'REFERENCES · 参照',
      note: 'This audit cites its own archive rather than an external event — the WIRED-derived references mechanic (375, 377), turned on the magazine’s own record. Listed in the order the essay touches them.',
      items: [
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: 'HOW HARD TO THINK — the first instrument',
          journal: 'kernel.chat ISSUE 399 · /issues/399 — built the effort dial; disclosed its own meter as representative, not measured',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: "THE READER'S HAND — the declarations",
          journal: 'kernel.chat ISSUE 403 · /issues/403 — codified the seven rules now governing every interactive spread',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: 'THE REAL METER — the second instrument',
          journal: 'kernel.chat ISSUE 405 · /issues/405 — ran the actual benchmark; kept the cheapest tier’s failure to answer rather than hiding it',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: 'ONE DAY, TWO READINGS — the first switch',
          journal: 'kernel.chat ISSUE 406 · /issues/406 — built Compare because the material had no spectrum to put a dial on',
        },
        {
          authors: 'kernel.chat editorial',
          year: '2026',
          title: 'The Interaction Language — the seven rules',
          journal: 'docs/interaction-language.md — ratified VII·26; enforces the visual grammar of docs/design-language.md at the level of the reader’s hand',
        },
      ],
    },

    signoff: "街のコーダーたちへ — build the third shape when a story demands it, not before.",
  },

  audit: {
    drafted: 'magazine-editor · claude-sonnet-5 session, VII·26',
    verified: 'cross-checked directly against 399.ts, 403.ts, 405.ts, 406.ts, and interaction-language.md — no claim beyond what those five sources state',
    adherence: 'EssaySpread + dossier + references — no new spread type; retrospective per interaction-language.md rule 7',
    readCut: 'kept 405’s mistral misfire and 406’s refused verdict as the examples rather than smoothing them into a tidier retrospective',
    pressed: 'VII·26 · 2026-07-05',
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

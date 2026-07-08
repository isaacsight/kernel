/* ──────────────────────────────────────────────────────────────
   ISSUE 415 — JUL 2026
   STOP PRESS
   終わりの合図 — best-effort gloss ("signal of the end"); confirm
   with a native speaker before this ships publicly.

   The seventh interaction primitive — close — and the first shape
   built as a demonstration rather than an offer. Every prior primitive
   handed the reader a control to operate for its own sake. This one
   exposes something withheld: real feeds remove the moment where the
   interface could tell you to stop, because every extra minute is
   more inventory sold. This issue puts the stop back, at equal weight
   to "keep going," from the first item to the fortieth.

   The design argument:

   • Why a new shape (rule 7): none of the six prior primitives
     (dial, switch, rail, knife, margin, press) keep score against
     the reader — no streak breaks, no number climbs while they're
     away. This issue makes that absence a demonstration instead of
     an assertion.

   • The law: "Show me one more" and "I'll stop here" share ONE CSS
     class, at every item count, enforced in CloseFeature.tsx (not
     just claimed in copy) and covered by a regression test.

   • Rule 6, extended: the live counter (items + elapsed time) is a
     real, live count of what happened in this session — the number
     every real feed keeps and never shows you. Nothing is stored or
     sent; reload erases it completely.

   • Sourced, not invented: the outro cites Reuters Graphics' open-
     source component library (BeforeAfter, SimpleTimeline, etc.,
     reused named primitives rather than bespoke code per story) and
     The Pudding's "does this earn its place" test — both verified
     via this magazine's own interaction-engineering research, 2026-07-08.

   Identity decisions:
     • coverStock = 'ink' — archival/manifesto/nocturnal register,
       same stock 371 used for its own dark dispatch.
     • coverLayout = 'monument-hero' — the issue number IS the cover
       art; rhymes with the piece's own live-incrementing counter,
       now fixed and monumental.
     • coverOrnament = 'full-stop' (new) — a single heavy period,
       bleeding off the bottom edge.
     • accent = 'oxblood' — its documented fit note is literally
       "endings."
     • spread.type = 'close', spread.stock = 'ink' (kept consistent
       with the cover rather than lightened for the body).

   Identity-catalog row to add to docs/design-language.md:

     | 415 | ink | monument-hero | full-stop | — | oxblood | close (new) | Seventh interaction primitive — Close: a feed with no natural end, until the reader gives it one; "show me one more" and "I'll stop here" render at identical weight from item one (the law, enforced structurally); live item/time readout; soft cap is part of the argument, not a hidden limit; print always renders the outcome, never the live controls | `close` spread type; fourteenth editorial tool; demonstrates the removed-stopping-cue mechanic kernel.chat's other six primitives never use |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_415: IssueRecord = {
  number: '415',
  month: 'JUL',
  year: '2026',
  feature: 'STOP PRESS',
  featureJp: '終わりの合図',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ink',
  coverLayout: 'monument-hero',
  coverOrnament: 'full-stop',

  accent: 'oxblood',

  headline: {
    prefix: 'Stop',
    emphasis: 'Press',
    suffix: '.',
    swash: 'Every feed you have used removed the moment it could tell you to stop. This one gives it back — a stop at equal weight to "more," from the first item to the last.',
  },

  contents: [
    { n: '001', en: 'The stop that was never offered', jp: '差し出されなかった終わり', tag: 'THESIS' },
    { n: '002', en: 'Seven ways to keep you scrolling', jp: '引き止める七つの仕掛け', tag: 'DOSSIER' },
    { n: '003', en: 'The instrument', jp: '道具', tag: 'CLOSE' },
    { n: '004', en: 'A number every feed keeps', jp: 'フィードが記録する数字', tag: 'RECEIPT' },
    { n: '005', en: 'The oldest trick is an ending', jp: '終わりという最古の仕掛け', tag: 'OUTRO' },
  ],

  spread: {
    type: 'close',
    kicker: 'STOP PRESS · 終わりの合図',
    title: 'Stop Press.',
    titleJp: '終わりの合図。',
    deck: 'Every feed you have ever used removed one thing on purpose: the point where it tells you to stop. Below is a small, honest simulation of one. Press either button. The receipt tells you what happened.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ink',

    dossier: {
      kicker: 'SEVEN WAYS TO KEEP YOU SCROLLING · 七つの仕掛け',
      note: 'Named honestly, no jargon — the mechanisms this issue does not use, anywhere, by design.',
      items: [
        { label: 'VARIABLE-RATIO REWARD', value: 'UNPREDICTABLE TIMING ON LIKES AND REPLIES — A SLOT MACHINE\'S SCHEDULE' },
        { label: 'REMOVED STOPPING CUES', value: 'INFINITE SCROLL DELETES THE "END OF PAGE" SIGNAL' },
        { label: 'SOCIAL VALIDATION LOOPS', value: 'OTHER PEOPLE\'S ATTENTION, QUANTIFIED AND REPEATABLE' },
        { label: 'ENGAGEMENT-RANKED FEEDS', value: 'SORTED BY WHAT EXTENDS A SESSION, NOT WHAT\'S TRUE OR RECENT' },
        { label: 'STREAKS / LOSS AVERSION', value: 'PUNISHES STOPPING INSTEAD OF REWARDING CONTINUING' },
        { label: 'NOTIFICATION BADGES', value: 'A REMINDER THAT DOESN\'T REQUIRE DECIDING TO RETURN' },
        { label: 'NETWORK-EFFECT OBLIGATION', value: 'TAGS AND RECEIPTS TURN CHECKING IN INTO A SOCIAL DEBT' },
      ],
    },

    intro: [
      {
        heading: 'The stop that was never offered',
        headingJp: '差し出されなかった終わり',
        paragraphs: [
          'Every feed you have ever used removed one thing on purpose. Not a stopping point exactly — some technical version of a stopping point has always existed, buried in a settings menu or a battery indicator. What was removed was the invitation: the moment where the interface itself says the reading is done, you have what you came for, close it. Real feeds do not say that. They cannot, structurally — every additional minute is more inventory sold, and an interface that thanks you for leaving has decided against its own business model.',
          'This magazine has spent six issues handing readers a shape to operate — a dial, a switch, a rail of stages, a proofreader\'s knife, a written margin, the press itself. All six share a quiet property: none of them keep score against you. No streak breaks if you skip a day. No number climbs while you are gone. This issue makes that absence a demonstration instead of an assertion. Below is a small, honest simulation of a feed. Ask it for one more item and it will oblige, forever, the same six flat sentences on rotation — the point is not to entertain you. The point is that the button offering to stop sits next to the button offering to continue, exactly the same size, from the first item to the fortieth. Press either one. The receipt tells you which.',
        ],
      },
    ],

    closeKicker: 'THE INSTRUMENT · 装置',

    filler: [
      'A photograph of a stranger\'s dinner.',
      'A headline written to make you feel something before you\'ve read it.',
      'An update from someone you forgot you followed.',
      'A video that started before you decided to watch it.',
      'A number telling you how many people liked something you haven\'t read yet.',
      'One more thing, and then one more thing after that.',
    ],

    cap: 40,

    closeNote: 'Nothing above is measured, stored, or sent anywhere. Reload and it forgets you completely. This is the number every feed keeps and never shows you — and the stop you were never offered a reason to take.',

    outro: [
      {
        heading: 'The oldest trick is an ending',
        headingJp: '終わりという最古の仕掛け',
        paragraphs: [
          'kernel.chat is issue 415 of a thing that is numbered, dated, and ends. That is not a boast; it is a structural difference with a feed, not a stylistic one. Reuters Graphics — the wire service\'s interactive desk — ships its own interaction vocabulary as an actual open-source component library: named, reusable pieces such as BeforeAfter and SimpleTimeline, built once and reused deliberately rather than authored bespoke per story. The Pudding holds itself to a stricter test before adding any motion or interaction at all: does this depict a real change over time, a real spatial relationship — does it earn its place — or is it decoration doing a job prose could do for free.',
          'Neither of those outlets required inventing new psychology to reach that discipline, and neither did this one. The oldest trick in this issue\'s own toolkit — the stopping cue — predates feeds by centuries. A book\'s last page. A newspaper\'s "— 30 —." An edition, closed. Feeds are not a new form; they are an old form with the ending edited out. This one puts it back.',
        ],
      },
    ],

    pullQuote: {
      text: 'The stop was never technically difficult to build. It was withheld.',
      attribution: 'THE CLOSE DESK · 415',
    },

    signoff: 'Either way, the page tells you what happened.',
  },

  audit: {
    drafted: 'magazine-editor · claude-sonnet-5 session, VII·26',
    verified: 'Reuters Graphics component library and The Pudding methodology kept to sourced claims from this magazine\'s own interaction-engineering research (multi-source verified, 2026-07-08); no storage or network path exists for CloseFeature.tsx state — session React state only',
    adherence: 'CloseSpread — new type, seventh primitive, fourteenth tool; the law (equal button weight at every item count) enforced structurally, not just in copy, and covered by a regression test',
    readCut: 'no fabricated meter readings — the item/time readout is a real, live count of what happened in this session, same discipline as ISSUE 399',
    pressed: 'VII·26 · 2026-07-08',
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

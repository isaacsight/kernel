/* ──────────────────────────────────────────────────────────────
   ISSUE 413 — JUL 2026
   THE READER'S PRESS
   読者の印刷機 — 道具一式、そのまま渡す

   The composing rung — the sixth interaction shape, and the first
   ARTIFACT control. The ladder so far: the reader watched
   (essays), chose (dial 399, switch 406), walked (sequence 408),
   cut (galley 410), learned (tutor 411), wrote (margin 412). The
   rung above writing is composing: this issue hands over the
   press. The reader operates the magazine's REAL production
   grammar — the actual stock cabinet, the actual Ink Cabinet
   seeds, the actual cover layouts, a headline lockup and seal in
   their own words — and a cover assembles live under their hands.
   Print it, and the artifact leaves with them: their first issue,
   numbered 001 by default because everyone's first press run is.

   The design argument (the review this header is):

   • Why a new shape (rule 7): every prior control produced a
     READING — an understanding of something. The press produces a
     THING: a composed, printable cover that did not exist before
     the reader's hands. Selection and contribution composing
     toward an artifact is a genuinely new interaction model.
     Sixth shape: Press.

   • The law travels with the instruments — the deepest design
     decision here, and the issue's actual thesis. The choice sets
     ARE the system constants: six real stocks, the eleven
     POPEYE-safe seeds (isPopeyeSafe() ran when the cabinet was
     curated; the reader inherits the curation), the three main
     layouts, one spot color per cover by construction, two
     typefaces because the preview only has two. The reader cannot
     compose an off-grammar cover — not because a validator slaps
     their hand, but because the press they were handed is the
     real one, constraints included. Freedom inside the grammar is
     the whole aesthetic education the run has to offer: the
     constraints are not the fence around the press; they are the
     press.

   • Rule 1: untouched, the page shows a complete, already-composed
     default cover (THE FIRST ONE / 001) and reads as a full essay
     on handing over production. The instruments deepen; nothing
     is gated.

   • Rule 5: three roving radiogroups (stock / ink / layout — the
     dial's own keyboard grammar) + five labelled text inputs.
     All established patterns.

   • Rule 6, both directions: the colophon line states the reader's
     current composition (stock · seed · layout) — a description
     of their own choices, nothing else. No aesthetics score, no
     "great choice!", no grade (411's ethic holds at the press).
     Composition is session state: nothing recorded, nothing sent,
     reload resets to the house default, and the page says so and
     names the remedy — print it; the cover is yours on paper.

   • The seal field may be left empty — declining to stamp is a
     legitimate composition (373's under-decorated cover is the
     precedent, and the field says EMPTY = NONE).

   Identity decisions:
     • coverStock = 'ledger' — the production office's paper; the
       issue about the press belongs on the accountant's stock
       (372/404 register). Also unused this whole run.
     • coverLayout = 'classic' — the operable part lives inside.
     • coverSeal = HANDED OVER · PRINT YOUR OWN — the transfer as
       the stamp. Completes the seal arc: 409 disclosed what we
       kept, 410 what we refused to keep, 411 what we refused to
       measure, 412 what we gave away, 413 what we handed over.
     • accent = 'amethyst' — press's shape default, and the
       "about kernel.chat itself" seed: an issue about the
       magazine's own press is the definitional case.
     • spread.type = 'press', spread.stock = 'ledger'.

   Identity-catalog row to add to docs/design-language.md:

     | 413 | ledger | classic | — | seal: HANDED OVER · PRINT YOUR OWN · VII·26 | amethyst | press (new) | Sixth interaction shape — Press: the first artifact control; the reader operates the real production grammar (six stocks, eleven POPEYE-safe seeds, three layouts, their own headline/seal/number) and a cover assembles live; the law travels with the instruments — off-grammar covers are impossible by construction, not validation; colophon states the composition and grades nothing; session-only, print to keep | `press` spread type; thirteenth editorial tool; the composing rung — the reader's first issue, numbered 001 |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_413: IssueRecord = {
  number: '413',
  month: 'JUL',
  year: '2026',
  feature: "THE READER'S PRESS",
  featureJp: '読者の印刷機',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ledger',
  coverLayout: 'classic',

  coverSeal: {
    label: 'HANDED OVER · PRINT YOUR OWN',
    date: 'VII·26',
  },

  accent: 'amethyst',

  headline: {
    prefix: 'The',
    emphasis: "Reader's",
    suffix: 'Press.',
    swash: 'Six stocks, eleven inks, three layouts, your headline, your seal, your number. The real instruments, constraints included — compose a cover and print your first issue.',
  },

  contents: [
    { n: '001', en: 'The last handover', jp: '最後の受け渡し', tag: 'METHOD' },
    { n: '002', en: 'The instruments are the law', jp: '道具こそが法', tag: 'THESIS' },
    { n: '003', en: 'Your cover, live', jp: 'あなたの表紙', tag: 'THE PRESS' },
    { n: '004', en: 'What the colophon says', jp: '奥付が語ること', tag: 'HONESTY' },
    { n: '005', en: 'Print your first issue', jp: '第一号を刷る', tag: 'CLOSING' },
  ],

  spread: {
    type: 'press',
    kicker: 'THE PRESS · 印刷機',
    title: "The Reader's Press.",
    titleJp: '読者の印刷機。',
    deck: 'The run handed you a dial, a switch, a sequence, a knife, a manual, and a margin. One instrument was left in the back room: the press itself. Here it is — the real stock cabinet, the real ink seeds, the real layouts, and a cover that assembles under your hands. Compose your first issue. Print it. It leaves with you.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ledger',

    dossier: {
      kicker: 'THE APPARATUS · 装置',
      note: 'The instruments below are the production system, not a toy of it: the six paper stocks every issue chooses from, the eleven ink seeds the cabinet has verified as grammar-safe, the three principal cover layouts. What you cannot do here, the magazine cannot do either. That symmetry is the point.',
      items: [
        { label: 'STOCKS', value: '6 · THE REAL CABINET — CREAM TO LEDGER' },
        { label: 'INKS', value: '11 SEEDS · ALL GRAMMAR-SAFE BY CURATION' },
        { label: 'LAYOUTS', value: '3 · CLASSIC · MONUMENT · ASYMMETRIC' },
        { label: 'YOUR WORDS', value: 'HEADLINE · SEAL · NUMBER — WRITTEN, NOT PICKED' },
        { label: 'KEPT BY US', value: 'NOTHING · SESSION-ONLY · PRINT TO KEEP' },
      ],
    },

    intro: [
      {
        heading: 'The last handover',
        headingJp: '最後の受け渡し',
        paragraphs: [
          'Follow the run of interactive issues in order and a ladder appears: you watched, then chose, then walked a process, then cut a galley, then learned the grammar, then wrote in the margin. Each issue moved one of the author’s powers across the desk. Only one power was left in the back room — the one every publication guards last and hardest. Composition. The instruments themselves. The press.',
          'This issue hands it over, and does it the only way this house knows how: for real. The stock selector below is the actual stock cabinet — the same six papers every issue in the archive chose from. The ink row is the actual Ink Cabinet, all eleven seeds. The layouts are the covers you have been looking at for four hundred issues. Nothing was simplified for your protection, because nothing needed to be. The press was always going to be handed over; the only question was whether the grammar would survive the handover. Read the second section for why it does — then stop reading and compose.',
        ],
      },
      {
        heading: 'The instruments are the law',
        headingJp: '道具こそが法',
        paragraphs: [
          'Notice what you cannot do below. You cannot pick a neon; the cabinet was curated once, by a validator with a name, and every seed in it passed. You cannot add a third typeface; the press only owns two. You cannot put two spot colors on one cover; the instrument takes one ink at a time. None of this is a fence around your freedom — it is the same press this magazine operates under, handed over whole. A constraint you inherit with the tools is not a rule you obey; it is a material you work in, the way a letterpress printer works in lead and a photographer works in light. The freedom this page offers is the only kind the house believes in: freedom inside the grammar. The constraints are not the fence around the press. They are the press.',
        ],
      },
    ],

    pressKicker: 'THE INSTRUMENTS · COMPOSE YOUR COVER · 組んでください',

    defaults: {
      stock: 'cream',
      accent: 'tomato',
      layout: 'classic',
      prefix: 'The',
      emphasis: 'First',
      suffix: 'One.',
      seal: 'MY FIRST COVER',
      number: '001',
    },

    pressNote: 'The colophon line above states your current composition — stock, ink, layout — and nothing else. It does not grade your choices; there is no such thing as getting a cover wrong inside the grammar, only covers you would or would not stand behind. Your composition is held in this page’s memory for this visit only: nothing is recorded, nothing is sent, and reloading resets the press to the house default. To keep what you made, print this page — the instruments stay here; the cover leaves with you.',

    outro: [
      {
        heading: 'What the colophon says',
        headingJp: '奥付が語ること',
        paragraphs: [
          'Every issue of this magazine ends in a colophon — the production receipt, staged as the showpiece. Yours is one line: the stock, the ink, the layout you chose. What it deliberately does not say is whether your cover is good. The press at 411 refused to grade a keystroke; the press at 413 refuses to grade taste, which is the same refusal at higher stakes. An instrument that scored your composition would be teaching you to compose for the score — and the entire point of handing over a press is that the judgment comes with it or it was never handed over at all. You decide whether your cover holds. That is not the page’s modesty; it is the transfer, completed.',
        ],
      },
      {
        heading: 'Print your first issue',
        headingJp: '第一号を刷る',
        paragraphs: [
          'The ladder is now fully climbed. Watching, choosing, walking, cutting, learning, writing, and — as of whatever is on the press above — composing. What remains on the magazine’s side of the desk is the one thing that was never transferable: the refusals, the taste, the editorial no. Those cannot be handed over because they are not instruments; they are the residue of every cut the house ever made. But everything mechanical about making an issue is now in your hands, and the instruction that closes the run is the same one that closed the margin, one rung up: what you made here is yours, the page will not remember it, so take it with you. Print your first issue. Number it 001. Everyone’s first press run is.',
          '街のコーダーたちへ — the press is yours; the refusals stay ours.',
        ],
      },
    ],

    pullQuote: {
      text: 'The constraints are not the fence around the press. They are the press.',
      attribution: 'THE PRESS DESK · 413',
    },

    signoff: '街のコーダーたちへ — the press is yours; the refusals stay ours.',
  },

  audit: {
    drafted: 'magazine-editor · claude-fable-5 session, VII·26',
    verified: 'choice sets are the live system constants (IssueStock, INK_SEEDS, the three principal layouts) — not copies; no storage or network path exists for compositions in PressFeature.tsx',
    adherence: 'PressSpread — new type, sixth shape, thirteenth tool; radiogroups + labelled inputs (rule 5); colophon states composition and grades nothing (411’s ethic at higher stakes); session-only with the remedy named in print (print to keep)',
    readCut: 'no aesthetics feedback of any kind — a scored press teaches composing for the score, so the score was cut before it was written',
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

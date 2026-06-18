/* ──────────────────────────────────────────────────────────────
   ISSUE 391 — JUN 2026
   ON THE HOUSE STYLE
   ハウススタイルについて — 様式が体系になる日

   A self-referential issue. Where 388–390 read the frontier from
   outside, 391 turns the lens on the magazine's own grammar. The
   house style — one tomato spot, two faces, a single asterisk —
   was bound this month into a portable, governed design system:
   tokens, primitives, components, and a lint that refuses a raw
   hex. The grammar that always carried the homage on its own is
   now an object you can hold (and install).

   Identity decisions:

     • coverStock = 'ivory' — the press-preview / methods-bench
       white. The spec deserves lab paper. First ivory in the run.
     • coverLayout = 'classic' — centred lockup, monument
       bottom-right. The house style, set straight.
     • coverOrnament = 'asterisk-stamp' — the one system glyph,
       stamped where a footnote pointer would sit. This issue is
       partly ABOUT that glyph; the ornament is the subject.
     • coverSeal = PRESS · 工房 · VI·26 — the design imprint signs
       its own issue (KERNEL PRESS, the in-house kobo).
     • accent = 'amethyst' — the cabinet seed reserved for issues
       about kernel.chat itself. Fittingly, amethyst IS the
       logo-mark purple — the one colour the system holds back
       from the page. The single issue that wears the mark's
       purple is the issue about the house.
     • spread.type = 'essay' with dossier + dataBlock + pullQuote
       + references — the spec read like a methods paper.

   No series: 391 stands outside the "Agentic Substrates" arc.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_391: IssueRecord = {
  number: '391',
  month: 'JUN',
  year: '2026',
  feature: 'ON THE HOUSE STYLE',
  featureJp: '「ハウススタイルについて」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'classic',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'PRESS · 工房 · VI·26',
    date: 'VI·26',
  },

  accent: 'amethyst',

  headline: {
    prefix: 'On',
    emphasis: 'the House Style',
    suffix: '.',
    swash: 'The magazine\'s visual grammar — one tomato spot, two faces, a single asterisk — was bound this month into a portable design system: tokens, primitives, components, and a lint that will not pass a raw hex. The grammar that carried the homage now travels as an object.',
  },

  contents: [
    { n: '001', en: 'The drawer and the press', jp: '引き出しと印刷', tag: 'OPENING' },
    { n: '002', en: 'One spot, two faces, one glyph', jp: '一色・二書体・一記号', tag: 'GRAMMAR' },
    { n: '003', en: 'From stylesheet to system', jp: '様式から体系へ', tag: 'METHOD' },
    { n: '004', en: 'What a house style is for', jp: 'ハウススタイルの意味', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'COLOPHON SPREAD · 仕様',
    title: 'On the House Style.',
    titleJp: 'ハウススタイルについて。',
    deck: 'This month the magazine bound its own grammar into a design system. One tomato spot, two faces, a single asterisk — extracted from a thirty-thousand-line stylesheet into a portable layer of tokens, primitives, and components, governed by a lint that refuses a hand-written colour, and installable as a skill. Nothing on the page changed. That is the point. This issue reads the move the way the magazine reads everyone else\'s: as a methods paper, with the audit attached.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    dossier: {
      kicker: 'COLOPHON · 仕様',
      note: 'The kit, before the prose.',
      items: [
        { label: 'THE HOUSE', labelJp: '本誌', value: 'kernel.chat editorial grammar', valueJp: '本誌の編集文法' },
        { label: 'THE KIT', labelJp: '道具', value: 'One spot · two faces · one glyph', valueJp: '一色・二書体・一記号' },
        { label: 'THE BINDING', labelJp: '製本', value: 'Skill · gallery · migrated layer', valueJp: 'スキル・展示・抽出層' },
        { label: 'THE RULE', labelJp: '規則', value: 'Never a hand-written colour', valueJp: 'べた書きの色は使わない' },
      ],
    },

    sections: [
      {
        heading: 'THE DRAWER AND THE PRESS',
        headingJp: '引き出しと印刷',
        paragraphs: [
          'kernel.chat has always had a grammar. Warm paper, a single tomato spot, two faces and no third, a lone asterisk threaded through every folio. The rule was never written down so much as obeyed — the manuscripts stayed in the drawer; the press carried the look. This month the grammar left the drawer. It is now a system you can hold: a folder of tokens, primitives, and components, with a colophon that explains itself.',
          'The distinction matters. A look you obey is a habit; a system you install is an instrument. The first lives in one set of hands and dies when they leave the room. The second travels — to a slide deck, a legal page, a new contributor\'s first afternoon — and arrives already in voice.',
          'Nothing on the cover changed. That is the headline. The reader sees the same object they saw in ISSUE 390. What changed sits underneath the page: the grammar now has a single home, and a way to refuse anything that is not it.',
        ],
      },
      {
        heading: 'ONE SPOT, TWO FACES, ONE GLYPH',
        headingJp: '一色・二書体・一記号',
        paragraphs: [
          'Reduce the house style to its irreducible kit and three numbers fall out. One spot colour — tomato, #E24E1B — the only ink the press mixes; everything else is warm neutral, and there is never a pure white. Two typefaces — EB Garamond for everything that is read, Courier Prime for everything that is labelled — and no sans-serif, anywhere. One recurring mark: the asterisk, the folio glyph, the entire symbol budget. No emoji. A system with eleven small marks has none; this one has one, and keeps it.',
          'The restraint is the design. The constraint is what makes a stranger\'s spread look like ours without a style meeting. You do not get to add a second spot colour — you propose a new issue variant, and the magazine picks one accent from a small cabinet instead.',
          'This issue, fittingly, wears amethyst — the purple of the logo mark, the one colour the system holds back from the page. The single issue about the house is the one allowed to wear the mark.',
        ],
      },
      {
        heading: 'FROM STYLESHEET TO SYSTEM',
        headingJp: '様式から体系へ',
        paragraphs: [
          'The production stylesheet had grown to nearly thirty thousand lines — the editorial grammar threaded through an application\'s worth of interface CSS. The binding work was archaeological, not creative: find the parts that are the house style, lift them into their own layer, leave the rest alone. The tokens — colour, type, spacing — reconciled cleanly; the values already matched. The editorial primitives, the whole bracketed-kicker, hairline-rule, monument grammar, came out as a single file the magazine now imports.',
          'Read it like a methods paper: the move is verifiable, not vibe. The same cover renders before and after, pixel for pixel; the production build stays clean. A migration you cannot see is the only kind worth shipping to a live publication.',
          'Around the code sits the rest of the system. The components each carry their own types and a usage note; the warm retro-terminal illustrations and the logos travel with them; a gallery lays every specimen out on one page. The whole folder installs as a skill, so the next issue is designed in voice from the first keystroke.',
        ],
      },
      {
        heading: 'WHAT A HOUSE STYLE IS FOR',
        headingJp: 'ハウススタイルの意味',
        paragraphs: [
          'A house style is easy to mistake for decoration — the part you do last, the polish. It is the opposite. It is the argument, made in advance, that everything the magazine ships is one object: the cover, the legal page, the deck, the colophon, all unmistakably the same hand. Bound into a system, that argument becomes portable. It can be handed to a collaborator, a tool, a future self, and it arrives intact.',
          'There is a discipline here the magazine already preaches on other beats — count what gets read, cut what does not, file the audit in public. The design system is that discipline turned on the magazine\'s own surface. One spot. Two faces. One glyph. A lint that refuses the rest. The room is different; the job is the same.',
          'What ships this month is small and quiet: a folder, an import, a skill. What it means is larger. The look that carried the homage on its own no longer depends on anyone remembering it. It is written down, bound, and stamped by the press.',
          '街のコーダーたちへ — 様式は飾りではない。今月、それは持ち運べる体系になった。',
        ],
      },
    ],

    pullQuote: {
      text: 'A house style is not decoration. It is the argument, made in advance, that the magazine is a single object — now small enough to hand to someone.',
      attribution: 'THE EDITORS',
    },

    dataBlock: {
      kicker: 'BY THE NUMBERS · 数字で',
      heading: 'The whole kit',
      headingJp: '道具のすべて',
      afterSection: 1,
      stats: [
        { n: '1', label: 'Spot colour the press mixes', labelJp: '印刷する色', source: 'tomato · #E24E1B' },
        { n: '2', label: 'Typefaces. No third.', labelJp: '書体。三つ目はない', source: 'EB Garamond · Courier Prime' },
        { n: '1', label: 'Recurring glyph — the asterisk', labelJp: '記号は一つ', source: 'the folio mark' },
        { n: '252', label: 'Editorial classes in the layer', labelJp: '体系のクラス数', source: 'pop-* primitives' },
        { n: '0', label: 'Hand-written colours the lint allows', labelJp: 'べた書きの色', source: 'oxlint adherence' },
        { n: '391', label: 'Issues in the catalog', labelJp: '号', source: 'this one included' },
      ],
    },

    references: {
      kicker: 'WORKS CITED · 引用',
      note: 'The lineage this style is bound from.',
      items: [
        { authors: 'kernel.chat editorial', year: '2026', title: 'On Becoming a Real Magazine', journal: 'ISSUE 379' },
        { authors: 'kernel.chat editorial', year: '2026', title: 'The Six Borrows', journal: 'ISSUE 375' },
        { authors: 'KERNEL PRESS · 工房', year: '2026', title: 'kernel.chat Design System — tokens · primitives · components', journal: 'kobo edition' },
      ],
    },

    signoff: '街のコーダーたちへ — 様式は飾りではない。今月、それは持ち運べる体系になった。一色、二書体、一記号。',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'KERNEL PRESS · 工房',
    copy: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}

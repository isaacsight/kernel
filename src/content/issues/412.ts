/* ──────────────────────────────────────────────────────────────
   ISSUE 412 — JUL 2026
   THE MARGIN
   余白 — 機械が組んだ頁に、あなたの手で書く

   The fifth interaction primitive — Margin — and the writing rung
   of the ladder the run has been climbing without naming it: the
   reader went from watching (essays) to choosing (dial 399, switch
   406) to walking (sequence 408) to editing (galley 410) to
   learning (tutor 411). The only rung left below authorship was
   WRITING. This is it: each passage below carries a ruled margin,
   and the reader annotates in their own words.

   The design argument (the review this header is):

   • Why a new shape (rule 7): every existing control offers
     SELECTION among author-provided states — stops, lenses,
     stages, strikes. The margin offers CONTRIBUTION: the reader
     adds content that did not exist before their hand. That is a
     categorically different interaction model, not a variant of
     any built shape. Fifth primitive: Margin.

   • Rule 5, satisfied by definition: the control is a native
     <textarea> with a label — the most established input pattern
     on the web. No invented grammar; the reader has known this
     control their whole life.

   • Rule 1: untouched, the page is a complete essay on marginalia
     whose margins are empty — and an empty margin is not missing
     content; it is what a new book looks like. Nothing is gated
     on writing.

   • Rule 6, and the NEW honesty duty this shape adds: the tally
     counts notes and words — real counts of the reader's real
     writing — and claims nothing else. But an input field IMPLIES
     KEEPING, so an honest margin must say plainly that it keeps
     nothing: notes are session-state (no storage, no network, no
     localStorage), reload erases them, and the page instructs the
     reader to copy out what they want to keep — which is,
     precisely, the commonplace-book practice the piece describes.
     The honesty rule extends from "never fake a meter" to "never
     let the reader believe you keep what you don't."

   • Two voices, two faces, inside the two-face rule: the passage
     is machine-set EB Garamond; the reader's notes render in
     Courier Prime. The typography itself says whose words are
     whose.

   • Print: the reader's notes print — you print your own
     annotated copy — and an empty margin prints as ruled space a
     pencil can use. The digital margin teaches the paper margin.

   • Facts kept modest and verifiable: Fermat's 1637 note in his
     copy of Diophantus ("the margin is too narrow to contain")
     and Wiles's proof three and a half centuries later; medieval
     scribes' recorded margin complaints; Coleridge as the word's
     point of entry into English (earliest recorded use, 1819) and
     the posthumous publication of his marginalia; Locke
     publishing an indexing method for commonplace books
     (posthumously, 1706). No invented quotes, no invented dates.

   Identity decisions:
     • coverStock = 'cream' — the anchor stock, warm book paper.
       A piece about margins belongs on the page-est page.
     • coverLayout = 'classic' — the writable part lives inside.
     • coverSeal = THE MARGIN IS YOURS — the handover as the stamp.
       Completes the seal arc: 409 disclosed what the magazine
       kept, 410 stamped what it refused to keep, 411 stamped what
       it refused to measure, 412 stamps what it gives away.
     • accent = 'coffee' — margin's own shape default (slow work,
       the reading chair), used at default like every first
       instance in the run. The reader's ink in the margin renders
       in the accent: coffee ink on cream paper.
     • spread.type = 'margin', spread.stock = 'cream'.
     • featureJp = 余白 (yohaku) — the same word the design
       language already reveres via AROUND's 여백 (yeobaek):
       negative space as the primary tool. The margin IS yohaku,
       handed to the reader.

   Identity-catalog row to add to docs/design-language.md:

     | 412 | cream | classic | — | seal: THE MARGIN IS YOURS · VII·26 | coffee | margin (new) | Fifth interaction primitive — Margin: the first contribution control; each passage carries a ruled margin (native textarea, reader's notes in mono) and the reader writes in their own words; tally counts notes + words only; notes session-only, vanish on reload, and the page says so and teaches the commonplace move (copy out what you keep); print keeps notes, empty margins print as pencil-ready ruled space | `margin` spread type; twelfth editorial tool; the writing rung — watching→choosing→walking→editing→learning→WRITING; rule-6 extension: never let the reader believe you keep what you don't |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_412: IssueRecord = {
  number: '412',
  month: 'JUL',
  year: '2026',
  feature: 'THE MARGIN',
  featureJp: '余白',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'classic',

  coverSeal: {
    label: 'THE MARGIN IS YOURS',
    date: 'VII·26',
  },

  accent: 'coffee',

  headline: {
    prefix: 'The',
    emphasis: 'Margin',
    suffix: '.',
    swash: 'When the machine sets every word on the page, the margin is where the human still writes. Six passages on the oldest reader’s technology — each with a ruled margin that is yours.',
  },

  contents: [
    { n: '001', en: 'The last blank space', jp: '最後の余白', tag: 'METHOD' },
    { n: '002', en: 'Too narrow to contain', jp: '狭すぎた余白', tag: 'FERMAT' },
    { n: '003', en: 'The scribes complained here', jp: '写字生の嘆き', tag: 'GLOSS' },
    { n: '004', en: 'The man who wrote in borrowed books', jp: '借りた本に書く人', tag: 'COLERIDGE' },
    { n: '005', en: 'Copy out what you keep', jp: '残すものを書き写す', tag: 'COMMONPLACE' },
    { n: '006', en: 'Your hand, unkept', jp: '記録されない手', tag: 'CLOSING' },
  ],

  spread: {
    type: 'margin',
    kicker: 'THE MARGIN · 余白',
    title: 'The Margin.',
    titleJp: '余白。',
    deck: 'Every control this magazine has built offered you a choice among our states — stops, lenses, stages, strikes. This one offers a blank space and a cursor. Six passages on marginalia, each with a ruled margin beside it. Write what you think. The page counts your words, keeps none of them, and says so.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    dossier: {
      kicker: 'THE APPARATUS · 装置',
      note: 'The control: one labelled text field per passage — the oldest input on the web, no invented grammar. Your notes render in the typewriter face; the machine-set text stays in the serif. The typography says whose words are whose.',
      items: [
        { label: 'PASSAGES', value: '6 · EACH WITH A RULED MARGIN' },
        { label: 'CONTROL', value: 'A PLAIN TEXT FIELD · YOUR OWN WORDS' },
        { label: 'THE TALLY', value: 'YOUR NOTES AND WORDS · COUNTED, NOT READ' },
        { label: 'KEPT', value: 'NOTHING · SESSION-ONLY · RELOAD ERASES' },
        { label: 'TO KEEP A NOTE', value: 'COPY IT OUT — THE COMMONPLACE MOVE' },
      ],
    },

    intro: [
      {
        heading: 'The last blank space',
        headingJp: '最後の余白',
        paragraphs: [
          'Machines draft prose now — including, disclosed as always in the colophon below, much of this page. They summarize what they draft, and answer questions about the summaries. Almost everything that happens between a text and its reader can be delegated. What cannot be delegated is the note: the two words a reader writes beside a paragraph, in their own hand, that no one asked for and no model predicted. The margin is the last space on the page where writing still requires a person.',
          'This magazine has spent a dozen issues handing its readers controls — a dial, a switch, a sequence of stages, an editor’s knife. Every one of them offered a choice among states we authored. This issue hands over the one thing we cannot author: blank space. Each passage below carries a ruled margin. It is yours. Nothing you write leaves this page, nothing is stored, and reloading erases it — which is not a limitation but the whole point, and the last passage will tell you what readers have always done about it.',
        ],
      },
    ],

    marginKicker: 'SIX PASSAGES · THE MARGINS ARE YOURS · 余白はあなたのもの',

    passages: [
      {
        id: 'm1',
        text: 'In 1637, in the margin of his copy of Diophantus’s Arithmetica, Pierre de Fermat wrote that he had discovered a truly marvelous proof — which, he added, the margin was too narrow to contain. It took the mathematical world three and a half centuries to supply what the margin could not hold; Andrew Wiles’s proof, completed in the 1990s, runs to more than a hundred pages. The most consequential margin note in history is a note about the margin itself: the reader’s space was too small for what the reader brought to it, and mathematics spent 358 years finishing the annotation.',
      },
      {
        id: 'm2',
        text: 'Medieval manuscripts arrive carrying two texts: the one the scribe was paid to copy, and the one that escaped around its edges. In the margins of surviving codices, scribes recorded cramped hands, cold rooms, poor light, and the fervent wish for a drink — small human weather, preserved for a thousand years beside the sacred text because parchment keeps whatever ink touches it. The margin was where the person who made the page got to exist on it. Every complaint is proof that a body sat there, working.',
      },
      {
        id: 'm3',
        text: 'The word itself entered English through Samuel Taylor Coleridge, whose habit of writing in books — his own and, notoriously, other people’s — was so distinctive that friends lent him volumes hoping to get them back annotated, worth more used than new. His marginalia were collected and published after his death, filling volumes: a major body of one of the language’s major minds, composed entirely in the white space of other people’s pages. The margin, practiced seriously, is not a scratchpad. It is a genre.',
      },
      {
        id: 'm4',
        text: 'The margin had a companion technology: the commonplace book, the private notebook into which readers copied the passages they intended to keep, each in their own hand, under their own headings. John Locke thought the practice important enough that his indexing method for it was published as a treatise. The sequence mattered — the margin was where you reacted, the copying-out was where you decided, and the notebook was what you kept. Reading was a chain of small writings, and none of the links were optional.',
      },
      {
        id: 'm5',
        text: 'Then the page became a screen, and the margin became a business. Highlights synced to servers; annotations became engagement; the note you wrote beside a paragraph was retained, aggregated, and sold as a signal of your attention. The reader’s space stopped being the reader’s. Most digital margins are now the most-surveilled white space in history — which is why the margins on this page are built the way they are: counted but never read, held but never kept, gone when you close the door behind you.',
      },
      {
        id: 'm6',
        text: 'And so: the space to the right of these words. It has been empty for eleven interactive issues, and its emptiness was never missing content — an empty margin is what a new book looks like. Whatever you have written beside these passages, the page has counted the words and learned nothing else. If any note is worth keeping, do what readers have done for four centuries: copy it out, into your own file, your own notebook, your own hand. The margin was never meant to be storage. It is where reading turns into writing — and the writing it turns into was always meant to leave.',
      },
    ],

    marginNote: 'The tally counts your notes and words, live, from what you type — a count of the writing, never a reading of it. Your notes exist in this page’s memory for this visit only: nothing is stored, nothing is sent, and reloading the page erases them. Copy out what you want to keep — that is not a workaround; it is the commonplace-book practice this spread is about. Printing this page prints your notes; an empty margin prints as ruled space for a pencil.',

    outro: [
      {
        heading: 'Your hand, unkept',
        headingJp: '記録されない手',
        paragraphs: [
          'If you wrote anything above, you did the one thing on this page a machine could not have done for you — not because a model cannot produce two words beside a paragraph, but because the two words would not be YOURS, and the entire value of a margin note is its provenance. A note is proof of reading. Platforms have spent two decades harvesting that proof and calling it engagement; this page refuses the harvest so completely that it cannot show you your own notes tomorrow. That trade — your permanence for your privacy — is stated in print, on the surface, because an honest margin must never let you believe it keeps what it doesn’t.',
          'The run’s ladder is now complete through its penultimate rung: the reader who watched, then chose, then walked, then cut, then learned, has now written. Above this rung there is only authorship itself — and that is another issue. For this one, the instruction is four centuries old and two words long, and it is the last line of the last passage: copy out.',
          '街のコーダーたちへ — write in the margin; copy out what you keep.',
        ],
      },
    ],

    pullQuote: {
      text: 'A note is proof of reading — and this page refuses the harvest so completely that it cannot show you your own notes tomorrow.',
      attribution: 'THE MARGIN DESK · 412',
    },

    signoff: '街のコーダーたちへ — write in the margin; copy out what you keep.',
  },

  audit: {
    drafted: 'magazine-editor · claude-fable-5 session, VII·26',
    verified: 'Fermat 1637 / Wiles 1990s and Coleridge-as-entry-point kept to well-attested claims, no invented quotes; no storage or network path exists for notes in MarginFeature.tsx — session React state only',
    adherence: 'MarginSpread — new type, fifth primitive, twelfth tool; native labelled textarea (rule 5 by definition); reader’s voice in mono within the two-face rule; rule-6 extension stated in print (never let the reader believe you keep what you don’t)',
    readCut: 'no placeholder text in the margins — author words in the reader’s space would defeat the handover; the margin ships empty because empty is what a new book looks like',
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

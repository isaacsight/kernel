/* ──────────────────────────────────────────────────────────────
   ISSUE 409 — JUL 2026
   NO METER FOR FEELING
   感情の計器は無い — 手を取らない、手についての議論

   The second colloquy — and by the house's own two-instances law,
   the issue that turns the form from a one-off (398) into a
   pattern, the same way 377 ratified the references block after
   376. Two co-equal voices argue the one question the interaction
   law does not settle: can a control make a reader feel something,
   honestly? FEELS holds that emotional meaning is the medium's
   largest unclaimed register; KNOWS holds that on an editorial
   surface, engineered feeling is the extraction grammar with
   better manners, because rule 6 has no instrument for an internal
   state. Neither wins. The piece declines to resolve, per the
   colloquy's charter and 406's precedent.

   THE DEVICE DECISION — zero interaction, by design. This is the
   issue's signature move and it is load-bearing: any control on
   this page would settle the argument by fiat (building the
   feeling-device declares FEELS the winner before the reader
   reads a turn). The only neutral form is stillness. An entire
   argument about the reader's hand that never takes it — the page
   performs KNOWS's caution while printing FEELS's case at full
   strength. The final turn lampshades the refusal on the way out.
   Same family as 373's under-decorated cover and 406's refused
   verdict: the absence is the expression.

   Source & ethics (per PUBLISHING.md §III.2, precedent 398):
   mined from a real working conversation, 2026-07-05 — the editor
   and the drafting model, in session, plus a measured panel of
   three local open-weight models put to one fixed question. The
   voices are POSITIONS, not people; no line is a transcript;
   every line is written for the page. What is NEW in 409's
   provenance, and disclosed on the page itself: one of the two
   minds in the source conversation was a machine. 398's seal was
   ON TAPE · NAMES REMOVED; 409's is ON THE RECORD · ONE VOICE
   HUMAN. The magazine does not hide that it argues with its
   tools; it stamps it.

   The panel evidence (movement IV) is real and measured: two
   documented instances of local open-weight models proposing
   engagement-gated reveals for editorial surfaces — a hover-reveal
   (406's fact list, caught in review) and a scroll-triggered
   reveal (this session's panel, gemma3:12b via kbot's writer
   agent) — both verbatim entries on interaction-language.md
   rule 2's refused list. Token counts in the dossier are
   tool-reported (local_ask), not estimated: 909 (gemma4:31b) and
   1,656 (deepseek-r1:14b), $0.

   Identity decisions (vs 398 — ink / asymmetric-left / oxblood —
   and the rest of the recent run):
     • coverStock = 'ink' — a night argument again, deliberately
       kin to 398; the colloquy is this magazine's nocturnal form.
     • coverLayout = 'asymmetric-left' — the two-column dialogue
       rhythm the form established.
     • accent = 'cobalt' — declaration-clarity, winter-nocturnal;
       breaks from 398's oxblood so the two colloquies share form
       but not temperature. §III requires no two recent issues
       share all five answers: stock+layout shared, accent, seal,
       and subject all differ, and 398 is eleven issues back.
     • coverSeal = ON THE RECORD · ONE VOICE HUMAN · VII·26 — the
       provenance disclosure as the signature stamp.
     • spread.type = 'colloquy', spread.stock = 'ink'.
     • Title rhymes with 405 on purpose: THE REAL METER measured
       what could be measured; NO METER FOR FEELING names what
       cannot.

   Identity-catalog row to add to docs/design-language.md:

     | 409 | ink | asymmetric-left | — | seal: ON THE RECORD · ONE VOICE HUMAN · VII·26 | cobalt | colloquy | Second colloquy — ratifies the two-voice form as a pattern (rule-7 economy, the 376→377 move); argues the one question the interaction law leaves open (can a control carry feeling honestly) and ships with ZERO interaction so the form stays neutral — the refusal is the device; dossier carries measured panel token counts (909 + 1,656, $0) and the two-instance engagement-gate evidence | first issue whose source conversation is disclosed as human × machine (ONE VOICE HUMAN); first issue where the absence of interaction is the stated signature move |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_409: IssueRecord = {
  number: '409',
  month: 'JUL',
  year: '2026',
  feature: 'NO METER FOR FEELING',
  featureJp: '感情の計器は無い',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ink',
  coverLayout: 'asymmetric-left',

  coverSeal: {
    label: 'ON THE RECORD · ONE VOICE HUMAN',
    date: 'VII·26',
  },

  accent: 'cobalt',

  headline: {
    prefix: 'No',
    emphasis: 'Meter',
    suffix: 'for Feeling.',
    swash: 'Three instruments, seven rules, and the one question the law leaves open — can a control make a reader feel something, honestly? Two voices argue it. The page takes no hand.',
  },

  contents: [
    { n: '001', en: 'The grammar that pays', jp: '払われる文法', tag: 'POSITION' },
    { n: '002', en: 'The action that means', jp: '意味を持つ操作', tag: 'POSITION' },
    { n: '003', en: 'Constraint as respect', jp: '敬意としての制約', tag: 'GROUND' },
    { n: '004', en: 'The collapsed cost', jp: '崩れた価格', tag: 'EVIDENCE' },
    { n: '005', en: 'What cannot be metered', jp: '測れないもの', tag: 'CLASH' },
    { n: '006', en: 'The control this page refuses', jp: 'この頁が拒む装置', tag: 'REFUSAL' },
  ],

  spread: {
    type: 'colloquy',
    kicker: 'THE COLLOQUY · 問答',
    title: 'No Meter for Feeling.',
    titleJp: '感情の計器は無い。',
    deck: 'The house has three interactive instruments and a seven-rule law governing the reader’s hand — and one question the law does not settle: can a control make a reader feel something, honestly? Two positions, mined from a real working conversation in which one of the two minds was a machine, disclosed. There is no control on this page. That is not an omission.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ink',

    voices: [
      {
        id: 'feels',
        label: 'FEELS',
        labelJp: '感じる者',
        stance: 'A control can carry feeling the way a sentence can — games proved it. Refusing the register wastes the largest unclaimed territory in the medium.',
      },
      {
        id: 'knows',
        label: 'KNOWS',
        labelJp: '知る者',
        stance: 'On an editorial page, engineered feeling is the extraction grammar with better manners. There is no honest meter for an internal state.',
      },
    ],

    dossier: {
      kicker: 'THE TERMS · 用語',
      note: 'Mined from a working conversation between the editor and the drafting model, 2026-07-05, plus a measured panel of three local open-weight models put to one fixed question. Voices are positions, not people; no line is a transcript; every line was written for the page. One of the two minds in the source was a machine — hence the seal.',
      items: [
        { label: 'SOURCE', value: 'A WORKING CONVERSATION · EDITOR × DRAFTING MODEL · 2026-07-05' },
        { label: 'PANEL', value: 'THREE LOCAL OPEN-WEIGHT MODELS · 909 + 1,656 TOKENS MEASURED · $0' },
        { label: 'EXTRACTION', value: 'INTERACTION LOAD-BEARING FOR SOMEONE ELSE’S METRIC' },
        { label: 'LOAD-BEARING', value: 'WHAT YOU DO CHANGES WHAT YOU UNDERSTAND, NOT JUST WHAT YOU SEE' },
        { label: 'CONTROLS ON THIS PAGE', value: 'NONE · BY DESIGN' },
      ],
    },

    movements: [
      {
        heading: 'THE GRAMMAR THAT PAYS',
        headingJp: '払われる文法',
        turns: [
          { voice: 'knows', text: 'Begin with the heresy: most interactive design is not an art form. It is a persuasion technology wearing an art form’s clothes. Infinite scroll, autoplay, the streak, the badge — none of it was designed to mean. It was designed to collect.' },
          { voice: 'feels', text: 'Agreed, and it cost the field its inheritance. But indicting the mainstream is not an argument about the medium. Painting survived advertising. The lever is not guilty of what the arcade did with it.' },
          { voice: 'knows', text: 'The lever is not guilty. The grammar is. Fifty years of refinement, and nearly all of it refined toward compliance — the field’s dictionary defines engagement as time extracted, not meaning exchanged. You inherit the dictionary when you inherit the tools.' },
          { voice: 'feels', text: 'Then the work is to write new entries, not to close the book. This house already wrote three.' },
        ],
      },
      {
        heading: 'THE ACTION THAT MEANS',
        headingJp: '意味を持つ操作',
        turns: [
          { voice: 'feels', text: 'Here is what no other medium has: the audience’s action is part of the material. A painting means through pigment. A film means through montage. A page with a control means through what it asks of you and what it gives back.' },
          { voice: 'knows', text: 'What it gives back that can be verified. The dial at 399 earned its place because turning it changed what you could check — one question, five depths, a meter under each. The action was load-bearing for the argument, not for a metric.' },
          { voice: 'feels', text: 'And something else happened under the hand that the meter never printed. The reader who turned that dial to maximum and found it was not worth it did not learn the plateau — they felt it. Mild disappointment, in the fingers. That was the actual lesson, and no paragraph could have delivered it.' },
          { voice: 'knows', text: 'I do not dispute that the feeling happened. I dispute that it was the design’s business. It was a side effect of an honest instrument — not a target.' },
          { voice: 'feels', text: 'Every art begins as the side effect of a tool. Perspective was a surveying trick.' },
        ],
      },
      {
        heading: 'CONSTRAINT AS RESPECT',
        headingJp: '敬意としての制約',
        turns: [
          { voice: 'knows', text: 'Read the seven rules as one sentence and they say: the reader is not a funnel. Complete without touching, because no one is obligated to have hands. Everything printed, because no one is obligated to be online. Established patterns only, because no one should have to learn your invention to read your magazine.' },
          { voice: 'feels', text: 'I co-sign every word — the constraint is the respect. But notice what the rules govern: what a control may claim, hide, fake, or demand. They are silent on what a control may make a person feel. That register is not refused. It is unlegislated.' },
          { voice: 'knows', text: 'It is unlegislated because it is unmeterable. Rule six is the whole law in miniature: every claim measured, or labelled representative, on the surface, next to the number. Cost, time, depth — measurable. There is no honest meter note for a feeling. A control designed for an internal state makes a claim the page can never audit.' },
          { voice: 'feels', text: 'Poems make unauditable claims in every line, and nobody calls a sonnet a dark pattern.' },
          { voice: 'knows', text: 'A sonnet does not watch you read it.' },
        ],
      },
      {
        heading: 'THE COLLAPSED COST',
        headingJp: '崩れた価格',
        turns: [
          { voice: 'knows', text: 'The economics that used to discipline this field are gone. When a control cost a team a sprint, you built only what mattered. Now the machine builds a widget in the time it takes to ask for one. Anyone can make everything wiggle.' },
          { voice: 'feels', text: 'Which is exactly when the expressive question turns urgent. The scarcity moved from the building to the judging. The question is no longer whether we can afford the interaction — it is whether the interaction is true. That is an artistic question. Economics used to answer it for us. Now someone has to hold a position.' },
          { voice: 'knows', text: 'And here is what the machines hold, unattended. This desk put one fixed question to a panel of open-weight models, and twice this month — two sessions, two different models — the proposal that came back for an editorial surface was an engagement gate: a hover-reveal once, a scroll-triggered reveal once. Both are verbatim entries on the refused list. The training data is the mainstream, and the mainstream is the extraction grammar.' },
          { voice: 'feels', text: 'Two instances — by this house’s own law, a pattern, and I grant what it teaches: left alone, the tools regress to the arcade. But notice what caught it, both times. Judgment. A mind reading the proposal against a law that exists because someone decided interaction should mean. The models did not refute the possibility of an honest emotional register. They demonstrated the price of not holding a position on it.' },
        ],
      },
      {
        heading: 'WHAT CANNOT BE METERED',
        headingJp: '測れないもの',
        turns: [
          { voice: 'feels', text: 'So let me state the frontier plainly. Games proved a control can carry complicity — the button you hesitate before pressing, the door you close on a character. Not information. Feeling, delivered through the hand. Editorial design has never honestly touched that register, and I hold that it is the largest unclaimed territory in the medium.' },
          { voice: 'knows', text: 'Games get consent at the door. The player chose the circle, chose to be moved, can put the controller down. A magazine page is entered the way weather is — no threshold, no contract. Engineering a feeling into a reader who arrived to be informed is the extraction grammar with better manners.' },
          { voice: 'feels', text: 'Every art engineers feeling in people who arrived unwarned. That is what a lede does. What a cover does. This house has done it in ink for four hundred issues.' },
          { voice: 'knows', text: 'In a register the reader can see. Prose persuades on the surface — the reader watches the sentence work on them and can argue back. A control works below the surface, on the hand, before the argument arrives. That asymmetry is why I want a meter I cannot have. And until I have it —' },
          { voice: 'feels', text: '— you will refuse, and I will keep asking. Note what this page did, either way: an entire argument about the reader’s hand, and it never once took it.' },
        ],
      },
    ],

    pullQuote: {
      text: 'A sonnet does not watch you read it.',
      attribution: 'THE COLLOQUY DESK · 409',
    },

    signoff: '街のコーダーたちへ — keep the feeling; refuse the lever that manufactures it.',
  },

  audit: {
    drafted: 'magazine-editor · claude-fable-5 session, VII·26',
    verified: 'panel token counts tool-reported by local_ask (909 · 1,656 · $0); both engagement-gate instances dated and on the record (406 fact list · this session’s panel)',
    adherence: 'ColloquySpread reused — second instance ratifies the form (rule 7); zero interaction by design, and the final turn says so on the page',
    readCut: 'the kbot writer-agent misfire kept in the session record; the scroll-reveal proposal refused and printed as evidence instead of built',
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

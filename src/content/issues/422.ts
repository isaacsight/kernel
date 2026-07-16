/* ──────────────────────────────────────────────────────────────
   ISSUE 422 — SEP 2026
   THE POVERTY OF ATTENTION
   注意の貧困

   Herbert A. Simon's 1971 warning — information consumes the
   attention of its recipients — staged as an operable treasury.
   Five strata: the Wealth (an authored flat feed, waded by hand),
   the Scarcity (the claim, inked word by word), the Allocation
   (one hundred units, sealed), the Zone (a machine whose magnetic
   pull is geared to the reader's own declaration), and the Floor
   (the reconciliation: declared against revealed).

   THE SHAPE (thirteenth): `audit` — the SESSION control. The
   reader's own attention is the axis; every meter counts the
   reader's hands and dwell, session-only, kept by no one.

   THE RULING (filed 2026-07-15): "I don't want a reduction of
   this — I want this to set new rules that merge with editorial."
   This is the FIRST MERGER ISSUE: the artifact carries onto the
   site whole (artifact-language §I as amended; interaction-
   language rule 3, the apparatus register). The filed artifact
   edition (artifacts/422-the-poverty-of-attention.html) is the
   pressroom original of record; this build is its co-equal
   setting, not its summary. Nothing was given up in reduction,
   because nothing was reduced.

   Honesty: the deck is authored and deliberately flat (the 415
   grammar); one quotation appears, nine words, attributed; all
   meters count the reader's own actions and dwell in this window,
   session-only, unrecorded. Works cited are real: Simon 71 ·
   Goldhaber 97 · Schüll 12 · Wu 16 · Williams 18.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_422: IssueRecord = {
  number: '422',
  month: 'SEP',
  year: '2026',
  feature: 'THE POVERTY OF ATTENTION',
  featureJp: '注意の貧困',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ivory',
  coverLayout: 'classic',

  coverSeal: {
    label: 'ATTENTION AUDIT No.1',
    date: 'IX·26',
  },

  accent: 'tomato',

  headline: {
    prefix: 'THE POVERTY OF',
    emphasis: 'ATTENTION',
    suffix: '.',
    swash: 'In 1971, long before the feed, Herbert A. Simon named the trade nobody had priced: information is paid for out of the attention of whoever receives it. This issue is a treasury. Your attention is the only currency in it — wade the wealth, ink the claim, seal a budget, face a machine geared to your own declaration, and reconcile what you said against what you did. Measured in front of you. Kept by no one.',
  },

  contents: [
    { n: '001', en: 'Information consumes its recipients', jp: '情報は受け手を消費する', tag: 'THESIS' },
    { n: '002', en: 'The wealth, waded by hand', jp: '手で掻き分ける富', tag: 'THE FEED' },
    { n: '003', en: 'One hundred units, sealed and carried', jp: '百単位の封印', tag: 'THE BUDGET' },
    { n: '004', en: 'A zone machine, declawed and disclosed', jp: '爪を抜かれた機械', tag: 'THE ZONE' },
    { n: '005', en: 'Declared, against revealed', jp: '申告と実際の決算', tag: 'THE FLOOR' },
  ],

  spread: {
    type: 'audit',
    kicker: 'ATTENTION AUDIT No.1 · 出納検査 — THE SESSION CONTROL',
    title: 'THE POVERTY OF ATTENTION.',
    titleLines: ['THE POVERTY', 'OF ATTENTION'],
    titleJp: '注意の貧困 — 富める情報、貧しい注意',
    deck: 'In 1971, long before the feed, the economist Herbert A. Simon named the trade nobody had priced: information does not come free — it is paid for out of the attention of whoever receives it. This page is a treasury. Your attention is the only currency in it, the rail is the audit, and every meter counts your own hands in front of you. Descend.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    signoff: '街のコーダーたちへ — the ledger holds no grudge and keeps no copy; spend the next hundred units like you sealed them.',
    stock: 'ivory',

    dossier: {
      kicker: 'THE TREASURY · 装置仕様',
      note: 'This spread is the first shipped under the merger ruling: the apparatus carries whole, no reduction. The beam is your pointer with spring inertia — dimmed prose stays legible; the beam raises emphasis only. Dwell is measured from which stratum holds the middle of your window, computed in this window, session-only, unrecorded.',
      items: [
        { label: 'SUBJECT', value: 'THE READER’S OWN SESSION · N = 1' },
        { label: 'AXIS', value: 'ATTENTION — DWELL, MARKS, PULLS' },
        { label: 'BUDGET', value: '100 UNITS · FIVE CHANNELS · SEALED' },
        { label: 'CARRIED CONTEXT', value: 'FEED GRANT GEARS THE ZONE’S MAGNETISM' },
        { label: 'RETENTION', value: 'NONE · RELOAD ERASES · PRINT TO KEEP' },
      ],
    },

    deckItems: [
      'A think-piece argues the morning feed is the new commute.',
      'Somewhere, a dashboard has added a second dashboard.',
      'A platform announces a quieter notification, louder than before.',
      'An app you forgot renames itself and asks to be remembered.',
      'A thread summarizes a book that summarized a study.',
      'A metric is up. Another metric explains it away.',
      'A new feed promises the end of feeds. Subscribe below.',
      'Someone is typing.',
      'A trailer for a preview of an announcement.',
      'The algorithm would like to know if you saw the thing.',
      'A hot take cools. A colder take arrives to warm it.',
      'This item intentionally resembles the last one.',
    ],

    claimLead: 'What information consumes is the attention of its recipients — hence',
    claimQuote: '"a wealth of information creates a poverty of attention."',
    claimCite: 'HERBERT A. SIMON, 1971',

    channels: [
      { key: 'feed', label: 'THE FEED', jp: 'フィード' },
      { key: 'work', label: 'THE WORK', jp: '仕事' },
      { key: 'room', label: 'THE ROOM', jp: '同席の人' },
      { key: 'craft', label: 'THE CRAFT', jp: '手仕事' },
      { key: 'rest', label: 'THE REST', jp: '休み' },
    ],

    auditNote: 'Every meter on this page counts your own actions and your own dwell, computed in this window, session-only, unrecorded; reload erases; print to keep. The feed and the zone deal authored, deliberately flat items — nothing generated, nothing fetched. One quotation appears, nine words, attributed; all else is paraphrase.',

    pullQuote: {
      text: 'The gap between what you declared and what you revealed — not the feed — is the issue.',
      attribution: 'THE RECONCILIATION FLOOR, THIS PAGE',
    },

    references: {
      kicker: 'WORKS CITED · 参考文献 — ALL REAL, ALL CHECKABLE',
      items: [
        {
          authors: 'Simon, H. A.',
          year: '1971',
          title: 'Designing Organizations for an Information-Rich World',
          journal: 'Computers, Communications, and the Public Interest, Johns Hopkins Press',
        },
        {
          authors: 'Goldhaber, M. H.',
          year: '1997',
          title: 'The Attention Economy and the Net',
          journal: 'First Monday, 2(4)',
        },
        {
          authors: 'Schüll, N. D.',
          year: '2012',
          title: 'Addiction by Design: Machine Gambling in Las Vegas',
          journal: 'Princeton University Press',
        },
        {
          authors: 'Wu, T.',
          year: '2016',
          title: 'The Attention Merchants: The Epic Scramble to Get Inside Our Heads',
          journal: 'Knopf',
        },
        {
          authors: 'Williams, J.',
          year: '2018',
          title: 'Stand Out of Our Light: Freedom and Resistance in the Attention Economy',
          journal: 'Cambridge University Press',
        },
      ],
    },
  },
}

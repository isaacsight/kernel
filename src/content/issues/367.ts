/* ──────────────────────────────────────────────────────────────
   ISSUE 367 — APRIL 2026
   THE MODEL PICKS UP THE PEN: ON ANTHROPIC LABS AND CLAUDE DESIGN
   モデルが筆を持つ — クロード・デザインについて

   The first dispatch-format issue. 364 was the forecast (general
   outlook, ink + classic). 366 was the essay (narrative, butter +
   monument-hero). 367 introduces a fourth tool: the wire dispatch,
   filed against a deadline the night a specific event happened —
   in this case the launch of Anthropic Labs' first product.

   Identity — ivory stock + asymmetric-left layout + ink-spread
   cover ornament + dispatch spread type. Ivory reads as press-
   preview white, the paper a launch arrives printed on; the
   asymmetric-left lockup reads as a bulletin filed on deadline;
   the tomato ink-spread literalises the swash ("we watch the ink
   spread"); and the dispatch grammar — wire slug marquee,
   dateline, dossier card, checkbox numbering, mid-spread
   bulletin, bridge line to issue 366 — makes the magazine feel
   serialised rather than episodic.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_367: IssueRecord = {
  number: '367',
  month: 'APRIL',
  year: '2026',
  feature: 'THE MODEL PICKS UP THE PEN: ON ANTHROPIC LABS AND CLAUDE DESIGN',
  featureJp: 'モデルが筆を持つ — クロード・デザインについて',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory + asymmetric-left + ink-spread.
      Combination is unique in the run: ivory has never been
      paired with an ornament, and the ink-spread ornament is
      dispatch-exclusive. The result is a cover that reads as a
      press-preview page with a tomato blot drying in the lower
      right — a physical object, a bulletin, not UI chrome. */
  coverStock: 'ivory',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'ink-spread',

  /** Press-preview wax seal, top-right corner. Reads as a
      rubber stamp pressed on the cover before the magazine
      left the press. Pairs with the ink-spread ornament to
      make the cover feel like a physical proof, not a web
      page. */
  coverSeal: {
    label: 'EMBARGO LIFTED',
    date: 'IV\u00b726',
  },

  headline: {
    prefix: 'The Model',
    emphasis: 'Picks Up',
    suffix: 'the Pen.',
    swash: 'Anthropic opens a design room; we watch the ink spread.',
  },

  contents: [
    { n: '001', en: 'The empty canvas closes', jp: '白紙の終焉', tag: 'FIELD' },
    { n: '002', en: 'A Labs coat, not a hoodie', jp: '実験室の白衣', tag: 'FRAMING' },
    { n: '003', en: 'Who they brought to the party', jp: '招待された名前', tag: 'PARTNERS' },
    { n: '004', en: 'Inline comments, meet the prompt', jp: '注釈とプロンプト', tag: 'INTERFACE' },
    { n: '005', en: 'Figma hears the door', jp: 'フィグマ、扉の音', tag: 'COMPETITION' },
    { n: '006', en: 'What stays scarce', jp: '残る希少', tag: 'TASTE' },
    { n: '007', en: 'The only real question', jp: '唯一の問い', tag: 'FUTURE' },
  ],

  spread: {
    type: 'dispatch',
    kicker: 'DISPATCH · 速報',
    title: 'The Model Picks Up the Pen.',
    titleJp: 'モデルが筆を持つとき。',
    deck: 'Seven stakes filed the night Anthropic Labs shipped Claude Design. What just shifted, who should be nervous, what stays scarce, and the only question that still matters by summer.',
    byline: 'BY THE EDITORS \u00b7 KERNEL.CHAT',
    stock: 'ivory',

    /** Wire slug — repeats across the top marquee. Reads as
        newsroom ticker tape. Short, Courier, all caps. */
    slug: 'KERNEL.CHAT WIRE \u00b7 367 \u00b7 IV\u00b726 \u00b7 FILED 23:47 JST \u00b7 INK WET \u00b7 EMBARGO LIFTED',

    /** Newspaper dateline — read as if spoken by the wire. */
    dateline: 'SAN FRANCISCO \u2014 APR 17 \u2014 THE EDITORS FILED THIS LATE.',

    /** Dossier stamp fields. */
    filedAt: '17 APR 2026 \u00b7 23:47 JST',
    status: 'INK WET',

    /** The partner roll — triangulates the launch audience. */
    partners: [
      { name: 'CANVA', role: 'the mass-market channel; half a billion monthly cards.' },
      { name: 'BRILLIANT', role: 'the learning surface; the next generation of designers discovers the idea here.' },
      { name: 'DATADOG', role: 'the enterprise column; the line item that pays for the GPUs.' },
    ],

    /** Bridge to the preceding issue — makes 366 + 367 read as
        two halves of the same argument. */
    bridge: {
      issue: '366',
      text: '366 watched the tools use us. 367 is the night one of them picked up a pen.',
    },

    intro: 'Anthropic launched a design product last night. Not a model. Not an API. A tool where you describe what you want, and a model renders it — mockups, prototypes, decks, marketing collateral, code-driven surfaces with voice and shader and 3D. The launch partners were Canva, Brilliant, and Datadog. The framing was "Anthropic Labs," a new division for experimental things. We filed these notes the same night, before the takes industrialised. Some of them will be wrong by June. That is the nature of filing fast.',

    propositions: [
      {
        n: '01',
        overline: 'FIELD',
        filedAt: '23:12 JST',
        title: 'The empty canvas is over.',
        titleJp: '白紙の終焉',
        body: [
          'First-draft-for-free arrived for copy in 2023 and for code shortly after. It has now arrived for design. The blank artboard — the scariest hour of the working day, the one where taste is actually formed — has been declared solved by a company that is, on current evidence, good at declaring things solved and then shipping them.',
          'Whether this is good for designers is a different question from whether it is true. The empty canvas was not only a problem. It was also where the hand learned what the hand wanted to make.',
        ],
      },
      {
        n: '02',
        overline: 'FRAMING',
        filedAt: '23:18 JST',
        title: 'The Labs coat is not a hoodie.',
        titleJp: '実験室の白衣',
        body: [
          'Anthropic did not launch this as "Claude Design, a new product." They launched it as "Anthropic Labs, which makes experimental things, and here is its first one." The framing is a hedge — Labs can fail; the mainline Claude brand cannot. It is also a commitment. The company that spent three years insisting its model is a tool for thought now has a division whose job is to ship consumer software that looks and feels.',
          'Watch where the Labs work ends up. The good stuff will be folded into Claude proper within a year. The rest will be quietly retired, and the Labs frame will have absorbed the failure so the brand does not have to.',
        ],
      },
      {
        n: '03',
        overline: 'PARTNERS',
        filedAt: '23:24 JST',
        title: 'Look at who they brought to the party.',
        titleJp: '招待された名前',
        body: [
          'Canva. Brilliant. Datadog. That triangulation is not accidental. Canva is the mass market — half a billion people who have never opened Figma and make one birthday card a month. Brilliant is the learning channel — the surface where the next generation of designers discovers the idea that "designing" is something a person does. Datadog is the enterprise column, the one whose line item pays for the GPUs.',
          'Read a launch partner list the way you read a band\u2019s touring cities. It tells you which rooms are being played first, and in what order the rest will follow.',
        ],
      },
      {
        n: '04',
        overline: 'INTERFACE',
        filedAt: '23:31 JST',
        title: 'Inline comments is a borrowed metaphor.',
        titleJp: '注釈とプロンプト',
        body: [
          'The interface imports a Figma metaphor — comments next to work, custom adjustment controls, a conversational loop — into a place where the work itself is being generated by the same system you are commenting to. This is new. You are no longer a designer commenting on a designer\u2019s draft. You are a reviewer commenting on a reviewer that wrote the draft, will revise the draft based on your comment, and then invite you to comment on the revision.',
          'The metaphor fits poorly. The product will force the industry to find a new one. The first company to name the interaction well — the right verb for the thing you are doing when you nudge a generated artefact with prose — wins the vocabulary of the next decade of design tools.',
        ],
      },
      {
        n: '05',
        overline: 'COMPETITION',
        filedAt: '23:38 JST',
        title: 'Figma hears the door.',
        titleJp: 'フィグマ、扉の音',
        body: [
          'If Canva is a public launch partner for Claude Design, Figma is reading the same announcement and running the same arithmetic. The layer of software where "make me a mockup" becomes the default interaction is being restructured in real time, and the company whose entire identity was "we own that layer" has reason to be, quietly, not sleeping well tonight.',
          'Expect acquisition chatter. Expect pivot rumours. Expect a counter-product announcement before the end of the quarter. The air changed tonight. Whether the ground moves depends on who executes first.',
        ],
      },
      {
        n: '06',
        overline: 'TASTE',
        filedAt: '23:42 JST',
        title: 'What stays scarce: taste.',
        titleJp: '残る希少',
        body: [
          'First drafts are free. Thousand-draft exploration is free. What is not free — and is getting more valuable by the quarter — is the person who can look at forty generated options and know that thirty-seven are the same idea in different fonts, that two are technically interesting and wrong for this audience, and that the last one, the ugly one, is the one worth pursuing. That is editorial work. No Labs product ships it as a feature.',
          'The premium on taste just went up, not down. The designers who survive the next two years will be the ones who can say, plainly and without flinching, why one option is better than another. The ones who cannot will be managed by those who can.',
        ],
      },
      {
        n: '07',
        overline: 'FUTURE',
        filedAt: '23:46 JST',
        title: 'The only real question.',
        titleJp: '唯一の問い',
        body: [
          'Does Claude Design produce outputs designers want to argue with? That is the only question that matters. The outputs you argue with are the ones you keep open and keep changing. The outputs you shrug at are the ones you close the tab on, and the product that produces them gets churned off within ninety days regardless of how impressive the launch partners were.',
          'We will find out by summer. Until then the pen is in a new hand, the ink is still wet, and the line it draws is the only thing worth watching. Not the press release. The line.',
        ],
      },
    ],

    /** Mid-spread bulletin — the sharpest line lifted out of the
        propositions and set as a wire billboard. */
    bulletin: {
      text: 'The premium on taste just went up, not down.',
      attribution: 'KERNEL.CHAT \u00b7 DISPATCH \u00b7 367',
    },

    outro: 'Dispatches get older fast. File this one under APR 2026, next to the take that looked obvious that week and foolish by August. Some of it will hold. The parts that hold are the parts about taste — because taste is always what survives a tool-shift, and there has never been a tool-shift that rewarded the people who did not have any.',

    signoff: '\u8857\u306e\u30b3\u30fc\u30c0\u30fc\u305f\u3061\u3078 \u2014 watch the first marks, not the press release.',

    /** AP-style wire terminator. "— 30 —" closed dispatches on the
        teletype; the text below is the filing summary. */
    terminator: 'END OF DISPATCH \u00b7 KERNEL.CHAT/367 \u00b7 FILED 23:47 JST \u00b7 INK STILL WET',
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

/* ──────────────────────────────────────────────────────────────
   ISSUE 364 — APRIL 2026
   NOTES TOWARD 2027 · WHAT DESIGN GETS RIGHT NEXT YEAR
   2027年の予告 — デザインの次の一年

   The first forecast-format issue. Typography-led essays (363)
   and Q&A profiles (available) are two tools; this issue unlocks
   a third — numbered propositions. Ink stock, classic layout,
   tomato accents, seven declarations about where design is headed
   as 2027 approaches.

   Editorial position: after five years of AI-generated everything,
   craft is reasserting. The issue takes the stance plainly.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_364: IssueRecord = {
  number: '364',
  month: 'APRIL',
  year: '2026',
  feature: 'NOTES TOWARD 2027: WHAT DESIGN GETS RIGHT NEXT YEAR',
  featureJp: '2027年の予告 — デザインの次の一年',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ink stock, classic layout. First dark-ground
      cover in the run. Reads as a manifesto issue — declarative,
      serious, the month you'd publish a forecast. */
  coverStock: 'ink',
  coverLayout: 'classic',

  headline: {
    prefix: 'Notes',
    emphasis: 'Toward',
    suffix: '2027',
    swash: 'What design gets right next year.',
  },

  contents: [
    { n: '001', en: 'The editorial voice returns', jp: '編集の声が戻る', tag: 'VOICE' },
    { n: '002', en: 'Design systems get smaller', jp: '小さなシステム', tag: 'SYSTEMS' },
    { n: '003', en: 'Typography is the brand', jp: '文字が銘柄', tag: 'TYPE' },
    { n: '004', en: 'Japanese design keeps winning', jp: '日本のデザイン', tag: 'CULTURE' },
    { n: '005', en: 'Magazines come back', jp: '雑誌が戻る', tag: 'FORMAT' },
    { n: '006', en: 'Dark mode dies', jp: 'ダークモード終わる', tag: 'CHROME' },
    { n: '007', en: 'Design becomes a stance again', jp: '立場としてのデザイン', tag: 'ETHIC' },
  ],

  spread: {
    type: 'forecast',
    kicker: 'THE FORECAST · 2027予告',
    title: 'Notes Toward 2027.',
    titleJp: '次の一年、デザインは何を取り戻すか',
    deck: 'Seven declarations on where design is headed as the year turns. Written in April; published in case any of it comes true.',
    byline: 'BY THE EDITORS \u00b7 KERNEL.CHAT',
    stock: 'ink',

    intro: 'The last five years were the AI wave. The next five will be a correction. What came through the wave intact was craft, voice, and specificity. What didn\u2019t survive was the assumption that generic output is enough. These are the notes we\u2019re writing with.',

    propositions: [
      {
        n: '01',
        title: 'The editorial voice returns.',
        titleJp: '編集の声が戻る',
        body: [
          'After five years in which most interfaces sounded like they were written by the same person, readers are newly interested in knowing who is speaking. Products with a point of view — a byline, a stance, a recognizable way of phrasing things — feel suddenly valuable. Products without one feel suddenly thin.',
          'The brands that win 2027 ship with a tone. The brands that lose it ship with a "voice guideline."',
        ],
      },
      {
        n: '02',
        title: 'Design systems get smaller.',
        titleJp: '小さなシステム',
        body: [
          'Material 3, Fluent, Polaris — the mega-libraries are over. Teams that outperform ship bespoke systems tuned to their product. Fifteen components, each considered. A 1,200-component library is a liability, not an asset.',
          'The one-person design team with a focused token file beats the eight-person design team with a Figma organization chart.',
        ],
      },
      {
        n: '03',
        title: 'Typography becomes the brand.',
        titleJp: '文字が銘柄',
        body: [
          'Logos matter less every year. A confident type lockup does more work than a wordmark ever did. The brand is the headline, the pull-quote, the folio. The brand is the way the caps are spaced.',
          'Variable fonts finally ship everywhere, and the brands that are still drawing geometric sans mascots in 2027 look exactly as dated as they are.',
        ],
      },
      {
        n: '04',
        title: 'Japanese design keeps winning.',
        titleJp: '日本のデザイン、続行',
        body: [
          'Uniqlo, MUJI, HHKB, Teenage Engineering, POPEYE itself. The American design class is fifteen years behind a lineage it refuses to acknowledge. 2027 is the year that stops being funny.',
          'The Japanese answer to "should this have a logo?" has been "probably not" for half a century. The rest of us are about to discover that it was correct.',
        ],
      },
      {
        n: '05',
        title: 'Magazines come back.',
        titleJp: '雑誌が戻る',
        body: [
          'Not the print objects — the format. Independent editorial voices, monthly issues, mastheads, back catalogs. Software that feels like a publication rather than an application.',
          'The lesson is not that everyone should start a magazine. The lesson is that the magazine was always a better metaphor for what an attention-respectful product is trying to do than a "feed" or an "app" ever was.',
        ],
      },
      {
        n: '06',
        title: 'Dark mode dies.',
        titleJp: 'ダークモード、終わる',
        body: [
          'Warm ivory + ink + tomato beats true black + slate + accent on every axis that matters. Designers remember that paper was never pure white, and that pure black was never a color anything good was printed on.',
          'Per-section dark grounds — the occasional field-report on ink stock — stay. A forced whole-site dark theme goes. This is already happening; 2027 is when it becomes obvious.',
        ],
      },
      {
        n: '07',
        title: 'Design becomes a stance again.',
        titleJp: '立場としてのデザイン',
        body: [
          '"It depends" is dead. The design choice that answers "what do we believe?" ships; the design choice that answers "what are all our users comfortable with?" doesn\u2019t.',
          'This sounds harder than it is. Having a stance is cheaper than not having one. It only feels harder because of the decade we just lived through.',
        ],
      },
    ],

    outro: 'None of this is a prediction. All of it is already happening. The only question is how much of 2026 you want to spend pretending otherwise.',

    signoff: '2027\u5e74\u3078 \u2014 quiet, warm, specific, on paper even when it isn\u2019t.',
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

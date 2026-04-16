/* ──────────────────────────────────────────────────────────────
   ISSUE 361 — APRIL 2026
   THE INDOOR ISSUE: A FIELD GUIDE TO WORKING INSIDE
   室内派宣言 — 部屋の中で世界を作る

   Seasonal counterpart to ISSUE 360's outdoor cover. Late spring
   in Tokyo means rainy season approaching; the indoor faction
   raises its flag. Local models, bedroom studios, daemons humming
   while you sleep, the late-night terminal as a destination, not
   a workplace.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_361: IssueRecord = {
  number: '361',
  month: 'APRIL',
  year: '2026',
  feature: 'THE INDOOR ISSUE: A FIELD GUIDE TO WORKING INSIDE',
  featureJp: '室内派宣言 — 部屋の中で世界を作る',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — butter stock (warmer, denser, indoor-lit),
      classic layout. Reads as the indoor counterpart to 360's
      summer-cream cover. */
  coverStock: 'butter',
  coverLayout: 'classic',

  headline: {
    prefix: 'The',
    emphasis: 'Indoor',
    suffix: 'Issue',
    swash: 'A field guide to working inside.',
  },

  /** Table of contents — repositioned through the indoor lens.
      Each item is a real kbot capability, framed as a piece of
      indoor gear in the same way POPEYE writes up a record player
      or a desk lamp. */
  contents: [
    { n: '001', en: 'Bedroom studio: Ableton + Serum 2', jp: 'ベッドルームスタジオ', tag: 'FEATURE' },
    { n: '002', en: 'Local models: $0, fully offline', jp: 'ローカルモデル', tag: 'PRIVACY' },
    { n: '003', en: 'The night routines (24/7 daemons)', jp: '夜の習慣', tag: 'BACKGROUND' },
    { n: '004', en: 'Computer-use as an indoor pursuit', jp: '室内派の道具', tag: 'AGENT' },
    { n: '005', en: 'Late-night terminal sessions', jp: '深夜のターミナル', tag: 'RITUAL' },
    { n: '006', en: 'The dream engine (post-session memory)', jp: '夢のエンジン', tag: 'MEMORY' },
  ],
}

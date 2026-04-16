/* ──────────────────────────────────────────────────────────────
   ISSUE 362 — APRIL 2026
   THE VACATION ISSUE: SOFTWARE THAT DOESN'T NEED YOU
   休暇号 — あなたなしで動くソフトウェア

   Filed from a beach chair. The seasonal arc continues: 360 went
   outside, 361 stayed in, 362 leaves entirely. The cover story
   is the part of kbot that keeps working when you don't —
   daemons humming, sub-agents in parallel, the dream engine
   consolidating last week's sessions while you swim. An AI tool
   that doesn't demand your attention is the rarest thing in 2026,
   so we made it the cover.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_362: IssueRecord = {
  number: '362',
  month: 'APRIL',
  year: '2026',
  feature: 'THE VACATION ISSUE: SOFTWARE THAT DOESN\u2019T NEED YOU',
  featureJp: '休暇号 — あなたなしで動くソフトウェア',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — bright ivory stock + monument-hero layout.
      The feature is absence; the cover makes absence literal by
      turning the issue number itself into the dominant visual
      element and demoting the headline to subtitle. */
  coverStock: 'ivory',
  coverLayout: 'monument-hero',

  headline: {
    prefix: 'The',
    emphasis: 'Vacation',
    suffix: 'Issue',
    swash: 'Notes on software that runs without you.',
  },

  /** Table of contents — every item is a real kbot capability that
      operates autonomously. The unifying frame: nothing here needs
      a human in the loop. */
  contents: [
    { n: '001', en: 'The daemon network (24/7 background worker)', jp: '常駐デーモン', tag: 'FEATURE' },
    { n: '002', en: 'Dream engine: post-session memory consolidation', jp: '夢のエンジン', tag: 'MEMORY' },
    { n: '003', en: 'Sub-agents working in parallel', jp: '並列エージェント', tag: 'PARALLEL' },
    { n: '004', en: 'Discovery daemon: autonomous self-advocacy', jp: '探索デーモン', tag: 'GROWTH' },
    { n: '005', en: 'Social daemon: posting while you sleep', jp: '夜の投稿係', tag: 'SOCIAL' },
    { n: '006', en: 'Plan-and-execute mode: full autonomous runs', jp: '自律計画モード', tag: 'PLANNER' },
  ],
}

/* ──────────────────────────────────────────────────────────────
   ISSUE 360 — APRIL 2026
   THE URBAN OUTDOORS REVIEW
   都会のコードと、自然のOS

   Snapshot — frozen at the moment of publication. Once an issue
   ships, its data file should never change. New ship items go in
   the next issue.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_360: IssueRecord = {
  number: '360',
  month: 'APRIL',
  year: '2026',
  feature: 'THE URBAN OUTDOORS REVIEW',
  featureJp: '都会のコードと、自然のOS',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — warm cream stock, classic centered layout.
      The inaugural issue reads as the template everything else
      departs from. */
  coverStock: 'cream',
  coverLayout: 'classic',

  /** Cover headline parts — typeset by hand each issue. */
  headline: {
    prefix: 'The',
    emphasis: 'Urban Outdoors',
    suffix: 'Review',
    swash: 'A terminal companion for city coders.',
  },

  /** Table of contents — what shipped in this issue. */
  contents: [
    { n: '001', en: 'Computer-use desktop agent', jp: 'デスクトップ制御', tag: 'FEATURE' },
    { n: '002', en: 'Max 4 Live device pack (×9)', jp: 'M4L デバイス', tag: 'SOUND' },
    { n: '003', en: 'DJ Set Builder', jp: 'DJ セット', tag: 'SOUND' },
    { n: '004', en: 'Serum 2 preset tool', jp: 'シーラム プリセット', tag: 'SOUND' },
    { n: '005', en: 'Session isolation fix', jp: 'セッション分離', tag: 'SHIP' },
    { n: '006', en: 'SSRF protection via dns.lookup()', jp: 'SSRF 対策', tag: 'SECURITY' },
  ],
}

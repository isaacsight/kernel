/* ──────────────────────────────────────────────────────────────
   ISSUE 426 — JAN 2027
   THE WEATHER OVER THE QUEUE · 順番待ちの天気

   A forecast for compute: shared generation queues have weather —
   the quote is exact, the arrival is a season. Drafted artifact-first
   as an operable dispatch board (a third interaction shape after the
   422 instrument and 424 configurator): the reader files jobs, a
   seeded sky decides their fate, and the floor of the page reproduces
   the real July 19, 2026 job registry — 37 departures recorded to the
   second, seven still running and six still queued at press time.

   Four cyanotype night-station plates were commissioned; one is
   printed (back cover). The artifact draws its own sky in code —
   nothing generated appears in it, and it says so on its face.
   Every claim checked against output/job-registry.json and the
   docs/video/one-of-one-2027 production records.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_426: IssueRecord = {
  number: '426',
  month: 'JAN',
  year: '2027',
  feature: 'THE WEATHER OVER THE QUEUE',
  featureJp: '順番待ちの天気',
  price: '¥0 · PRICED TO THE CENT',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ink',
  coverLayout: 'ledger-rule',
  coverSeal: { label: 'DISPATCH DESK · NIGHT SHIFT', date: 'I·27' },
  coverPostmark: { place: 'THE DISPATCH DESK', date: 'I·27' },
  accent: 'cobalt',

  headline: {
    prefix: 'The weather',
    emphasis: 'over the queue.',
    suffix: '',
    swash: 'A job priced to the cent boards whenever the sky permits. One desk, one control, and one real day of departures recorded to the second.',
  },
  coverDeck:
    'Generation has weather now. The estimate is exact; the arrival is a season. A dispatch board you can work, and the July 19 registry printed as found.',

  contents: [
    { n: '001', en: 'The dispatch board', jp: '出発案内板', tag: 'FEATURE' },
    { n: '002', en: 'Five propositions on compute weather', jp: '予報五箇条', tag: 'FORECAST' },
    { n: '003', en: 'The session ledger', jp: '台帳', tag: 'APPARATUS' },
    { n: '004', en: 'The archive: July 19, recorded', jp: '記録された一日', tag: 'EVIDENCE' },
    { n: '005', en: 'Cyanotype night studies', jp: '青写真の夜', tag: 'PLATES' },
    { n: '006', en: 'The platform at press time', jp: '締切時刻のプラットホーム', tag: 'BACK COVER' },
  ],

  backCover: {
    subject: 'THE PLATFORM AT PRESS TIME',
    subjectJp: '締切時刻のプラットホーム',
    image: '/issues/426/02-platform.jpg',
    stock: 'ink',
  },

  spread: {
    type: 'forecast',
    kicker: 'FORECAST · 予報 · THE DISPATCH DESK',
    title: 'The Weather Over the Queue.',
    titleJp: '順番待ちの天気。',
    deck: 'On July 19 a forty-two second film was made in an afternoon, and almost none of the waiting happened where the work did. Between every quote and every arrival sat a queue shared with strangers, under a sky no dashboard shows. Five propositions follow, filed from the dispatch desk with the registry open.',
    byline: 'BY THE DISPATCH DESK · KERNEL.CHAT',
    stock: 'ink',
    signoff: '街のコーダーたちへ — quote everything, promise nothing, and keep the registry.',

    intro:
      'The studio used to wait on rendering; the machine was in the room, and the wait belonged to you. Now the wait belongs to a shared queue with its own climate. A job priced at one dollar sixty boarded nothing for ninety minutes. Eight duplicates of two shots were filed like extra trains, on the theory that one would find a gap in the front — two did, arriving twenty-three seconds apart. The prices were exact the whole time. The arrivals were weather.',

    propositions: [
      {
        n: '01',
        title: 'The estimate is exact; the arrival is a season.',
        titleJp: '見積は正確、到着は季節。',
        body: [
          'Per-second pricing has made cost the most predictable quantity in production — quoted, signed, and capped before a frame exists. Time has moved the other way. The same afternoon that priced thirty-seven jobs to the cent could not say within ninety minutes when one of them would arrive.',
          'Plan like an accountant, wait like a farmer.',
        ],
      },
      {
        n: '02',
        title: 'Queues are shared skies.',
        titleJp: '順番待ちは共有の空。',
        body: [
          'Your job does not wait in your queue; it waits in everyone’s. Demand you cannot see — a continent waking up, a model going viral, a Sunday afternoon — is the front that stalls your departure. No provider prints this sky, so the dispatcher learns it the way sailors learned theirs: by going out in it, and by keeping records.',
        ],
      },
      {
        n: '03',
        title: 'Redundancy is an umbrella, not a strategy.',
        titleJp: '冗長化は傘であって戦略ではない。',
        body: [
          'Filing the same shot on three carriers bought an arrival that single-filing would have missed — and six committed departures that never boarded, still marked queued in the registry. The umbrella works. It is also the receipt for not knowing the forecast.',
        ],
      },
      {
        n: '04',
        title: 'Capacity follows the vendor’s own house.',
        titleJp: '容量は本家の空に従う。',
        body: [
          'First-party surfaces board first. A model resold through a marketplace queues behind the seller’s own customers, and premium tiers are the most rationed rooms in the building. The day’s pattern was uniform: generously provisioned carriers arrived in minutes; prestige capacity never left the gate.',
        ],
      },
      {
        n: '05',
        title: 'File like a dispatcher.',
        titleJp: '配車係のように出す。',
        body: [
          'Quote everything before it boards. Cap the day’s spend where the software can refuse you. Write every departure down — filed, carrier, fate — because the registry is the only weather record this sky will ever have.',
          'The film got made. The sky closed behind it. The registry remains.',
        ],
      },
    ],

    outro:
      'Nothing in this forecast argues for patience as a virtue. It argues for instruments: a signed quote, a hard cap, a ledger with honest columns. Weather is not a moral problem, and neither is the queue — it is a sky, and skies are navigated, not admired.',
  },

  audit: {
    drafted: 'artifact first · kernel.chat editorial · Claude Fable 5 · 19 July 2026',
    verified:
      'design-qa audit clean at desktop and mobile — zero overflow, no undersized controls, no runtime errors; board, ledger, and fates exercised live before filing',
    adherence:
      'third interaction shape (operable dispatch board) after the 422 instrument and 424 configurator; one probe, honestly geared; sky deterministic from printed seed 426-0719; session ledger unrecorded and says so; reduced motion stills the board and resolves fates instantly',
    readCut:
      'archive rows reproduced from output/job-registry.json, not simulated; four cyanotype plates commissioned, one printed (back cover), three filed unprinted; no generated imagery inside the artifact',
    pressed: 'artifacts/426-the-weather-over-the-queue.html · I·27',
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

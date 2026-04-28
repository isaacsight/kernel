/* ──────────────────────────────────────────────────────────────
   ISSUE 370 — APRIL 2026
   ON FINDING A DESIGN LANGUAGE: SEVEN STAKES FOR 2027
   デザイン言語の見つけ方 — 2027

   The second forecast-format issue. 364 (Notes Toward 2027) made
   broad design-trend declarations. 370 narrows: how a design
   language is *found* in 2027 — the practice itself, not the
   trend. Drawn directly from the editorial-neighbours work in
   docs/design-language.md (POPEYE as the spine, PAPERSKY as the
   first neighbour, the four starred transferable mechanics:
   restraint, single-glyph system thread, place-and-route
   structure, postmark dateline).

   This is the first issue that consciously applies the
   editorial-neighbours framework on the cover and in the prose.
   Three of the four starred mechanics are exercised here:

   1. RESTRAINT — cream stock + monument-hero layout + no
      ornament + a single small FORECAST · 2027 seal. The
      milestone number 370 IS the cover art; the headline shrinks
      to a subtitle; nothing else competes. This is the doc's
      "earned quiet cover," cashed in at the milestone where it
      lands hardest.
   2. SINGLE-GLYPH SYSTEM THREAD — the asterisk (★) is
      introduced here as a candidate kernel.chat folio mark,
      surfaced in the kicker and the signoff. If the mark earns
      its keep across this issue, it can be promoted to a
      system-wide thread on covers, section openers, and page
      numbers in subsequent issues.
   3. PLACE-AND-ROUTE STRUCTURE — the seven propositions are not
      a catalog of design opinions; they are a route through the
      practice (pick the spine → collect the neighbours → steal
      mechanics → reduce to one glyph → choose route over theme
      → earn the quiet cover → choose the cadence). The forecast
      format carries the route grammar in numbered form.

   The fourth starred mechanic — postmark dateline — is held
   back for a future issue whose subject calls for geographic
   grounding rather than serial-position grounding. Monument-hero
   on 370 is making the opposite claim (the serial position IS
   the subject).
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_370: IssueRecord = {
  number: '370',
  month: 'APRIL',
  year: '2026',
  feature: 'ON FINDING A DESIGN LANGUAGE: SEVEN STAKES FOR 2027',
  featureJp: 'デザイン言語の見つけ方 — 2027への七つの賭け',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream stock + monument-hero layout. The
      milestone number 370 is the cover art; the headline shrinks
      to a subtitle. Cream is the canonical magazine paper, the
      anchor stock the rest of the run varies against, which is
      the right paper for an issue that is itself making a claim
      about anchors. */
  coverStock: 'cream',
  coverLayout: 'monument-hero',

  /** Press-preview seal, top-right. Reads as a forecast filing
      stamp: this is what we believed in April 2026 about the
      year ahead. Pairs with the monument-hero number to make
      the cover read as a manifesto pressed against a deadline,
      not a long-form essay. */
  coverSeal: {
    label: 'FORECAST · 2027',
    date: 'IV·26',
  },

  headline: {
    prefix: 'A Design Language is',
    emphasis: 'Found',
    suffix: ', not Designed.',
    swash: 'Seven stakes for 2027, drawn from the magazines on the shelf.',
  },

  contents: [
    { n: '001', en: 'Pick the spine', jp: '背骨を選ぶ', tag: 'METHOD' },
    { n: '002', en: 'Collect the neighbours', jp: '隣を集める', tag: 'METHOD' },
    { n: '003', en: 'Steal mechanics, not silence', jp: '仕組みを盗む', tag: 'ETHIC' },
    { n: '004', en: 'One glyph, used everywhere', jp: '一つの印', tag: 'SYSTEMS' },
    { n: '005', en: 'Place-and-route, not theme-and-catalog', jp: '場所と道筋', tag: 'STRUCTURE' },
    { n: '006', en: 'Earn the quiet cover', jp: '静かな表紙を稼ぐ', tag: 'RESTRAINT' },
    { n: '007', en: 'Cadence is design', jp: 'リズムは設計', tag: 'TEMPO' },
  ],

  spread: {
    type: 'forecast',
    kicker: 'THE FORECAST · ★ · 2027予告',
    title: 'How to Find a Design Language.',
    titleJp: 'デザイン言語の見つけ方。',
    deck: 'Seven stakes filed at issue number 370. Less about what design will look like next year — more about how a design language is *found* in 2027, after a year of decoding the magazines on our own shelf.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    intro: 'A design language is not a token file or a Figma library. It is a working agreement between a system and the things it refuses to do. The agreement is found, not designed; you find it by reading widely, picking one anchor, decoding the neighbours, and writing the practice down so the next issue does not start from scratch. Seven stakes follow, drawn from a year of doing exactly that.',

    propositions: [
      {
        n: '01',
        title: 'Pick the spine.',
        titleJp: '背骨を選ぶ',
        body: [
          'Every design language needs one anchor — one magazine, one studio, one historical movement that the rest of the system bends toward. The anchor sets the paper, the type, the spot color, the cadence. Without an anchor a design language is forty open browser tabs. With an anchor it is a system that knows what to refuse.',
          'The anchor does not need to be famous, fashionable, or even still publishing. It needs to be specific enough that you can name three of its grammars from memory. If you cannot, it is not your spine yet.',
        ],
      },
      {
        n: '02',
        title: 'Collect the neighbours.',
        titleJp: '隣を集める',
        body: [
          'Then keep a working catalogue of the magazines, studios, and products that sit adjacent to the spine — not as moodboard fuel, but as decoded mechanics. For each one, ask: what is this trying to do, and what is the single move I would steal? Write the answer down beside the reference.',
          'A neighbour you have not decoded is decoration. A neighbour you have decoded is a tool. The catalogue is the difference between a designer who has good taste and a system that has good taste.',
        ],
      },
      {
        n: '03',
        title: 'Steal mechanics, not silence.',
        titleJp: '仕組みを盗む、沈黙ではなく',
        body: [
          'Every adjacent reference is identifiable by something — a typeface, a margin, a register, a single recurring mark. Steal the mechanics behind that thing (the per-issue commissioned display word; the small recurring system glyph; the centred postmark dateline) and leave the *feel* alone. The mechanics travel; the silence belongs to the original.',
          'A useful test: if a reader who knows the reference would call your output "homage," you copied the silence and not the structure. Try again, and this time pick the move not the mood.',
        ],
      },
      {
        n: '04',
        title: 'One glyph, used everywhere.',
        titleJp: '一つの印を、どこにでも',
        body: [
          'Every coherent system has one small mark that travels through it — a paper airplane, a target, a star, a bracket, a tomato. It shows up on the cover and beside the page numbers and inside the section openers. It is the system\'s signature, smaller than the wordmark and used twenty times more often. If you do not have one, your system has eleven, and a system with eleven small marks has none.',
          'The infrastructure is cheap — an inline SVG, a CSS class. The discipline is the work. Reduce the eleven marks to one and the design language tightens visibly within a single issue.',
        ],
      },
      {
        n: '05',
        title: 'Place-and-route, not theme-and-catalog.',
        titleJp: '場所と道筋、主題と目録ではなく',
        body: [
          'The issue is not "about" a topic; the issue is a route through it. Not the AI issue — the AI issue traced through the night a specific product launched, with the partner roll and the wire timestamps and the single bulletin lifted out of the takes. Not the fish issue — the fish issue routed through one aquarist\'s sentence on national radio, then through the monograph, then through the Chicago tank.',
          'The route gives the asymmetric layouts something to hang on, the catalog something to number, the dossier something to abstract. Theme-and-catalog reads as a feed; place-and-route reads as a magazine. The difference is which question the issue starts from: *what is this about?* versus *what is the way through this?*',
        ],
      },
      {
        n: '06',
        title: 'Earn the quiet cover.',
        titleJp: '静かな表紙を稼ぐ',
        body: [
          'Density is fine until it becomes reflexive. Bank one quiet cover per year — a single image with a real margin, the wordmark held back, no cover lines competing for the headline. The quiet cover is a rest beat. It only works because the loud ones around it have been earned. Skip the loud ones and the quiet one reads as understaffed; skip the quiet one and the system reads as anxious.',
          'A discipline most design systems should not even attempt: most do not have enough loud covers in the back catalog to make the quiet one land. If yours does, the quiet cover is the most expensive single page in the run, and it pays back the rest of the year.',
        ],
      },
      {
        n: '07',
        title: 'Cadence is design.',
        titleJp: 'リズムは設計',
        body: [
          'How often the work appears is the loudest decision in the system. Monthly is one stance; quarterly is a different stance; annually is a third; "when ready" is a fourth that is harder to defend than it sounds. Choose the cadence on purpose. The reader feels it before they feel anything else, and the team builds around it before they build around anything else.',
          'A design language without a publishing rhythm is a Figma file. A design language with a rhythm is a magazine. The rhythm is what turns the system into a serial, and the serial is what gives every individual choice — paper, type, glyph, route, restraint — somewhere to land.',
        ],
      },
    ],

    outro: 'None of this is original. All of it had to be re-said. A design language in 2027 is built the way it has always been built — one decisive borrow at a time, plus the discipline to leave the rest. Issue number 370 is itself the answer to the brief: a milestone in a serial that knew where its spine was, and which neighbours it kept.',

    signoff: '街のコーダーたちへ ★ pick the spine; collect the neighbours; steal the mechanics; leave the silence.',
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

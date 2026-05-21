/* ──────────────────────────────────────────────────────────────
   ISSUE 390 — MAY 2026
   ON THE CONSUMER STANDARD
   消費者標準について — 立証可能性が日常に降りる日

   Series entry #3 of "Agentic Substrates for the Frontier."
   388 declared the series; 389 named agent fidelity engineering
   as the fourth substrate discipline; 390 reads today's Google
   I/O announcement as the consumer-side surface of the
   provenance-engineering pattern named in ISSUE 381.

   The dateline: 2026-05-21, Google I/O. Google embeds C2PA
   Content Credentials verification into Gemini, with rollout
   to Search and Chrome in coming months. The cryptographic
   provenance standard for media — camera-of-origin, edit
   history, AI-generated marker — is going default-on across
   one of the largest consumer surfaces on the internet.

   Why this is the consumer-side of provenance engineering: the
   substrate primitive ("prove what was produced and by whom")
   is the same primitive kbot-finance ships for regulated
   industry. The difference is the audience. Where 381 named
   the discipline for engineers building audit-grade systems,
   390 reads the moment the discipline crosses into a billion-
   user user experience.

   Identity decisions:

     • coverStock = 'cream' — tenth in working-register run.
     • coverLayout = 'asymmetric-left'
     • coverOrnament = 'asterisk-stamp' — eleventh issue running.
     • coverSeal = READ · CONSUMER · V·26 — new verb. The
       magazine READS what the field shipped this week, rather
       than NAMING something new.
     • accent = 'cobalt'
     • spread.type = 'essay'
     • series.name = "Agentic Substrates for the Frontier",
       position = 3

   Voice stays stripped (Tim O'Reilly prose-tells critique).

   Back cover: a phone screen showing a content-credentials
   verification badge under a photograph. The substrate is
   becoming a glyph users see. Cream stock. ─────────────── */

import type { IssueRecord } from './index'

export const ISSUE_390: IssueRecord = {
  number: '390',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE CONSUMER STANDARD',
  featureJp: '「消費者標準について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'READ · CONSUMER · V·26',
    date: 'V·26',
  },

  accent: 'cobalt',

  backCover: {
    subject: 'PHONE SCREEN, CONTENT CREDENTIALS BADGE',
    subjectJp: '証明バッジ',
    stock: 'cream',
    image: '/back-covers/390-credentials.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  series: {
    name: 'Agentic Substrates for the Frontier',
    nameJp: 'フロンティアのためのエージェント基盤',
    about: 'A series reading each branch of autonomy engineering through the lens of the substrate disciplines kernel.chat coined. ISSUE 390 reads the moment provenance engineering crosses from engineering discipline into a billion-user consumer surface.',
    position: 3,
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Consumer Standard.',
    suffix: '',
    swash: 'Google embeds C2PA in Gemini today. The provenance-engineering primitive crosses from audit-grade engineering into default-on consumer UX. The discipline reaches the surface.',
  },

  contents: [
    { n: '001', en: 'The dateline', jp: '今日の日付', tag: 'OPENING' },
    { n: '002', en: 'C2PA as a provenance primitive', jp: 'C2PAという証明基盤', tag: 'PATTERN' },
    { n: '003', en: 'Same substrate, different audience', jp: '同じ基盤、違う観客', tag: 'CONNECTION' },
    { n: '004', en: 'What this confirms for the discipline', jp: '専門にとっての意味', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELDWORK SPREAD · 消費者標準',
    title: 'On the Consumer Standard.',
    titleJp: '消費者標準について。',
    deck: 'At Google I/O 2026 today (21 May), Google embedded C2PA Content Credentials verification directly into Gemini, with rollout to Search and Chrome over coming months. The cryptographic provenance standard for media — camera-of-origin, edit history, AI-generated marker — becomes default-on across the consumer internet. This issue reads the moment provenance engineering, named in ISSUE 381 as the engineering discipline of regulated-industry substrate, crosses into default-on consumer UX. Same primitive; different audience; same name.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE DATELINE',
        headingJp: '今日の日付',
        paragraphs: [
          'Google I/O 2026 keynote, 21 May. Among the hundred-odd announcements (Gemini 3.5 Flash GA, Gemini Spark general-purpose agent, AI Search agents worldwide), one line landed for substrate engineers: C2PA Content Credentials verification embedded in the Gemini app starting today, rolling out to Search and Chrome in coming months.',
          'C2PA — the Coalition for Content Provenance and Authenticity — is the cryptographic standard for proving what a piece of media is, where it came from, and how it was edited. Adobe shipped the first reference implementation in 2021; Sony, Nikon, and Leica embedded it in cameras over 2024-2025; the standard itself has been mature for years. What was missing was default-on consumer surface. Today\'s Google move closes that gap.',
          'In the eight days following ISSUE 381 (the provenance engineering naming), we read three external validators of the substrate pattern (Alexa Buy-for-Me, Anthropic Glasswing, the Five Eyes guidance — 382, 383, 384). ISSUE 390 reads the fourth, eleven days after 381: the consumer surface.',
        ],
      },
      {
        heading: 'C2PA AS A PROVENANCE PRIMITIVE',
        headingJp: 'C2PAという証明基盤',
        paragraphs: [
          'Reduce C2PA to its primitive: a cryptographically signed assertion bundle attached to a piece of content, describing what happened to that content and who attested to each step. The bundle is content-addressed; the signatures are verifiable; the chain of edits is auditable. Same shape as the audit envelopes that kbot-finance attaches to AI agent actions in regulated industries.',
          'The disciplines look different because the audience is different. C2PA users are smartphone owners checking whether the photo in their feed is real. Provenance engineering users are compliance officers checking whether an AI agent\'s action can be replayed under audit. The standard primitive — content-addressed assertions plus cryptographic signatures plus replayable edit chains — is the same.',
          'Where the disciplines connect: the agentic-engineering surface where AI generates content (text, code, image, video, voice). An AI agent producing content under provenance-engineering substrate should be emitting C2PA-compatible assertions on the output, so the same substrate that proves the agent\'s action to a regulator also proves the artifact\'s origin to a consumer. The substrate stacks.',
        ],
      },
      {
        heading: 'SAME SUBSTRATE, DIFFERENT AUDIENCE',
        headingJp: '同じ基盤、違う観客',
        paragraphs: [
          'Three substrate-engineering disciplines coined and held by kernel.chat (provenance engineering, agent-OS, orchestration engineering) plus the fourth named in 389 (agent fidelity engineering) all operate underneath the agent. The consumer never sees them directly; the consumer sees the artifact.',
          'C2PA is the first widely-deployed example of substrate-becoming-visible. The badge in the Gemini app saying "this photo is unaltered original" or "this image was edited by Photoshop on 2026-05-15 at 14:22 UTC" is provenance-engineering substrate emerging as a glyph users tap. The Google moves this through Gemini, then Search, then Chrome — the consumer entry-points for a billion users.',
          'For the magazine, this changes the editorial frame slightly. The discipline named for engineers in 381 needs an editorial line for the consumer-facing manifestations the discipline produces. Not a new discipline; a new beat for the existing one. Subsequent fieldwork issues will read consumer-surface provenance pieces (TikTok\'s upcoming AI-generated-content disclosure rules, Adobe Firefly\'s provenance defaults, the EU AI Act\'s consumer-facing labelling requirements) under the same discipline name.',
        ],
      },
      {
        heading: 'WHAT THIS CONFIRMS FOR THE DISCIPLINE',
        headingJp: '専門にとっての意味',
        paragraphs: [
          'Three confirmations from today\'s announcement, in increasing order of significance.',
          'First: the substrate primitive is correctly identified. C2PA and provenance engineering converge on the same shape (content-addressed signed assertion bundles plus replayable edit chains plus audience-specific verification UX). The convergence is independent — C2PA emerged from camera manufacturers; provenance engineering emerged from regulated-industry AI. The same primitive arrived at from different problems is the strongest possible signal that the primitive is real.',
          'Second: the audience expansion path is real. Provenance engineering as named is engineer-facing. C2PA as deployed is consumer-facing. The same primitive serving both audiences means the discipline isn\'t niche to regulated industry — it generalizes to any context where "prove what this content is" matters. The magazine\'s long-arc bet just got broader.',
          'Third: the substrate becoming default-on at consumer scale changes the timeline. Eleven days from naming the discipline to seeing it deployed as a glyph in a billion-user consumer surface. The arc kernel.chat said would take five years already has its consumer entry point. Other branches (agent fidelity, agent-OS) will likely follow faster than originally projected.',
          '街のコーダーたちへ — 基盤は表に出る。私たちが名乗ったものは、今日、消費者の画面に降りた。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 基盤は表に出る。私たちが名乗ったものは、今日、消費者の画面に降りた。',
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

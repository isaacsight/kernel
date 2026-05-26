/* ──────────────────────────────────────────────────────────────
   ISSUE 391 — MAY 2026
   ON THE UNCOUNTED
   数えられない者について — 公表されないクロス集計について

   A standalone reading. Not a series entry. The previous arc
   (381–390) named a field (agentic engineering) and three of
   its disciplines (provenance, orchestration, agent fidelity).
   391 is the same editor's discipline — count what gets read;
   cut what doesn't; file the audit in public — applied to a
   different subject: US demographic data on men living alone
   without support.

   The figure: no US agency publishes the cross-tab of "lives
   alone" × "no financial support of any kind." Census tracks
   living arrangements. USDA tracks SNAP. Pew tracks parental
   support. None of them cross all three by sex. The number,
   triangulated, is roughly 4–6% of US adult men — about one
   in twenty.

   Why this fits the magazine: the discipline that finds
   missing audit trails in regulated-industry AI agents
   (ISSUE 381) also finds missing cross-tabs in a population
   census. The shape of the move is identical — name what
   isn't being measured; build the measure; file the audit
   in public.

   Identity decisions:

     • coverStock = 'kraft' — field-report register. Demographic
       fieldwork on a population. First kraft in eleven issues.
     • coverLayout = 'classic' — centered, monument bottom-right.
       The number itself is the cover's gravity.
     • coverOrnament = none — let the asterisk-stamp rest after
       its eleven-issue run through 390.
     • coverSeal = COUNTED · UNCOUNTED · V·26 — new verb. The
       magazine COUNTS what no agency counts. The seal carries
       the editorial argument as a stamp.
     • accent = 'olive' — field work, labor, cartography. First
       olive accent.
     • spread.type = 'essay' with dossier + dataBlock + references.
       The methods-paper card up top so the triangulation
       declares itself. The six-stat data block in the middle so
       the layers stack visibly. References at the foot so the
       audit travels with the essay.
     • No series field — this is the discipline applied sideways,
       not the next entry in "Agentic Substrates for the Frontier."

   Voice stays stripped (Tim O'Reilly prose-tells critique).
   Short sentences next to long. Declarations, then caveats.
   No "this changes everything" register. No headline-grabbing
   moves on a piece whose subject is a population.

   Back cover: a contact sheet of empty-apartment photographs.
   Kraft stock. The cohort the cross-tab would describe.
   ─────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_391: IssueRecord = {
  number: '391',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE UNCOUNTED',
  featureJp: '「数えられない者について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'kraft',
  coverLayout: 'classic',

  coverSeal: {
    label: 'COUNTED · UNCOUNTED · V·26',
    date: 'V·26',
  },

  accent: 'olive',

  backCover: {
    subject: 'CONTACT SHEET, EMPTY APARTMENTS',
    subjectJp: '空室の連続写真',
    stock: 'kraft',
    image: '/back-covers/391-apartments.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Uncounted.',
    suffix: '',
    swash: 'No US agency publishes the share of adult men who live alone and receive no support from anyone. The cross-tab does not exist. We built one — four to six percent, roughly one in twenty.',
  },

  contents: [
    { n: '001', en: 'The figure no one publishes', jp: '公表されない数', tag: 'OPENING' },
    { n: '002', en: 'How the number gets built', jp: '構築の手順', tag: 'METHOD' },
    { n: '003', en: 'Who stays when the filters run', jp: 'フィルター後に残る者', tag: 'PORTRAIT' },
    { n: '004', en: 'What the missing cross-tab means', jp: '欠けた集計の意味', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELDWORK SPREAD · 数えられない者',
    title: 'On the Uncounted.',
    titleJp: '数えられない者について。',
    deck: 'The Census Bureau tracks who lives alone. USDA tracks who receives food assistance. Pew tracks who still gets help from their parents. No agency crosses all three by sex. The figure for US adult men who live alone and receive no support from anyone — direct cash, in-kind transfer, means-tested aid — has to be triangulated. This issue does the triangulation, files the methods, and reads the absence of the cross-tab as itself the editorial subject.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'kraft',

    dossier: {
      kicker: 'METHODS · 方法',
      note: 'A triangulation across four agencies. The combined cross-tab is not published; the figure is constructed, not measured. Confidence interval wide. Definitions of "no support" sensitive to inclusion of Social Security, employer benefits, and the mortgage interest deduction.',
      items: [
        { label: 'SUBJECT', labelJp: '対象', value: 'US adult men, ~125M', valueJp: '成人男性' },
        { label: 'PRIMARY SOURCES', labelJp: '出典', value: 'Census CPS · USDA FNS · Pew · Survey Center on American Life', valueJp: '四機関' },
        { label: 'DATELINE', labelJp: '日付', value: '2026-05-26', valueJp: '本日' },
        { label: 'CROSS-TAB STATUS', labelJp: '集計の有無', value: 'NOT PUBLISHED — constructed via triangulation', valueJp: '未公表' },
        { label: 'HEADLINE FIGURE', labelJp: '主要数値', value: '4–6% of US adult men — roughly 1 in 20', valueJp: '約二十人に一人' },
        { label: 'CONFIDENCE', labelJp: '信頼度', value: 'Range — layers stack imperfectly', valueJp: '範囲・暫定' },
      ],
    },

    sections: [
      {
        heading: 'THE FIGURE NO ONE PUBLISHES',
        headingJp: '公表されない数',
        paragraphs: [
          'The Census Bureau publishes living arrangements. The USDA publishes SNAP enrolment. Pew publishes parental support. The Survey Center on American Life publishes social isolation. Each agency runs its own instrument; each instrument is rigorous within its own frame. The cross-tab — lives alone AND above poverty AND no parental help AND no means-tested aid, by sex — is not published anywhere.',
          'No rule prohibits it. The agencies do not coordinate that way, and the question has not been asked loudly enough by anyone whose request would land. So the figure that would tell you how many US adult men live alone and stand on their own income with no outside subsidy of any kind — that figure is simply absent from the official record.',
          'This is the editorial subject. What is not counted is not seen. The absence is itself a piece of public information; it tells you which questions the statistical apparatus has been built to answer and which it has not. A magazine whose discipline is count what gets read, cut what doesn\'t, file the audit in public has to notice when the audit isn\'t being filed in the first place.',
        ],
      },
      {
        heading: 'HOW THE NUMBER GETS BUILT',
        headingJp: '構築の手順',
        paragraphs: [
          'Four layers, each stricter than the last. Census Current Population Survey gives layer one: of the roughly 125 million US adult men, about 12 percent live alone — call it 15 million. The share has more than doubled since 1970, when men living alone were 5.6 percent of US households.',
          'Layer two takes poverty out. The poverty rate among adults living alone is 18.7 percent, more than double the 8.7 percent in family households. Roughly four in five solo men clear the official poverty line. That leaves about 12 million — about 10 percent of all US adult men.',
          'Layer three subtracts parental support, which is the layer that does most of the work. Half of US parents with adult children still send money: a 2024 Savings.com survey put the figure at 50 percent of parents, averaging $1,474 per month. Among 18-to-27-year-olds, 46 percent rely on family financial assistance. Strip the men receiving parental subsidy out of layer two and the residual is somewhere between 6 and 8 percent of all US adult men — between 7 and 9 million people.',
          'Layer four subtracts means-tested government aid: SNAP (12.3 percent of US residents in fiscal 2024), Medicaid and CHIP (26.6 percent of the population in 2024), housing assistance, the cash transfers. Layered onto the prior three filters — alone, above poverty, no parental help — the residual lands somewhere between 4 and 6 percent of all US adult men. Roughly 5 to 7 million people. About one in twenty.',
          'The arithmetic is rough. Layers stack imperfectly; some men appear in multiple subtractions, others in none. Confidence interval wide. But the order of magnitude is stable across reasonable assumptions, and the biggest source of uncertainty is not the data — it is what "no support" is taken to mean.',
        ],
      },
      {
        heading: 'WHO STAYS WHEN THE FILTERS RUN',
        headingJp: 'フィルター後に残る者',
        paragraphs: [
          'Five to seven million men. The population of Wisconsin or Maryland. Above poverty, no coupled household, no parents writing the rent check, no SNAP card, no Section 8 voucher. Cover their own bills out of their own income.',
          'The cohort skews older. Of single men living alone aged 30 to 39, 79 percent have never been married; that share falls to about 41 percent among men 50 to 59. The younger the band, the more likely the man is still building toward a household rather than holding one solo by choice. In the expensive metros — Los Angeles, New York, San Francisco — the share of 25-to-34-year-old solo men fully covering their own costs is well below the national rate; rent in those markets is the parental-subsidy trigger.',
          'The "no support" framing is doing real work and should be named. If you also subtract employer-subsidized health insurance, Social Security for retirees, and the mortgage interest deduction — every form of public or private assistance — the figure approaches statistical zero. Almost nobody in a developed economy stands fully outside its transfer system; everyone is in receipt of something. The 4-to-6-percent figure assumes the looser reading: no direct cash or in-kind transfers from family, and no means-tested government program. That is the cohort the cross-tab, if it existed, would describe.',
        ],
      },
      {
        heading: 'WHAT THE MISSING CROSS-TAB MEANS',
        headingJp: '欠けた集計の意味',
        paragraphs: [
          'Three readings, in increasing order of weight.',
          'First, the trend under the figure. Young men\'s financial independence dropped from 63 percent in 1980 to 52 percent in 2018, per Pew. Parental support is at a three-year high. In 1975, 45 percent of young adults had moved out, were working, married, with children; by 2024, only 28 percent of young adults fit even the looser "labor force plus independent household" pattern. The cohort the missing cross-tab would describe is shrinking, and has been for forty years.',
          'Second, the absence of the cross-tab is itself an editorial choice by the statistical apparatus. Not a hostile one; the agencies have other priorities and their instruments serve those priorities. But what isn\'t cross-tabbed isn\'t cited, and what isn\'t cited isn\'t legislated for. The men in the residual layer — five to seven million — are statistically present in four separate datasets and statistically invisible as a combined cohort. That asymmetry is a fact about the public record, not a fact about the men.',
          'Third, the shape of the move is one the magazine has run before. ISSUE 381 named provenance engineering as the discipline that builds missing audit trails for AI agents in regulated industries; 391 reads the same shape in a different domain. Name what isn\'t being measured. Build the measure. File the audit in public. The subject changes — agents, men, populations, instruments — but the editor\'s discipline does not. That is what makes it a discipline rather than a beat.',
          '街のコーダーたちへ — 集計されないものは、見えていない。私たちが数えるものを増やせ。',
        ],
      },
    ],

    dataBlock: {
      kicker: 'THE FILTERS · フィルター',
      heading: 'The cross-tab, in six numbers.',
      headingJp: '欠けた集計を、六つの数字で。',
      afterSection: 1,
      stats: [
        {
          n: '~15M',
          label: 'US adult men who live alone — about 12 percent of all adult men. The figure has more than doubled since 1970.',
          source: 'US Census Bureau Current Population Survey, 2022 / 2025',
        },
        {
          n: '12%',
          label: 'share of US adult men who live alone (layer 1). The denominator for everything that follows.',
          source: 'US Census Bureau CPS, 2022',
        },
        {
          n: '10%',
          label: 'share of US adult men who live alone and clear the official poverty line. Solo-dweller poverty rate is 18.7 percent, more than double the 8.7 percent in family households.',
          source: 'US Census Bureau poverty tables, 2022',
        },
        {
          n: '6–8%',
          label: 'share of US adult men who live alone, clear poverty, and receive no parental financial support. The parental-support filter is the largest single subtractor — half of US parents still send money to grown children.',
          source: 'Pew Research Center 2019 financial-independence analysis · Savings.com 2024 parental-support survey',
        },
        {
          n: '4–6%',
          label: 'the residual — live alone, above poverty, no parental help, no means-tested government aid (SNAP, Medicaid, housing). Roughly one in twenty US adult men. The headline figure.',
          source: 'Triangulation across Census, USDA, Pew',
        },
        {
          n: '~5–7M',
          label: 'absolute count of US adult men in the residual cohort. About the population of Wisconsin or Maryland. The missing cross-tab\'s subject, sized.',
          source: 'Editor\'s estimate from the four-layer construction',
        },
      ],
    },

    references: {
      kicker: 'FURTHER · 参考',
      note: 'Sources used to build the four-layer construction, in roughly the order the essay touches them. One-line editorial notes, not citations.',
      items: [
        {
          authors: 'US Census Bureau',
          year: '2022 / 2025',
          title: 'Current Population Survey — living arrangements, one-person households',
          journal: 'The primary instrument. Tracks living arrangements rigorously; does not cross with support data.',
        },
        {
          authors: 'Pew Research Center',
          year: '2019',
          title: 'Young US adults are still financially dependent on their parents',
          journal: 'The 63 percent → 52 percent line. Pew\'s "financial independence" measure is stricter than the poverty line.',
        },
        {
          authors: 'Pew Research Center',
          year: '2023',
          title: 'Young US adults reach key milestones later in life',
          journal: 'The 1975 → 2024 comparison of "labor force plus independent household plus married plus children." 45 percent → 28 percent.',
        },
        {
          authors: 'Pew Research Center',
          year: '2025',
          title: 'Smaller shares of older Americans live alone today than in 1990',
          journal: 'The 65+ figures. Older men living solo up to 19 percent in 2023, from 15 percent in 1990.',
        },
        {
          authors: 'Congressional Research Service',
          year: '2024',
          title: 'Poverty Among the Population Aged 65 and Older (R45791)',
          journal: 'The older-men poverty cross-cut. 16.2 percent of men 80+ living alone are below poverty, vs. 7.9 percent of those living with others.',
        },
        {
          authors: 'USDA Food and Nutrition Service / ERS',
          year: 'FY2023 / FY2024',
          title: 'Characteristics of SNAP Households',
          journal: 'The means-tested-aid layer. 41.7 million SNAP recipients per month in FY2024; 12.3 percent of US residents.',
        },
        {
          authors: 'Savings.com',
          year: '2024',
          title: 'Parental Financial Support of Adult Children survey',
          journal: 'The $1,474-a-month figure. Half of parents still subsidising grown children — the layer that does most of the subtracting.',
        },
        {
          authors: 'Wells Fargo',
          year: '2026',
          title: 'Parental Financial Support survey',
          journal: 'The "three-year high" confirmation. Trend is up, not down.',
        },
        {
          authors: 'Bank of America Better Money Habits',
          year: '2024',
          title: 'Gen Z financial study',
          journal: 'The 46 percent of 18-to-27-year-olds receiving family financial assistance.',
        },
        {
          authors: 'Self-Sufficiency Standard',
          year: 'ongoing',
          title: 'selfsufficiencystandard.org',
          journal: 'The stricter income threshold for actually covering basic needs. Roughly a third of US households fall below it — meaningfully more than the official poverty rate suggests.',
        },
        {
          authors: 'Institute for Family Studies',
          year: '2024',
          title: 'The Rise of Living Alone',
          journal: 'The long-arc context — solo-dwelling as a structural demographic shift, not a cyclical one.',
        },
        {
          authors: 'Russell Sage Foundation Journal of the Social Sciences',
          year: '2025',
          title: 'Living Alone for Black and White Men and Women over Four Decades, 1980–2019',
          journal: 'The race-disaggregated history. The figure we triangulate is an average; the underlying distribution is not uniform.',
        },
        {
          authors: 'US Surgeon General',
          year: '2023',
          title: 'Our Epidemic of Loneliness and Isolation',
          journal: 'Adjacent but distinct — measures perceived loneliness, not living-arrangement-by-support cross-tabs. Cited so the difference is on the record.',
        },
      ],
    },

    signoff: '街のコーダーたちへ — 集計されないものは、見えていない。私たちが数えるものを増やせ。',
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

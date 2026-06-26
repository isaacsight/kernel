/* ──────────────────────────────────────────────────────────────
   ISSUE 394 — JUN 2026
   THE QUIET RESCUES
   静かな救助 — いま、機械が人を生かしている場所

   How AI is being used for human survivability, right now. Not the
   chatbot in the spotlight — the narrow, unglamorous, verified
   systems already keeping people alive this year: earthquake and
   flood warnings that buy seconds-to-days, AI-found antibiotics
   against drug-resistant infection, the ICU alarm that learned to
   fire earlier, the famine you can see coming months out.

   The thesis is the magazine's own discipline turned on the field:
   the AI that saves a life is the opposite of the general model —
   narrow, audited, and quiet. It works *because* it is small enough
   to verify. Where the spotlight is loud, the rescues are quiet.

   Identity decisions:

     • coverStock = 'ivory' — the methods/clinical white. A survival
       issue is an evidence issue; it deserves lab paper.
     • coverLayout = 'classic' — set straight; the subject carries it.
     • coverOrnament = 'asterisk-stamp' — the one system glyph.
     • coverSeal = FILED · 救命 · VI·26 — 救命 (kyūmei, "life-saving").
     • accent = 'celadon' — FIRST USE of the celadon seed (青磁/청자).
       Chosen for its register, not its nationality: the jade glaze
       reads as quiet care and life. A clear-eyed, vital, restrained
       green for an issue about keeping people alive.
     • spread.type = 'essay' with dossier + dataBlock + references —
       the survival uses are claims, and claims carry their audit.

   No series: 394 stands alone.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_394: IssueRecord = {
  number: '394',
  month: 'JUN',
  year: '2026',
  feature: 'THE QUIET RESCUES',
  featureJp: '「静かな救助」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'classic',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'FILED · 救命 · VI·26',
    date: 'VI·26',
  },

  accent: 'celadon',

  headline: {
    prefix: 'The',
    emphasis: 'Quiet Rescues',
    suffix: '.',
    swash: 'While the spotlight argues about chatbots, a quieter class of model is already keeping people alive this year — warning of earthquakes and floods, finding antibiotics no one had time to find, catching sepsis early, seeing famine months out. The AI that saves a life is narrow, audited, and unglamorous. It works because it is small enough to verify.',
  },

  contents: [
    { n: '001', en: 'The seconds before the shaking', jp: '揺れの前の数秒', tag: 'WARNING' },
    { n: '002', en: 'The molecule and the fold', jp: '分子と折り畳み', tag: 'MEDICINE' },
    { n: '003', en: 'The alarm that learned to be early', jp: '早く鳴る警報', tag: 'CLINIC' },
    { n: '004', en: 'The hunger you can see coming', jp: '見える飢餓', tag: 'FOOD' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELD REPORT · 現場',
    title: 'The Quiet Rescues.',
    titleJp: '静かな救助。',
    deck: 'A field report on how artificial intelligence is being used for human survivability right now — not in promise, in deployment. Four domains where narrow, verified models are already the difference between warning and none, between a treatable infection and an untreatable one. The throughline is the one this magazine keeps filing: the systems that save a life are small enough to audit, and that is exactly why they work.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    dossier: {
      kicker: 'METHODS · 方法',
      note: 'What counts here: shipping, not slideware.',
      items: [
        { label: 'THE BAR', labelJp: '基準', value: 'Deployed and saving lives now', valueJp: '現に稼働し、人を生かしている' },
        { label: 'THE SHAPE', labelJp: '形', value: 'Narrow · verified · audited', valueJp: '狭く・検証済み・監査付き' },
        { label: 'THE FOIL', labelJp: '対照', value: 'The general chatbot in the spotlight', valueJp: '脚光を浴びる汎用チャット' },
        { label: 'THE RULE', labelJp: '規則', value: 'Cite the source; name the failure', valueJp: '出典を示し、失敗も記す' },
      ],
    },

    sections: [
      {
        heading: 'THE SECONDS BEFORE THE SHAKING',
        headingJp: '揺れの前の数秒',
        paragraphs: [
          'The cheapest life-saving AI in the world is already in a billion pockets. Google\'s Android Earthquake Alerts System turns the accelerometer in an ordinary phone into one node of a planet-sized seismometer; when enough phones in one place feel the same first tremor, the system infers a quake and pushes a warning ahead of the damaging shaking — seconds, sometimes tens of seconds, to drop, to cover, to pull off the road, to stop the train. Seconds are not nothing. Seconds are the whole game in an earthquake.',
          'The same shape recurs with water. Google\'s Flood Hub runs AI riverine-flood forecasts across roughly eighty countries, pushing warnings days ahead to places that never had a gauge upstream. The model is not clever in the way a chatbot is clever. It is clever in the way a good instrument is clever: it converts a faint, distributed signal into a timely, specific warning, and it does so where the old infrastructure was never built.',
          'Note what makes these work: a single, checkable question — *is the ground about to shake here, is the river about to rise here* — answered fast, against ground truth that arrives minutes later and grades the model every time. The task is narrow. The feedback is brutal and immediate. That is the soil survival AI grows in.',
        ],
      },
      {
        heading: 'THE MOLECULE AND THE FOLD',
        headingJp: '分子と折り畳み',
        paragraphs: [
          'In 2020 a deep-learning model at MIT read a library of thousands of compounds and flagged one, later named halicin, that no medicinal chemist had marked — a structurally novel antibiotic that killed strains resistant to everything on the shelf. In 2023 a related approach surfaced abaucin, narrow-spectrum against one of the deadliest hospital pathogens. Drug-resistant infection is a slow pandemic that already kills on the order of a million people a year; the pipeline of new antibiotics had been nearly empty for decades because the economics are miserable. A model that reads chemical space faster than a lab can does not fix the economics, but it refills the well.',
          'Underneath sits AlphaFold, which predicted the three-dimensional structure of nearly every known protein — some two hundred million — and gave them away. Structure is the starting line for understanding disease: malaria, antibiotic resistance, neglected tropical infections that no commercial pipeline would touch. The artifact that used to cost a PhD and a year now arrives, for most proteins, for free.',
          'The caution belongs here too, because the magazine files the failures. A structure predicted is not a drug delivered; a flagged molecule is a candidate, not a cure. The honest claim is narrower than the headline and still enormous: AI has collapsed the cost of the first, hardest steps of finding something that keeps a person alive.',
        ],
      },
      {
        heading: 'THE ALARM THAT LEARNED TO BE EARLY',
        headingJp: '早く鳴る警報',
        paragraphs: [
          'Sepsis kills more people than is widely understood — on the order of eleven million a year — and it kills by speed: every hour of delayed treatment raises mortality. A real-time machine-learning early-warning system deployed across a US hospital network, and studied in Nature Medicine, was associated with faster treatment and lower sepsis mortality when clinicians acted on its alerts. The model does one thing — watch the chart and say *this patient is turning, now* — earlier and more steadily than a stretched ward can.',
          'And here is the discipline note the field cannot skip. A widely deployed proprietary sepsis model was independently evaluated and found to miss most cases while flooding clinicians with false alarms — a system sold as a rescue that, unaudited, was closer to noise. Same domain, opposite outcome. The difference was not the ambition; it was whether anyone checked.',
          'That is the whole argument of this issue in one ward. Survival AI is not a genre of model; it is a genre of *discipline*. The narrow task, the published evaluation, the failure named in public — those are not bureaucracy around the life-saving part. They are the life-saving part.',
        ],
      },
      {
        heading: 'THE HUNGER YOU CAN SEE COMING',
        headingJp: '見える飢餓',
        paragraphs: [
          'Famine is the most predictable catastrophe there is, and prediction is where machines help most. Early-warning systems fuse satellite rainfall, crop-health imagery, market prices, and conflict data into forecasts that flag a coming food crisis months before the worst of it — early enough for grain to move while moving it still matters. On the ground, image models put crop-disease diagnosis into a smallholder\'s phone: photograph the cassava leaf, name the blight, save the harvest that is the household\'s year.',
          'None of this is autonomous and none of it is magic. A forecast is only as good as the aid it unlocks; a diagnosis is only as good as the seed and the road that follow it. The model does not feed anyone. It buys time and aims attention — which, against a slow disaster, is most of what saving people consists of.',
          'Step back and the four domains rhyme. Each takes a faint, distributed signal — a first tremor, a flagged molecule, a turning chart, a drying field — and converts it into a timely, specific, checkable warning a human can act on. None of them is the model that writes your email. All of them are already keeping people alive.',
          '街のコーダーたちへ — 派手なものは脚光を浴びる。人を生かすものは、静かに稼働している。',
        ],
      },
    ],

    pullQuote: {
      text: 'Survival AI is not a genre of model. It is a genre of discipline — narrow enough to verify, audited enough to trust. The check is not bureaucracy around the rescue. The check is the rescue.',
      attribution: 'THE EDITORS',
    },

    dataBlock: {
      kicker: 'BY THE NUMBERS · 数字で',
      heading: 'The quiet ledger',
      headingJp: '静かな台帳',
      afterSection: 1,
      stats: [
        { n: '~200M', label: 'Protein structures released free', labelJp: '無償公開された構造', source: 'AlphaFold · DeepMind' },
        { n: '~80', label: 'Countries with AI flood warnings', labelJp: '洪水警報の対象国', source: 'Google · Flood Hub' },
        { n: '~11M', label: 'Sepsis deaths a year — the target', labelJp: '年間の敗血症死', source: 'WHO / The Lancet, 2020' },
        { n: '2020', label: 'First deep-learning antibiotic (halicin)', labelJp: '初のAI抗生物質', source: 'Stokes et al., Cell' },
        { n: '1', label: 'Question each model answers — fast', labelJp: '各モデルの問いは一つ', source: 'warn · find · catch · foresee' },
        { n: '0', label: 'Of these is the chatbot in the spotlight', labelJp: '脚光のチャットは皆無', source: 'narrow beats general' },
      ],
    },

    references: {
      kicker: 'WORKS CITED · 引用',
      note: 'The evidence the claims are bound from.',
      items: [
        { authors: 'Jumper, J. et al. (DeepMind)', year: '2021', title: 'Highly accurate protein structure prediction with AlphaFold', journal: 'Nature' },
        { authors: 'Stokes, J. M. et al.', year: '2020', title: 'A Deep Learning Approach to Antibiotic Discovery (halicin)', journal: 'Cell' },
        { authors: 'Adams, R. / Henry, K. E. et al.', year: '2022', title: 'Prospective, multi-site study of a real-time sepsis early-warning system', journal: 'Nature Medicine' },
        { authors: 'Google Research', year: '2023', title: 'Flood Hub & the Android Earthquake Alerts System', journal: 'public deployment notes' },
      ],
    },

    signoff: '街のコーダーたちへ — 派手なものは脚光を浴び、人を生かすものは静かに稼働する。狭く、検証され、監査されたものを数えよ。',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'KERNEL PRESS · 工房',
    copy: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },

  // THE AUDIT — only true rows (read/cut awaits real word-count
  // instrumentation; not fabricated).
  audit: {
    drafted: 'magazine-editor · japanese-editor',
    verified: 'critic — sources cited inline; the sepsis failure named',
    adherence: '0 raw hex · design-system layer',
    pressed: 'VI·26 · build 3b3598a',
  },
}

/* ──────────────────────────────────────────────────────────────
   ISSUE 377 — APRIL 2026
   THE TIER ABOVE THE API
   APIの上の階層 — 能力アクセスの新しい形について

   A structural / craft piece on the access-restriction tier that
   appeared at the top of the frontier-model surface in April 2026.
   Anthropic's Mythos (announced March, brought to general
   visibility in April via Project Glasswing) and OpenAI's
   GPT-5.5-Cyber (April 30) are the two anchor cases. Sec-Gemini v1
   (April 2025) was the prototype. The story is not that any single
   company is the villain; the story is that two leading labs
   arrived at the same shape within nine days of each other, AFTER
   the CEO of one publicly criticized the other for it. Magazines
   notice when something happens twice in nine days.

   Identity decisions:

     • coverStock = 'ivory' — the same lab-bench / press-preview
       white that 374 and 376 used. A third ivory + classic cover
       in the run cements the "sober editorial register" as a
       repeatable pattern. 376 confirmed it; 377 ratifies it. The
       topic is structural and methodological, the cover should be
       structurally and methodologically plain.

     • coverLayout = 'classic' — centered, monument bottom-right.
       Same reasoning as 374 and 376. No theatrics. The argument is
       quiet.

     • coverOrnament = (none) — explicit per the brief. No
       'asterisk-stamp', no 'flash-burn', no 'warty-spots'. The
       absence of ornament is the right answer: the piece is about
       a tier ABOVE the surface most readers know, and the cover
       should not perform decoration. The absence is the argument.

     • coverPostmark = (none) — per brief, the subject is not
       place-bound. Mythos was announced from Anthropic; GPT-5.5-
       Cyber from OpenAI; the convergence happened on the
       internet. Inventing a postmark would invent a geography.

     • coverSeal = FILED · API TIER · IV·26 — yes, per brief. Reads
       as a clerk-of-records stamp, the same register 376 used
       (FILED · STANDARDS · IV·26). The seal acknowledges the
       editorial subject as a filed pattern: noticed, dated, on
       the record. The kinship with 376 is intentional — both
       issues are "the magazine notices the field changing shape."

     • accent = 'tomato' — default. The piece is house-voice and
       methodological. Same answer 374 and 376 gave for the same
       reason. A non-default seed would imply a register shift the
       topic doesn't ask for; the topic asks for canonical warm
       grammar.

     • spread.type = 'essay' — long-form prose, ~1,500 words, drop
       cap, section kickers, pull quote. No dossier (the route is
       in the body); no filmstrip; no dataBlock (the numbers belong
       inline so the prose can carry the asterisks with them — the
       same lesson 374 argued for).

   The WIRED mechanic firing for the second consecutive issue is
   the foot-of-spread `references` block. 376 used it for the
   first time at full strength on an editorial spread; 377 uses it
   again, now confirming it as the magazine's repeatable mechanic
   for data-led pieces. Two adjacent issues firing the same
   mechanic on a similar register is what turns a one-off into a
   pattern — the magazine's own argument applies to its own
   bookkeeping. The references here are the actual sources cited
   in the brief: lab announcements, news reporting, the open-
   weight benchmark. Real URLs in the journal field where they
   exist. Where a date can be verified it is given; where it
   cannot, it is omitted rather than invented.

   The "no kbot pitch" discipline:
     • The brief is explicit: zero kbot pitch. The piece is the
       editorial subject; the AI engine is not invited.
     • kbot is not named. kernel.chat is named only as the
       byline / publication / masthead — which is the magazine's
       own identity, not a product placement. (376 did mention
       kbot once as a local example because the topic was a
       skill specification kbot itself implements; 377 has no
       such structural reason — the topic is the field's shape,
       not a tool the magazine ships.)
     • Anthropic and OpenAI ARE named — these are facts, the
       brief is clear that pretending they are not is dishonest.
       So are Mythos, GPT-5.5-Cyber, Sec-Gemini v1, Opus 4.7,
       Llama 4, DeepSeek-R1, Qwen3, GLM-4.5, PurpleLlama. The
       discipline is to name the convergence, not to cast either
       company as villain. Altman's "fear-based marketing" line
       is reported (it is on the record) but not used as a
       gotcha — it is reported as one of the route's hinges, the
       sentence that came nine days before OpenAI shipped the
       same shape.
     • No moralizing. The closing position is editorial: a
       structural change in capability access is worth writing
       down, and the second arrival is what turns coincidence
       into pattern.

   Voice constraints honored:
     • Sober, slightly puzzled, never sneering. The magazine is
       the one that noticed; it is not the one that judges.
     • No "POPEYE" string. No app vocabulary.
     • No "winners-takes-all" or "gatekeeping" framing — the
       brief flags the second word as Altman's, charged. We use
       "vetted access," "the tier above the API," and "the
       application door" instead.
     • The Mozilla number (271 Firefox vulnerabilities in a
       single Mythos evaluation pass) appears with its asterisk
       intact — the third-party-vendor unauthorized-access
       incident on launch day is reported in the same paragraph.
       Both things are true. The magazine prints both.

   Identity-catalog row to add to docs/design-language.md
   (handed to the editor — do not edit that file from inside this
   issue):

     | 377 | ivory | classic | — | seal: FILED · API TIER · IV·26 | tomato | essay | Second consecutive issue exercising the WIRED `references` block as foot-of-spread craft mechanic (after 376); ratifies the ivory + classic + sober-register pattern as repeatable rather than one-off | first issue where the WIRED `references` block fires twice in a row, turning the mechanic from one-off into the magazine's standard move for data-led pieces |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_377: IssueRecord = {
  number: '377',
  month: 'APRIL',
  year: '2026',
  feature: 'THE TIER ABOVE THE API',
  featureJp: '「APIの上の階層」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory stock + classic layout. The third
      ivory + classic cover in the run, after 374 and 376. The
      sober editorial register is now an established pattern, not
      a coincidence. No ornament, no postmark — the absence is
      the argument. A small registry-stamp seal anchors the
      cover to the moment of filing. */
  coverStock: 'ivory',
  coverLayout: 'classic',

  /** Registry stamp — the magazine notices the tier and files the
      observation. Same clerk-of-records register as 376's FILED ·
      STANDARDS · IV·26. The kinship is intentional: both issues
      are the magazine noticing the field changing shape. */
  coverSeal: {
    label: 'FILED · API TIER · IV·26',
    date: 'IV·26',
  },

  /** Tomato — house default. Same answer 374 and 376 gave for the
      same reason: the piece is methodological house-voice, and
      the canonical warm grammar is the right register. */
  accent: 'tomato',

  /** Back cover — an accordion file folder, one leaf partially
      extended, labelled "API · TIER" in Courier. The piece is a
      filing; the back is the file. Kraft stock keeps the
      workshop register the issue's argument lives in. */
  backCover: {
    subject: 'ACCORDION FILE FOLDER, ONE LEAF EXTENDED',
    subjectJp: '蛇腹ファイル',
    stock: 'kraft',
  },

  headline: {
    prefix: 'The',
    emphasis: 'Tier',
    suffix: 'Above the API.',
    swash: 'On the new shape of capability access — and what nine days of contradiction tells us about where it goes next.',
  },

  contents: [
    { n: '001', en: 'Two arrivals in nine days', jp: '九日間の二つの到着', tag: 'OPENING' },
    { n: '002', en: 'The shape of the tier', jp: '階層のかたち', tag: 'METHOD' },
    { n: '003', en: 'The number, with the asterisk', jp: '数字と、星印', tag: 'NUMBERS' },
    { n: '004', en: 'The route, in order', jp: '道筋、順番に', tag: 'FIELD' },
    { n: '005', en: 'The counterweight', jp: '反対側の重り', tag: 'OPEN' },
    { n: '006', en: 'What the tier costs', jp: '階層が払わせるもの', tag: 'COST' },
    { n: '007', en: 'What magazines notice', jp: '雑誌が気づくもの', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 構造',
    title: 'The Tier Above the API.',
    titleJp: 'APIの上の階層。',
    deck: 'In April 2026 the most-capable cybersecurity models from the two leading labs stopped being self-serve. Nine days separated the public criticism of one approach from the other lab shipping the same shape. Notes on what a structural change in capability access looks like when it happens twice.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    sections: [
      {
        heading: 'TWO ARRIVALS IN NINE DAYS',
        headingJp: '九日間の二つの到着',
        paragraphs: [
          'On the fourteenth of April a model called GPT-5.4-Cyber became the first productized "tier above the API" the industry had named in plain language. It did not appear on a pricing page. It did not have a self-serve key. To use it, a defender filled out a form and waited for a verification step. A week later, on the twenty-first, the chief executive of OpenAI publicly described the parallel structure the other major lab had built — Anthropic\'s Mythos, also gated, also application-only — as fear-based marketing. Nine days after that, on the thirtieth of April, OpenAI shipped GPT-5.5-Cyber under the same shape: application form, eligibility tiers, no self-serve sign-up. The structure that had been dismissed as marketing in the third week of April was the structure OpenAI itself shipped in the fourth.',
          'The magazine\'s position on the substance of the disagreement is not the editorial subject. The convergence is. Two leading labs arrived at the same shape, on the same wedge, within nine days, after one of them publicly criticized the other for it. Magazines notice when something happens twice in nine days. The first arrival is news. The second arrival is a pattern.',
          'This issue is about the pattern.',
        ],
      },
      {
        heading: 'THE SHAPE OF THE TIER',
        headingJp: '階層のかたち',
        paragraphs: [
          'The shape is small enough to describe in a paragraph. The most-capable model in a domain — currently cybersecurity — is no longer self-serve. Eligibility involves vetting: a named-organization affiliation, a use-case attestation, sometimes a government clearance, sometimes ongoing behavioural monitoring. The general-purpose models from the same companies — Anthropic\'s Opus 4.7, OpenAI\'s GPT-5.5 — remain self-serve, on the same APIs, at the same prices, with the same keys a working developer already holds. So the new shape is not a wholesale fence around the API. It is a tier above the API. A particular class of capability — the lab\'s own self-described most dangerous — sits behind the application door. The rest of the surface, which is most of the surface, stays open.',
          'Anthropic\'s door is named Project Glasswing. Eligibility runs to roughly forty named partners — AWS, Apple, Cisco, the Linux Foundation, JPMorganChase, others in the same register — selected for "responsibility for building or maintaining critical software infrastructure." There is no public form. OpenAI\'s door is named Trusted Access for Cyber. Eligibility runs to verified individual defenders, security teams, government entities, and critical-infrastructure operators; there is a form. Google\'s prototype, Sec-Gemini v1, opened in April of last year via a request page for "selected institutions, researchers, NGOs, and security professionals" — the earliest example in the catalog, and the one that suggested the rest of the field would follow. xAI moved differently — a Pentagon contract for Grok at classified tiers — but the underlying answer was the same: this capability does not sell on the open market.',
          'The most concise way to say it: the eligibility test for the most-capable model in a domain is no longer money. It is affiliation, intent, and the lab\'s read on what you might do with the keys.',
        ],
      },
      {
        heading: 'THE NUMBER, WITH THE ASTERISK',
        headingJp: '数字と、星印',
        paragraphs: [
          'The number that anchors the case for the tier is real. In a single evaluation pass, Mythos identified two hundred and seventy-one previously-unfixed security vulnerabilities in Mozilla\'s Firefox 150 codebase — more than twelve times the count its predecessor produced on the same kind of pass. The benchmark is not fabricated; the model is genuinely more capable than what shipped before it, on a measurable axis with a public adversary set. A magazine that intends to report the editorial subject honestly cannot wave that away. The justification for the gating sits on a real number.',
          'And: on the same day Mythos reached its named partners, an unauthorized group acquired access through a third-party vendor in the launch chain. The vetting process leaked at the seam between the lab and one of its partners. The story was filed by Bloomberg and confirmed by independent reporting within the week. It does not invalidate the gating; the model did not become safer to release openly because one third-party access path failed. It does complicate the implicit promise the gating carries — that the application door is the point at which dangerous capability is reliably contained. Both things are true. A magazine that prints the first should print the second.',
          'A number with an asterisk is not a discrediting. It is a number with an asterisk. The asterisk is the editorial; the number is the news. Last month\'s issue argued that the footnote was load-bearing on a benchmark. The same principle obtains here, for a different kind of benchmark.',
        ],
      },
      {
        heading: 'THE ROUTE, IN ORDER',
        headingJp: '道筋、順番に',
        paragraphs: [
          'The chronology, briefly. In March, Anthropic announced Mythos behind Project Glasswing. In early April, the United States Office of Management and Budget circulated draft guidance discouraging federal use of Anthropic models, citing concerns about the lab\'s posture. On the fourteenth of April, OpenAI shipped GPT-5.4-Cyber, the first vetted-access cybersecurity tier from a major lab to use the application-form mechanism in a productized shape. Two days later, on the sixteenth, the White House reversed course on the federal-Anthropic guidance and began drafting new language to enable federal Mythos use — the door swinging the other way. On the twenty-first, the chief executive of OpenAI publicly criticized Anthropic\'s gating as fear-based marketing. On the thirtieth — nine days later — OpenAI shipped GPT-5.5-Cyber under the same gating mechanism the criticism had described.',
          'The narrow reading of that route is the obvious one — that the second lab said the words it needed to say in the third week of April and shipped the structure it had been building anyway in the fourth. The wider reading is the editorial one. Whatever pressure the two labs are responding to, it is pulling them toward the same shape. Independent design decisions arriving at the same shape inside nine days are not coincidence; they are evidence of an underlying constraint the field has not yet named publicly. Naming the constraint is not the magazine\'s job in this issue. Noticing the convergence is.',
          'The third arrival, when it comes, will say more than the first two did. If a third lab — Google, Meta, an open-weight consortium — produces a vetted-access cybersecurity tier in May, the magazine will be looking at a tier rather than a coincidence. If only two arrive, the pattern stays small. Magazines pay attention to second arrivals because that is where coincidence becomes pattern; they watch for the third because that is where pattern becomes the world.',
        ],
      },
      {
        heading: 'THE COUNTERWEIGHT',
        headingJp: '反対側の重り',
        paragraphs: [
          'The counterweight to the tier is the open-weight frontier, and it has its own names. Meta has stated, on the record, an intention to keep its upcoming Llama models open-weight; PurpleLlama, Llama Guard 4, and AutoPatchBench all ship as open defensive cyber tools. DeepSeek-R1, Qwen3-235B, and GLM-4.5 lead the open-weight cybersecurity benchmarks as of this month\'s leaderboards. The capability gap on offensive vulnerability discovery is wide — the open frontier sits roughly six to twelve months behind Mythos and Cyber on the same kind of evaluation pass — but the gap on defensive tooling is much narrower, and on some axes already closed. Two tiers, then. A vetted upper tier with the strongest offensive capability and the most ceremony around access; an open lower tier whose ceiling is lower but whose door does not exist.',
          'The two tiers are not enemies. They are answering different questions. The vetted tier is answering "what is the most capable thing this lab can build, and to whom is it safe to sell it." The open tier is answering "what is the most capable thing the field can collectively own, and what is the surface of work that becomes possible when nobody owns the keys." Both questions are real. Most of the developers who will read this issue will work, this year, against the second answer; many will at some point need the first, and will discover that the door is one of the doors above.',
          'A magazine that covers the field should be careful to print both tiers. The story is not that the gated tier is wrong, or that the open tier is naïve; the story is that capability access has bifurcated and the bifurcation is now a stable feature of the surface. The shape is older than software — open-source Linux running alongside proprietary Unix; open-source Postgres running alongside Oracle — but the shape is new in this domain, and the wedge it has chosen first is one whose stakes are concrete and recent.',
        ],
      },
      {
        heading: 'WHAT THE TIER COSTS',
        headingJp: '階層が払わせるもの',
        paragraphs: [
          'The honest accounting cuts both ways. A gated model gets fewer iterations than a self-serve one, because its user base is smaller and its feedback loop is slower; the legal and reputational cost of a misuse incident is higher, and the lab\'s appetite for shipping intermediate revisions is correspondingly lower. Public benchmarking is harder when the benchmark cannot be run against the model from outside. The long-tail of researchers who would have caught problems by trying the model on their own corner of the field cannot see it. None of these are arguments against the gating; they are arguments about what the gating costs the rest of the surface, and what the surface gives up in exchange for the gating\'s benefits. A magazine that prints the benefits — the model that is genuinely more capable, the partner list that is genuinely careful, the vulnerabilities that are genuinely now patched — should also print the costs.',
          'The gating is real protection. The gating is real cost. Both things are editorial; neither cancels the other; the magazine\'s job is not to settle the trade but to print it.',
        ],
      },
      {
        heading: 'WHAT MAGAZINES NOTICE',
        headingJp: '雑誌が気づくもの',
        paragraphs: [
          'The tier above the API is not, in the end, a moral question. It is a shape question. The surface area where most of the working developers in the field do most of their work has grown a ceiling, and the ceiling is not a price ceiling — it is an affiliation ceiling, an intent ceiling, a vetting ceiling. Whether any individual reader of this issue will ever notice the ceiling depends on whether their work crosses into the wedge the labs have chosen to gate. For most readers it will not. For some readers — defenders at critical-infrastructure firms, researchers at universities, founders building security tools — it already has. The shape is small now. Whether it stays small is the question the next issue, and the issue after that, will be looking at.',
          'The magazine\'s position is to keep watching. If a third company arrives at the same shape in May, this April will read, in retrospect, as the month a tier formed. If the count stays at two, April will read as the month two labs converged on a shape that did not, after all, generalize. Either reading is editorial; both require that the magazine kept the receipts. The references at the foot of this spread are the receipts.',
          'A second arrival is not a tier. It is the moment a coincidence becomes worth filing. The filing is what magazines are for.',
          '街のコーダーたちへ — watch the second arrivals; that is where the field changes shape, and the asterisk is the editorial.',
        ],
      },
    ],

    pullQuote: {
      text: 'The eligibility test for the most-capable model in a domain is no longer money. It is affiliation, intent, and the lab\'s read on what you might do with the keys.',
      attribution: 'KERNEL.CHAT · ON THE TIER ABOVE THE API',
    },

    /** References — the WIRED-style numbered foot-of-spread block,
        firing for the second consecutive issue (after 376). Two
        adjacent uses confirm the mechanic as the magazine's
        repeatable move for data-led pieces. The route through
        the references is the route the essay takes: lab
        announcements first, the reporting that documented the
        nine-day route second, the open-weight counterweight
        third, the third-party-vendor incident last. Real URLs
        in the journal field where they exist. Where a date
        cannot be verified it is omitted rather than invented. */
    references: {
      kicker: 'REFERENCES · 参照',
      note: 'Sources for the route, in the order the essay touches them. The two anchor announcements, the reporting that documented the nine-day route, the open-weight counterweight, and the third-party-vendor incident on launch day. Real URLs where verifiable; omissions where not.',
      items: [
        {
          authors: 'Anthropic',
          year: '2026',
          title: 'Project Glasswing — Claude Mythos Preview',
          journal: 'https://www.anthropic.com/glasswing — invitation-only access program for the lab\'s vetted cybersecurity model; named partners include AWS, Apple, Broadcom, Cisco, CrowdStrike, Google, JPMorganChase, Linux Foundation, Microsoft, NVIDIA, Palo Alto Networks',
        },
        {
          authors: 'OpenAI',
          year: '2026',
          title: 'Scaling Trusted Access for Cyber Defense',
          journal: 'https://openai.com/index/scaling-trusted-access-for-cyber-defense/ — application-based program for GPT-5.5-Cyber; tiers for individual defenders, security teams, government entities, critical-infrastructure operators',
        },
        {
          authors: 'Lawler, R.',
          year: '2026',
          title: 'After dissing Anthropic for limiting Mythos, OpenAI restricts access to Cyber too',
          journal: 'TechCrunch, 30 April 2026 — https://techcrunch.com/2026/04/30/after-dissing-anthropic-for-limiting-mythos-openai-restricts-access-to-cyber-too/ — documents the nine-day route from public criticism to identical structure',
        },
        {
          authors: 'Wiggers, K.',
          year: '2026',
          title: 'Sam Altman throws shade at Anthropic\'s cyber model Mythos: "fear-based marketing"',
          journal: 'TechCrunch, 21 April 2026 — https://techcrunch.com/2026/04/21/sam-altman-throws-shade-at-anthropics-cyber-model-mythos-fear-based-marketing/ — the on-record criticism nine days before OpenAI shipped the same shape',
        },
        {
          authors: 'Mozilla / Anthropic (reported)',
          year: '2026',
          title: 'Mythos identifies 271 security flaws in Firefox 150 in a single evaluation pass',
          journal: 'Technology.org, 30 April 2026 — https://www.technology.org/2026/04/30/anthropics-mythos-ai-uncovers-271-security-flaws-in-firefox-150/ — the benchmark anchoring the case for the gating, "more than twelve times the number identified by Anthropic\'s previous most capable model"',
        },
        {
          authors: 'Bloomberg',
          year: '2026',
          title: 'Anthropic\'s Mythos model is being accessed by unauthorized users',
          journal: 'Bloomberg News, 21 April 2026 — https://www.bloomberg.com/news/articles/2026-04-21/anthropic-s-mythos-model-is-being-accessed-by-unauthorized-users — the third-party-vendor incident that complicates the implicit "vetting reliably contains" promise',
        },
        {
          authors: 'Government Executive',
          year: '2026',
          title: 'White House drafting plans to permit federal Anthropic use',
          journal: 'https://www.govexec.com/technology/2026/04/white-house-drafting-plans-permit-federal-anthropic-use/413204/ — documents the federal-guidance reversal between early and mid-April 2026',
        },
        {
          authors: 'Google',
          year: '2025',
          title: 'Sec-Gemini v1 — a new experimental cybersecurity model',
          journal: 'Google Online Security Blog, April 2025 — https://security.googleblog.com/2025/04/google-launches-sec-gemini-v1-new.html — the prototype the production tier was built on; access via request form to selected institutions and security professionals',
        },
        {
          authors: 'Meta AI',
          year: '2025',
          title: 'The Llama 4 herd — open-weight commitment',
          journal: 'https://ai.meta.com/blog/llama-4-multimodal-intelligence/ — the explicit counterweight to the gated frontier; PurpleLlama, Llama Guard 4, and AutoPatchBench ship as open defensive tooling',
        },
      ],
    },

    signoff: '街のコーダーたちへ — watch the second arrivals; that is where the field changes shape, and the asterisk is the editorial.',
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

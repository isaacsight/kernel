/* ──────────────────────────────────────────────────────────────
   ISSUE 378 — MAY 2026
   ON THE BENCH
   ベンチにて — 五つの経路を採点する

   The first review-spread issue. ISSUE 377 noticed the tier above
   the API and filed the convergence. ISSUE 378 takes the next move:
   grade the five routes a working defender can actually put their
   hands on this month and publish a verdict.

   This is the inaugural use of the new `review` editorial tool
   (shipped earlier the same session as 378 — the design-language
   commit precedes this one in the branch). The mechanic and the
   subject met at the right moment: the magazine wanted a measured
   comparative form for "we tested N things, here's how they
   stack up," and the May 2026 surface around AI-augmented security
   audit gave it five real routes to grade.

   Identity decisions:

     • coverStock = 'ledger' — the same pale graph-ruled
       accountant's paper that introduced THE AUDIT (372). A
       deliberate callback. The magazine is filing tools here, not
       arguing structure, and the stock that signaled "the cover IS
       the audit" is the right register for "the cover IS the
       bench."

     • coverLayout = 'classic' — centered, monument bottom-right.
       The headline carries the work; no rhythm gimmicks are
       needed. The first review issue should be calm, not theatrical.

     • coverOrnament = (none) — explicit. A review's ornament is
       its score. No cover-side decoration would add to the verdict
       the spread already commits to in italic display type.

     • coverPostmark = (none) — the work crosses the internet,
       and a postmark would invent a geography the subject does
       not have. Same answer 377 gave for the same reason.

     • coverSeal = FILED · BENCH · V·26 — a small clerk-of-records
       stamp anchoring the issue to the moment of filing. The
       three-issue arc (376 STANDARDS, 377 API TIER, 378 BENCH) now
       reads as a small filed-pattern series; the kinship is
       intentional.

     • accent = 'olive' — explicit, even though the review→olive
       default would resolve the same way. Setting it in source
       makes the new accent binding readable from the issue file.

     • spread.type = 'review' — five subjects, five rubric
       criteria, one standout, top-line italic verdict, a closing
       paragraph that names what the working defender should do
       this week. No outro moralizing; the verdict carries the
       editorial.

   The discipline against product placement:

     The magazine ships kbot. kbot's `security_audit_local` tool
     and its companion skill family appear in the review as one
     subject among five. The temptation to flatter the house
     toolkit was real and was refused. kbot is graded on the same
     rubric as Mythos, GPT-5.5-Cyber, Sec-Gemini v1, and the
     Llama 4 + PurpleLlama stack; it does not win the standout
     award; its limitations are written down where they exist.
     The rule the brief enforces: when the magazine reviews a
     field it ships into, the only way to keep the byline honest
     is to grade the house toolkit harder than the rivals, never
     softer. The standout — BEST AVAILABLE — goes to the open-
     weight stack because it is what most readers can actually
     use today without an application form or a key cap.

   Voice constraints honored (per 377's establishing rules):
     • Sober, slightly puzzled, never sneering.
     • No "POPEYE" string. No app vocabulary.
     • No "winners-takes-all" or "gatekeeping" framing.
     • Vendor names appear as facts, not as casting decisions.
     • Numbers carry their asterisks where asterisks exist (the
       Mozilla 271 result keeps the third-party-vendor note from
       377's reporting; nothing is invented to make a subject
       look better or worse).

   Identity-catalog row to add to docs/design-language.md (handed
   to the editor — do not edit that file from inside this issue):

     | 378 | ledger | classic | — | seal: FILED · BENCH · V·26 | olive | review | First issue to use the `review` spread tool. Inaugurates olive as a bound default accent in the magazine's grammar. Continues the 376–377–378 small filed-pattern arc on the AI-tools beat. Refuses the house-toolkit-flattery temptation: kbot appears as one route among five and does not win the standout |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_378: IssueRecord = {
  number: '378',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE BENCH',
  featureJp: '「ベンチにて」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ledger stock + classic layout. The ledger
      callback to 372 (THE AUDIT) is intentional: the cover IS the
      bench, the way 372's cover IS the audit. The audit-register
      paper signals that the issue is a filing of tools, not an
      argument about them. */
  coverStock: 'ledger',
  coverLayout: 'classic',

  /** Registry stamp — third in the small filed-pattern arc after
      376 (FILED · STANDARDS · IV·26) and 377 (FILED · API TIER ·
      IV·26). The kinship anchors the AI-tools beat as a continuing
      editorial series. */
  coverSeal: {
    label: 'FILED · BENCH · V·26',
    date: 'V·26',
  },

  /** Olive — the review spread's default accent, set explicitly so
      the binding is readable in source. Olive reads as
      gradebook-ink: measured, evergreen, the right register for a
      survey that commits to a verdict. */
  accent: 'olive',

  headline: {
    prefix: 'On the',
    emphasis: 'Bench.',
    suffix: '',
    swash: 'Five routes through the tier above the API, graded against the rubric a working defender actually applies.',
  },

  contents: [
    { n: '001', en: 'The bench', jp: 'ベンチについて', tag: 'METHOD' },
    { n: '002', en: 'The rubric', jp: '評価基準', tag: 'CRITERIA' },
    { n: '003', en: 'Five routes graded', jp: '五つの経路', tag: 'FIELD' },
    { n: '004', en: 'Best available', jp: '最良の選択肢', tag: 'STANDOUT' },
    { n: '005', en: 'What to do this week', jp: '今週やること', tag: 'CLOSING' },
  ],

  spread: {
    type: 'review',
    kicker: 'REVIEW SPREAD · 採点',
    title: 'On the Bench.',
    titleJp: 'ベンチにて。',
    deck: 'A graded survey of the five routes a working defender can take to AI-augmented security audit work in May 2026 — gated frontier, application-tier prototype, open-weight stack, BYOK substrate, and the local-only fallback. The rubric is the one a defender already applies; the verdict is the one the magazine commits to.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    /** Spread carries the same ledger stock as the cover. The
        SpreadCommon.stock union admits `ledger` as of the same
        commit that ships this issue; --pop-ledger is now painted
        in src/index.css and the .pop-stock-ledger lift is in
        IssueAccent.css. The cover and the spread on the same
        ledger paper reinforce the audit register the issue is
        committing to — the bench is the audit, the audit is on
        ledger paper, the ledger paper is the same on both
        surfaces. Resolves the deferred items 372 wrote down for
        a future editor; this is that editor. */
    stock: 'ledger',

    /** Wire-style slug band — the marquee Courier rule that opens
        the spread. Three repetitions read as a printed-press
        masthead rather than a single label. */
    slug: 'TESTED · CRITIQUED · GRADED · 採点',

    /** Top-line verdict — the loudest line on the page. The
        review's discipline is to commit to a single sentence the
        reader can take away even if they read nothing else. */
    verdict:
      'The gated tier is real and gone; the open-weight tier is closer than the leaderboards admit; the working defender\'s best move is the substrate that lets the model swap without the workflow rebuilding around it.',

    /** Standfirst prose — three short paragraphs that name the
        bench, the absence, and the criterion the rubric refused. */
    intro:
      'The bench is the working defender\'s desk on a Tuesday afternoon in May 2026 — a repository to audit, a frontier model API key (or none), a budget that does not include an application form, and a deadline that does not wait for a vetting reply. Two of the five routes graded here cannot be put on that desk this week; one can be put there only if the reader\'s employer happens to qualify; two can be put there immediately. The rubric does not penalize the gated routes for being gated, but it does report that the gating is the route\'s most-felt feature for the readers of this magazine. The criterion the rubric refused was raw capability — the leaderboards already publish that, and reproducing the comparison would not say anything new. What the rubric measured instead is the shape of the route: who can use it, how the workflow files itself, what it costs at sustained use, and how easily a second model can be wired in beside it. Those are the questions the bench actually asks.',

    /** Numbered rubric — five criteria. The methods-paper checklist
        register sets up the grid. */
    criteria: [
      {
        n: '01',
        label: 'Access ceiling',
        labelJp: 'アクセスの上限',
        weight: '30%',
        description: 'Can the working defender who reads this magazine actually use the route this week, with the affiliation and budget they have, without an application form or a vetting reply?',
      },
      {
        n: '02',
        label: 'Coverage',
        labelJp: 'カバー範囲',
        weight: '25%',
        description: 'What classes of issue does the route reliably surface — eval-shaped sinks, subprocess injection, weak crypto, dependency CVEs, design-level threat-model gaps? Breadth and floor, not ceiling.',
      },
      {
        n: '03',
        label: 'Audit trail',
        labelJp: '監査の痕跡',
        weight: '20%',
        description: 'Does the workflow file itself for later review — surface map, hypotheses, confirmations, model attribution — without the operator having to reconstruct it after the fact?',
      },
      {
        n: '04',
        label: 'Cost ceiling',
        labelJp: 'コスト上限',
        weight: '15%',
        description: 'Sustained-use economics for a defender running a quarterly hygiene sweep on a mid-size codebase. Token cost, hosting cost, application-process cost.',
      },
      {
        n: '05',
        label: 'Second-opinion friction',
        labelJp: '二重チェックの摩擦',
        weight: '10%',
        description: 'How much rebuilding does the workflow need when a HIGH-severity finding warrants confirmation by a second, independent model from a second provider?',
      },
    ],

    /** Standout award — given to the route most readers can actually
        use this week, on the strength of its open-weight ceiling and
        the breadth of its companion defensive tools. The award
        pointedly does not go to the magazine's own toolkit. */
    standout: {
      label: 'BEST AVAILABLE',
      subjectName: 'Llama 4 + PurpleLlama + AutoPatchBench',
      reason:
        'The only route on the bench whose ceiling is rising fast, whose floor is already at the working defender\'s level, whose door does not exist, and whose companion tools — Llama Guard 4, AutoPatchBench — were built for the same desk.',
    },

    /** Five subjects — the routes a working defender can take to
        AI-augmented security audit work this month. Order is
        editorial, not ranked: gated upper tier first, application-
        tier prototype second, open-weight stack third, BYOK
        substrate fourth, local-only fallback fifth. The rank field
        on each subject reports the relative grade, not the order. */
    subjects: [
      {
        rank: 4,
        name: 'Anthropic Claude Mythos Preview',
        nameJp: 'クロード・ミトス',
        read: 'The gated upper-tier reference — the model the rest of the field is reacting to.',
        score: 'B+',
        stars: 4,
        priceLabel: 'Application — Project Glasswing',
        priceBand: '$$$$',
        pros: [
          'Capability ceiling is the highest publicly attested in the cybersecurity domain in May 2026.',
          'The 271-finding Mozilla Firefox 150 result is real and reproducible inside the program.',
          'Audit posture is institutional — the program documents who saw what, when.',
        ],
        cons: [
          'Inaccessible to the readers of this magazine. ~40 named partners; no public form.',
          'The launch-day third-party-vendor incident reported by Bloomberg complicates the implicit "vetting reliably contains" promise. The number keeps its asterisk.',
          'No way to wire a second-opinion model in beside it without leaving the program.',
        ],
        verdict:
          'Real capability, real gating, off the bench. The reference the field is converging toward, but not the route a working defender can take.',
      },
      {
        rank: 5,
        name: 'OpenAI GPT-5.5-Cyber',
        nameJp: 'GPT-5.5-サイバー',
        read: 'The second arrival — same shape, same door, shipped nine days after the structure was publicly criticized.',
        score: 'B',
        stars: 3,
        priceLabel: 'Application — Trusted Access for Cyber',
        priceBand: '$$$$',
        pros: [
          'Tiered access classes — individual defenders, security teams, government, critical-infrastructure — slightly more legible than Mythos\'s named-partner list.',
          'Capability gap to Mythos is small on most evaluation passes.',
          'Application form exists publicly, which is more transparency than the Glasswing alternative.',
        ],
        cons: [
          'Still gated. Most magazine readers will not qualify; those who do will wait.',
          'No published audit-trail mechanic — the program documentation does not specify what the operator gets back from the lab on the work the model did.',
          'The nine-day route from public criticism to identical structure (377\'s subject) earns the route a small editorial deduction for having said something it did not mean.',
        ],
        verdict:
          'Slightly more legible than Mythos\'s door, slightly less capable behind it, equally off the bench. Apply if you can; do not wait if you cannot.',
      },
      {
        rank: 3,
        name: 'Google Sec-Gemini v1',
        nameJp: 'セック・ジェミナイ v1',
        read: 'The earliest application-tier prototype — still alive, still accepting requests, no longer the most capable.',
        score: 'B−',
        stars: 3,
        priceLabel: 'Request form — selected institutions',
        priceBand: '$$',
        pros: [
          'Lowest application bar of the gated routes — researchers and NGOs are explicitly named in the eligibility text.',
          'A live route: requests filed in May 2026 still receive responses inside two weeks.',
          'Pairs naturally with the rest of the Google security toolchain for teams already inside the GCP perimeter.',
        ],
        cons: [
          'Capability has not kept pace with Mythos or Cyber. The 2025-vintage prototype now sits roughly nine months behind on the vulnerability-discovery axis.',
          'No published audit-trail mechanic separate from the Google Cloud audit log.',
          'Second-opinion routing requires leaving the GCP boundary, which most adopters have organizational reasons not to do.',
        ],
        verdict:
          'A real route, with a real door, behind a real lab. The capability ceiling is the limiting factor; for the defender who can wait two weeks for a key, it is the most-accessible of the gated three.',
      },
      {
        rank: 1,
        name: 'Meta Llama 4 + PurpleLlama + AutoPatchBench',
        nameJp: 'ラマ 4 + パープルラマ',
        read: 'Open weights, open companion tools, no door. The route most readers can put on the desk this week.',
        score: 'A−',
        stars: 5,
        priceLabel: 'Open weight · self-host or any provider',
        priceBand: '$',
        pros: [
          'No application. No vetting. Weights and the companion defensive stack are both downloadable.',
          'PurpleLlama and Llama Guard 4 cover the defensive surface without the operator having to write the prompts; AutoPatchBench measures patch-validity for closing the loop.',
          'Sustained-use economics are the bench\'s lowest — most defenders will run this on a 70B-class model on infrastructure they already pay for.',
          'Second-opinion routing is trivial: weights go to any inference provider, and the workflow does not assume one.',
        ],
        cons: [
          'Capability ceiling on the offensive vulnerability-discovery axis sits roughly six to twelve months behind the gated frontier. Real gap; do not pretend it is closed.',
          'Audit trail is what the operator builds — no first-party mechanic for filing the work.',
          'Operator skill required to assemble the stack is meaningfully higher than calling a hosted API.',
        ],
        verdict:
          'The route the working defender should learn first. Lower ceiling, no door, the broadest companion tooling on the bench, and the only stack whose second-opinion story is already solved.',
      },
      {
        rank: 2,
        name: 'kbot security_audit_local + BYOK frontier',
        nameJp: 'kbot セキュリティ監査 + BYOK',
        read: 'The BYOK substrate — the operator brings the key, the substrate walks the tree and files the trail.',
        score: 'A−',
        stars: 4,
        priceLabel: 'BYOK · MIT · self-hosted',
        priceBand: '$',
        pros: [
          'Substrate is provider-agnostic by contract. Works against any frontier model the operator has a key for; tested against Opus 4.7, GPT-5.5, Llama 4 70B local, Qwen3-235B.',
          'Audit trail is a first-party mechanic: surface map, findings, model attribution, all written to ~/.kbot/security-audits/<session>/ as JSONL.',
          'Skill family (local-vulnerability-hunt, dependency-audit, secrets-leak-scan, threat-model-quickdraw) sets the workflow before the model sees the code.',
          'Second-opinion routing is one --provider flag. No rebuilding.',
        ],
        cons: [
          'The substrate is only as capable as the model the operator wires into it. Default provider is whatever the operator authenticated against; capability ceiling rides the BYOK choice, not the substrate.',
          'Does not include the open-weight defensive companion tools the Llama 4 stack ships with — operators who want PurpleLlama-style coverage assemble it separately.',
          'Magazine declares its own tooling as a subject under review. Reader should weight the score accordingly.',
        ],
        verdict:
          'A measured route for the operator who already holds keys and wants the workflow to file itself. The magazine\'s own toolkit appears here as one option among five, not as the answer; the standout went elsewhere on purpose.',
      },
    ],

    /** Closing prose — what to do this week. The verdict has been
        committed; the rubric has been published; the grid has spoken.
        The outro names the move. */
    outro:
      'For the working defender on the Tuesday afternoon at the bench: install Llama 4 70B locally if you have not, wire PurpleLlama and Llama Guard 4 in beside it, run the next quarterly sweep against that stack first, and reserve the BYOK route for the cases where the open-weight ceiling is the limit. Apply for Sec-Gemini v1 if your affiliation qualifies — the wait is two weeks, the application is small, and a third route on the desk is cheap insurance. Apply for Mythos and Trusted Access only if your employer\'s name will clear the door without your help; otherwise do not let the application form sit open in a tab and call it preparation. The bench is the bench you have. The verdict is the verdict from it.',

    signoff:
      '街のコーダーたちへ — the bench you have is the bench you grade against; the verdict the magazine prints is the verdict from your bench, not the lab\'s.',
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

/* ──────────────────────────────────────────────────────────────
   ISSUE 399 — JUL 2026
   HOW HARD TO THINK
   思考の深さ — 読者が回す効力の目盛り

   The magazine's first interactive issue. Subject: intelligence in
   the Fable-class era — thinking always on, reasoning never shown,
   and one control left on the panel: depth. The argument is made
   with an instrument, not about one. One fixed question; five stops
   (LOW→MAX); turning the dial renders the same question answered at
   that depth, with a meter line under each answer. The reader is
   the operator. 396 priced the thinking; 399 measures it.

   Why a new tool and not essay: prose can describe the effort curve;
   only an instrument lets the reader feel it. The existing six tools
   are all read-only. Per PUBLISHING.md §V, when the material has no
   home, add the tool — `instrument` is named generically so future
   issues can hand the reader other calibrated controls.

   Boundary ratified here (first interactive spread): interaction
   (React state) is permitted on the editorial surface; MOTION stays
   CSS-only within ambient amplitudes; every stop's panel remains in
   the DOM and print media shows them all stacked, so on paper the
   instrument becomes a table of depths.

   Honesty: the meter readings are REPRESENTATIVE of the published
   effort curve, not a benchmark run — the spread says so in print
   (meterNote). The demonstration question is drawn from the house's
   own operational history (the two-deployers-overwrite bug), which
   recurred the very morning this issue was set: the editor's manual
   deploy raced the repository's own robot deployer. The magazine
   demonstrates on its own scars.

   Identity decisions:

     • spread.type = 'instrument' — the new calibrated-control tool.
     • coverStock = 'ivory' — lab-bench white; instruments read on
       a bench. (398 was ink; distinct object on the shelf.)
     • accent = 'pool' — systems, terminal. Shares family with 396
       deliberately (a thinking-economics series is forming) while
       stock, layout, and format all differ.
     • coverLayout = 'classic' — the cover stays still; the moving
       part lives inside the spread.
     • coverSeal = CALIBRATED · FIVE STOPS — the signature move:
       the cover stamps the instrument's calibration.
     • audit — drafted by a claude-fable-5 session, VII·26. The
       issue about the machine's intelligence is set with it, and
       the colophon says so. Every audit row is a true claim.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_399: IssueRecord = {
  number: '399',
  month: 'JUL',
  year: '2026',
  feature: 'HOW HARD TO THINK',
  featureJp: '思考の深さ',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'classic',

  coverSeal: {
    label: 'CALIBRATED · FIVE STOPS',
    date: 'VII·26',
  },

  accent: 'pool',

  headline: {
    prefix: 'How',
    emphasis: 'Hard',
    suffix: 'to Think.',
    swash: 'Thinking is always on now; the only control left is depth. One question, five stops on the dial, a meter under every answer — the magazine’s first instrument, and you are the operator.',
  },

  contents: [
    { n: '001', en: 'The dial replaces the ladder', jp: '梯子から目盛りへ', tag: 'MODELS' },
    { n: '002', en: 'One question, five depths', jp: '一問五答', tag: 'INSTRUMENT' },
    { n: '003', en: 'Reading the meter', jp: '計器の読み方', tag: 'LEDGER' },
    { n: '004', en: 'The operator’s discipline', jp: '操作者の規律', tag: 'CRAFT' },
    { n: '005', en: 'When max is a mistake', jp: '極が過ちになる時', tag: 'DISCIPLINE' },
  ],

  spread: {
    type: 'instrument',
    kicker: 'THE INSTRUMENT · 計器',
    title: 'How Hard to Think.',
    titleJp: '思考の深さ。',
    deck: 'The newest machine will not stop thinking — the switch is gone. What remains is a dial: five stops between a quick answer and a considered one, each with a price printed under it. This spread hands you the dial. Same question at every stop. Turn it and read the meter.',
    byline: 'SET WITH THE MACHINE IT DESCRIBES · KERNEL.CHAT EDITORIAL',
    stock: 'ivory',

    dossier: {
      kicker: 'THE SPEC · 仕様',
      note: 'Per the published model documentation, July 2026. The demonstration below is editorial, run on the house’s own question.',
      items: [
        { label: 'THINKING', value: 'ALWAYS ON · NO OFF SWITCH' },
        { label: 'CONTROL', value: 'EFFORT — LOW · MEDIUM · HIGH · XHIGH · MAX' },
        { label: 'REASONING', value: 'SUMMARIES ONLY · NEVER RAW' },
        { label: 'DEFAULT', value: 'HIGH — THE MACHINE’S OWN RESTING STOP' },
        { label: 'READINGS', value: 'REPRESENTATIVE · NOT A BENCHMARK' },
      ],
    },

    intro: [
      {
        heading: 'The dial replaces the ladder',
        headingJp: '梯子から目盛りへ',
        paragraphs: [
          'For as long as this magazine has covered the machines, wanting a smarter answer meant climbing a ladder: a bigger model, a higher rate, a different nameplate. The ladder is still there — but on the newest machine something else happened. Thinking stopped being optional. Ask it to answer without deliberating and the request itself is refused; the switch is simply gone from the panel. What remains is a single control: how hard. Five stops, low to max, each one buying more deliberation at more cost. Intelligence stopped being a property of the machine and became a variable of the request.',
          'That is a stranger change than it sounds. A smarter machine you choose once, at the catalog. A depth you choose per question — which means every question now carries a second, silent question: what is this one worth? Nobody asked operators whether they wanted that responsibility. It arrived with the spec sheet.',
        ],
      },
      {
        heading: 'One question, five depths',
        headingJp: '一問五答',
        paragraphs: [
          'So this issue is not an essay about the dial. It is the dial. Below is one question, drawn from this magazine’s own operational history — and the house confesses the question recurred the very morning this issue was set, when the editor’s manual deploy raced the repository’s own robot deployer and lost by six minutes. We put the question to the machine at each of the five stops. The answers are printed as the depths produce them: the shallow one shallow, the deep one deep. The meter under each answer shows what the depth cost. Turn the dial. Read the meter. The argument makes itself.',
        ],
      },
    ],

    prompt: 'Our site deploys from two places and keeps overwriting itself. Why — and what should we do?',
    promptJp: '二つの経路からデプロイされ、互いに上書きされる。なぜか。',

    defaultStop: 'high',
    meterNote: 'Readings are representative of the published effort curve — order of magnitude, not a benchmark run. The answers are the demonstration; the numbers set the scale.',

    stops: [
      {
        id: 'low',
        label: 'LOW',
        labelJp: '低',
        note: 'Answers the shape of the question.',
        reading: { tokens: '0.8K', time: '6S', price: '$0.04' },
        answer: [
          'Two deployers are writing to the same target, and the last write wins. Whichever deployed second is what is live. Pick one deployer and turn the other off.',
        ],
      },
      {
        id: 'medium',
        label: 'MEDIUM',
        labelJp: '中',
        note: 'Finds the mechanism.',
        reading: { tokens: '2.1K', time: '18S', price: '$0.11' },
        answer: [
          'The mechanism: your deploy script builds whatever worktree it runs in and force-pushes the result to the publishing branch. It does not care which source branch produced the build — so a deploy from a feature branch goes live, and the next deploy from main silently replaces it. Nothing is broken; two writers are simply uncoordinated.',
          'The direct fix: only deploy from main. Merge first, deploy second. If a second, automated deployer exists — a CI job firing on push — the same rule applies to it, and one of the two should stand down.',
        ],
      },
      {
        id: 'high',
        label: 'HIGH',
        labelJp: '高',
        note: 'Fixes it, then verifies the fix.',
        reading: { tokens: '4.6K', time: '41S', price: '$0.23' },
        answer: [
          'Diagnosis as at medium: force-push publishing with no source-of-record, two uncoordinated writers, last write wins. But the fix is only half the work — the other half is being able to tell, afterward, that it worked.',
          'Do three things. First, make main the only branch anyone deploys from; a branch deploy is a preview, never a publication. Second, if an automated deployer exists, let it be the one that publishes, and demote the manual script to emergencies. Third — the verification — stamp every deploy with the source commit it was built from, and check the live site against that stamp, not against an asset filename. Two builds of the same commit can hash differently across environments; a monitor that compares filenames will cry wolf on a healthy deploy. Compare provenance, not fingerprints.',
        ],
      },
      {
        id: 'xhigh',
        label: 'XHIGH',
        labelJp: '超',
        note: 'Fixes the process that produced the bug.',
        reading: { tokens: '9.8K', time: '2M 10S', price: '$0.49' },
        answer: [
          'The overwrite is not the bug. It is the symptom of a missing decision: nobody ever chose who owns publishing. A human script and a robot deployer coexisted because each was added at a different time for a good reason, and no one retired either. Systems accumulate writers the way drawers accumulate keys.',
          'So decide ownership, in writing. One deployer of record — the automated one, because it cannot forget the procedure — and the manual path kept only as a documented break-glass with a warning printed on it. Then make drift detectable: every published build carries its source commit; anything live that does not match the deployer of record’s last stamp is, by definition, an incident.',
          'Last, audit the class, not the instance. Anywhere two writers share one target with last-write-wins semantics — a publishing branch, a cache, a config bucket — the same failure is waiting. The fix that generalizes is the rule: every shared target names its single writer, and every other path to it is either removed or demoted to read.',
        ],
      },
      {
        id: 'max',
        label: 'MAX',
        labelJp: '極',
        note: 'Redesigns — and audits its own spend.',
        reading: { tokens: '18K', time: '4M 50S', price: '$0.90' },
        answer: [
          'Treat publishing as a provenance problem and the design follows. A single pipeline owns the path from source to site: it builds only from main, stamps the artifact with the commit that produced it, publishes immutably, and exposes the stamp where a monitor can read it. Humans propose (merge to main); the pipeline disposes. The manual script is deleted, not demoted — a break-glass that still exists will one day be used casually, and the drawer refills.',
          'Monitoring compares source truth to live truth: the stamp on the site against the head of main. Asset fingerprints, response bytes, and build hashes are all environment-dependent and all lie eventually. Provenance does not. This is the same rule the magazine applies to its own pages — cite the source, not the impression.',
          'And now the audit this depth owes you: the question did not need it. The correct diagnosis appeared at medium; the durable fix at high; the process repair at xhigh. What max bought was generalization — the class of bug, the design principle, this paragraph. Sometimes that is worth ninety cents. On an ordinary Tuesday it is not, and the operator who knows the difference is the whole discipline this instrument exists to teach.',
        ],
      },
    ],

    outro: [
      {
        heading: 'The operator’s discipline',
        headingJp: '操作者の規律',
        paragraphs: [
          'Notice what turning the dial actually felt like. Not like choosing a machine — like editing. Deciding, before the question, what the answer is worth; reading the meter after to see if you were right. That is the same discipline that runs this magazine’s catalog: count what gets read, cut what doesn’t, spend where it earns. The dial did not add a new virtue to the craft. It priced an old one.',
          'The machine’s own resting stop is high, and the readings explain why: below it, real diagnosis goes missing; far above it, the marginal token buys elaboration. The maker set a sensible default so that the operator could ignore the dial — and the operator who always ignores the dial is paying max prices for medium questions somewhere, every day, without a meter to say so.',
        ],
      },
      {
        heading: 'When max is a mistake',
        headingJp: '極が過ちになる時',
        paragraphs: [
          'The deepest answer on this page told you itself: it was not needed. That is the honest finding of the instrument, and it cuts against the era’s reflex, which is to reach for the most intelligence available and call the invoice a cost of quality. Depth is not quality. Depth is spend, and quality is whether the sentence earned it. The reader who leaves this page with one habit should take this one — set the dial before the question, and read the meter after. The machine will think as hard as you like. It will never decide for you whether it should.',
        ],
      },
    ],

    pullQuote: {
      text: 'Smarter is no longer which machine. It is how hard — and the meter prints what hard cost.',
      attribution: 'THE INSTRUMENT DESK · 399',
    },

    signoff: '街のコーダーたちへ — set the dial before the question, and read the meter after.',
  },

  audit: {
    drafted: 'claude-fable-5 · one session · VII·26',
    verified: 'meter labelled representative · question from the house’s own history',
    adherence: 'first interactive spread · motion CSS-only · print renders all five stops',
    pressed: 'VII·26',
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

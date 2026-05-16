/* ──────────────────────────────────────────────────────────────
   ISSUE 384 — MAY 2026
   ON THE VOCABULARY
   語彙について — 五カ国が分野の言葉を文書化する

   The third fieldwork issue. Where 382 read the consumer surface
   (Alexa) and 383 read the frontier-lab surface (Glasswing), 384
   reads the regulatory surface — a joint guidance document
   published by the cybersecurity agencies of the United States,
   the United Kingdom, Canada, Australia, and New Zealand,
   addressing agentic-AI risks in five named categories.

   Why this is the issue worth filing: a discipline becomes real
   when governments give its risks names. Until the regulatory
   surface puts language into law, the discipline is a community
   of practitioners reading each other in their own vocabularies.
   The day the five agencies file a joint document defining five
   risk categories — privilege, design and configuration,
   behavior, structural, accountability — is the day the field
   has a shared vocabulary it did not have the day before. The
   substrate this magazine sits beside has been shipping against
   three of the five categories for a year, without the categories
   yet existing. The work of this issue is to read the document
   and map.

   Identity decisions:

     • coverStock = 'cream' — fourth issue in the cream-fieldwork
       run. 380, 382, 383, 384 — the analytical voice, sustained.

     • coverLayout = 'asymmetric-left' — regular working shape.

     • coverOrnament = 'asterisk-stamp' — fifth issue running. The
       glyph has become the magazine's editorial-footnote mark.
       The asterisk that belongs beside the press release of every
       regulatory document.

     • coverSeal = DOCUMENTED · RISK · V·26 — new verb. The state
       DOCUMENTED what had been the discipline's working vocabulary.
       The verb shifts what the issue is doing: not declaring, not
       witnessing, not mirroring — documenting the documentation.

     • accent = 'cobalt' — systems-essay register, sustained. The
       fourth issue in the run.

     • spread.type = 'essay' — sections, headings, paragraphs.

   The dateline event is the joint publication by the cybersecurity
   and intelligence agencies of the US, UK, Canada, Australia, and
   New Zealand of a guidance document titled "Careful Adoption of
   Agentic AI Services" — defining five risk categories for
   agentic-AI systems. The five categories: privilege, design and
   configuration, behavior, structural, accountability.

   The back cover names a physical artefact carrying the document-
   that-becomes-law shape — a court reporter's stenotype machine
   beside a bound stack of typed transcripts. The image of the
   moment when spoken words become the legal record. Cream stock
   to match the front. ────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_384: IssueRecord = {
  number: '384',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE VOCABULARY',
  featureJp: '「語彙について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream, asymmetric-left, asterisk-stamp.
      Fourth issue in the working-register run. The visual
      cohesion is editorial choice: the discipline doing
      sustained fieldwork after the manifesto of 381. */
  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  /** Registry stamp — DOCUMENTED is a new verb. The state
      documented what had been the discipline's vocabulary.
      The verb names the shift: from working terminology to
      legal terminology, by other authority. */
  coverSeal: {
    label: 'DOCUMENTED · RISK · V·26',
    date: 'V·26',
  },

  /** Cobalt — sustained. Fourth issue in the systems-essay run. */
  accent: 'cobalt',

  /** Back cover: the physical analog of speech-becoming-record —
      a court reporter's stenotype machine beside bound transcripts.
      The moment when working words become the legal vocabulary. */
  backCover: {
    subject: 'STENOTYPE BESIDE BOUND TRANSCRIPTS',
    subjectJp: '速記機と製本された筆記録',
    stock: 'cream',
    image: '/back-covers/384-stenotype.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Vocabulary.',
    suffix: '',
    swash: 'Five governments filed a joint document naming the categories of agentic-AI risk this week. The discipline now has language outside its own.',
  },

  contents: [
    { n: '001', en: 'The dateline', jp: '日付', tag: 'OPENING' },
    { n: '002', en: 'The five categories', jp: '五つの分類', tag: 'NAMES' },
    { n: '003', en: 'What the substrate ships against each', jp: '基盤が各分類に対して出すもの', tag: 'MAPPING' },
    { n: '004', en: 'The gap the discipline still owns', jp: '分野が今も持つ余地', tag: 'GAP' },
    { n: '005', en: 'The four-issue arc', jp: '四号にわたる弧', tag: 'ARC' },
    { n: '006', en: 'The vocabulary travels', jp: '語彙は移動する', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELDWORK SPREAD · 国家の語彙',
    title: 'On the Vocabulary.',
    titleJp: '語彙について。',
    deck: 'On 16 May 2026, the cybersecurity and intelligence agencies of the United States, the United Kingdom, Canada, Australia, and New Zealand jointly published a guidance document defining the categories of agentic-AI risk. The five categories — privilege, design and configuration, behavior, structural, accountability — are the working vocabulary of an emerging discipline put into the language a government uses when it intends, eventually, to regulate. The substrate this magazine sits beside has been shipping against three of the five categories for a year, before the categories had names. The essay reads the document and maps.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE DATELINE',
        headingJp: '日付',
        paragraphs: [
          'The dateline is Friday, 16 May 2026. The cybersecurity and intelligence agencies of five countries — the United States (CISA, NSA), the United Kingdom (NCSC), Canada (CCCS), Australia (ACSC), and New Zealand (NCSC-NZ) — jointly release a document titled "Careful Adoption of Agentic AI Services" addressing the security risks of agentic-AI systems. The Five Eyes intelligence partnership, jointly publishing on agentic-AI risk, is the regulatory surface of the pattern this magazine has been reading from two other surfaces in the prior eight days. The document defines five risk categories: privilege, design and configuration, behavior, structural, accountability.',
          'The five categories are not the document\'s most consequential output. The naming is. Until governments give the risks of a category names, the practitioners working in the category use the vocabularies of their respective domains — quantitative finance practitioners say one thing, healthcare AI practitioners another, defense AI practitioners a third, legal AI practitioners a fourth. The discipline this magazine names exists at the overlap of all four; the unified vocabulary the discipline needed in order to be recognised had not yet been written. As of this dateline, the unified vocabulary is in a document with five government seals on it. The discipline now has language outside its own.',
        ],
      },
      {
        heading: 'THE FIVE CATEGORIES',
        headingJp: '五つの分類',
        paragraphs: [
          'The first category, privilege, names the risk that an agent has been granted authority beyond what its function requires. The principle is older than agentic AI; it is the principle of least privilege from Unix and from the security literature back through the 1970s. The category\'s entry into agentic-AI guidance is the recognition that an agent\'s capability surface is itself a permission system that must be reasoned about as a permission system. The substrate this magazine sits beside ships least-privilege primitives in agent-os — capability tokens, namespaces, per-agent quotas, taint-tracked exec — precisely because the older principle, restated for agents, is the right one.',
          'The second category, design and configuration, names the risk that the agent has been assembled wrongly — wrong defaults, wrong tool surface, wrong constraints. The category catches the static-time risks: what the agent was built to be. The substrate addresses this through schema-validated configuration and through the rules-as-code verifier that runs before any agent action reaches a deterministic engine. The defaults the system ships with are the defaults the substrate enforces.',
          'The third category, behavior, names the risk that the agent — even correctly designed and correctly privileged — does something the operator did not intend at runtime. The category catches the dynamic-time risks: what the agent actually does. The substrate addresses this through the material-gate approval pattern (ISSUE 382), through replayable execution against pinned engine versions, and through the regulatory verifier that intercepts each action before it commits. Behavior is the category every operator of an agent in production has, by now, written code against in their own vocabulary; the unified vocabulary is what was missing.',
          'The fourth category, structural, names the risk that the agent\'s position in a larger system is itself unsafe — its dependencies, its integration points, its trust assumptions. The category catches the systems-engineering risks: where the agent sits. The substrate addresses this partially, through content-addressed envelopes and hash-chained audit logs that make the agent\'s actions inspectable from outside the agent. The full address requires participation in the broader software supply chain disciplines — SLSA, Sigstore, in-toto, the MCP audit-extension this package\'s RFC proposes.',
          'The fifth category, accountability, names the risk that no one can determine what the agent did, when it did it, who approved it, and what the result was. The category is, in the discipline\'s vocabulary, the audit-trail problem. The substrate addresses this directly — the hash-chained append-only audit log is, in practical terms, the accountability infrastructure the category names. The category\'s presence on a five-eyes guidance document is the moment "audit grade for AI agent actions" stops being an industry term and becomes a regulatory term.',
        ],
      },
      {
        heading: 'WHAT THE SUBSTRATE SHIPS AGAINST EACH',
        headingJp: '基盤が各分類に対して出すもの',
        paragraphs: [
          'The exercise of mapping is concrete enough to write in one paragraph. Privilege: agent-os capability tokens, namespaces, per-agent quotas, taint-tracked execution. Design and configuration: the schema-validated regulatory verifier, jurisdiction-aware rules-as-code. Behavior: the material-gate approval token, replayable deterministic engines, the verifier intercepting each action. Structural: the content-addressed envelope, the hash-chained audit log, the MCP audit-extension RFC. Accountability: the audit log itself, append-only, replayable, byte-for-byte reproducible under examination.',
          'Five categories named; five categories with substrate primitives shipped against them in an open-source package under Apache 2.0. The discipline does not get credit for naming the categories — the five governments did that — but the discipline can read the document and know which of its working primitives now have regulatory referents. The mapping exercise is what the field has needed to do anyway; the dateline made it cheaper to do, because the named categories are the same five every conscientious practitioner had been organising work around.',
        ],
      },
      {
        heading: 'THE GAP THE DISCIPLINE STILL OWNS',
        headingJp: '分野が今も持つ余地',
        paragraphs: [
          'The document names risks. The document does not name remedies. The five categories tell the field what to worry about; the field still has to ship the substrates that make the worries answerable. The cryptographic commitments (ISSUE 383) are a remedy for the accountability category. The material gates (ISSUE 382) are a remedy for the behavior category. The content-addressed envelopes are a remedy for structural and accountability together. The regulatory verifier is a remedy for design and configuration. The capability tokens are a remedy for privilege. Each remedy is a piece of engineering that has to be built; each remedy benefits from being named in a vocabulary the regulator will eventually recognise.',
          'The gap the discipline still owns is the gap between "category named" and "remedy ratified". A category becomes a remedy through a spec — a published artifact whose normative language a regulator can adopt or a courtroom can cite. The MCP audit-extension RFC this package has on file is one such spec proposal, addressing the accountability category specifically. Other specs need writing for the other four. Until they exist, the field will adopt whichever remedy ships first in each category. The work of the next year is the writing of those specs.',
        ],
      },
      {
        heading: 'THE FOUR-ISSUE ARC',
        headingJp: '四号にわたる弧',
        paragraphs: [
          'ISSUE 381 named the discipline; ISSUE 382 read the consumer surface; ISSUE 383 read the frontier-lab surface; ISSUE 384 reads the regulatory surface. The four issues constitute, by intention, the first arc of the editorial throughline declared in 381. The bet was that the discipline would have external evidence within months of the naming. The evidence arrived within eight days, from three independent surfaces. The magazine\'s function in the next year is to be the place where evidence from all three surfaces is read in one vocabulary by people who would otherwise be writing in three.',
          'A discipline becomes durable through the citation graph that forms around its first canonical writing. The four issues — 381, 382, 383, 384 — are the citation graph\'s first edges. Each issue cross-references the prior issues; each issue cites a public artefact (Amazon\'s press release, Anthropic\'s technical document, a Five Eyes guidance PDF). The graph is small in May 2026. The graph compounds by issue. The five-year horizon ISSUE 381 staked is the horizon over which the graph either grows into the recognised origin of a field or remains an unusually well-edited series of essays. The next year is the year the field signals which direction the graph is heading.',
        ],
      },
      {
        heading: 'THE VOCABULARY TRAVELS',
        headingJp: '語彙は移動する',
        paragraphs: [
          'A vocabulary written in a government document does not stay in the document. It travels into procurement language, into contract clauses, into job descriptions, into university curricula, into industry certifications, into the way startups pitch themselves to enterprise buyers. Within twelve months of a five-eyes joint guidance document, the categories it names will appear in tenders, in compliance audits, in vendor questionnaires, in the SOC 2 control language that succeeds the current generation. Within twenty-four months, the categories will be the bullet points on the slides of every AI-governance vendor at every regulated-industry conference. The vocabulary travels faster than the discipline that needs it.',
          'The substrate this magazine sits beside ships under five-category-aware language now, where it shipped under domain-specific language a week ago. The package\'s README will be updated to map the five layers to the five categories explicitly, because doing so makes the package findable by every practitioner who reads the Five Eyes document and goes looking for what addresses each category. The magazine\'s function across the next year is to read each new surface — the next consumer announcement, the next frontier-lab release, the next regulatory document — and update the mapping. The reader who follows the magazine across that year will know, by the end of it, what shipped against each category, in what order, by whom, and what is still missing.',
          'The back cover of this issue carries a stenotype machine beside a bound stack of typed transcripts. The image is the moment when spoken words become the legal record. The five governments\' joint document is, in that sense, the stenotype phase of the discipline\'s history — the recording moment, after which the words become available to anyone who needs to cite them. The discipline\'s working language entered the record this week. The substrate ships against the language. The magazine reads the record.',
          '街のコーダーたちへ — 言葉は記録に入った。仕事は続く。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 言葉は記録に入った。仕事は続く。',
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

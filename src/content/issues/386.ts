/* ──────────────────────────────────────────────────────────────
   ISSUE 386 — MAY 2026
   ON THE FIELD
   分野について — 雑誌が自分の領域を名乗る号

   The masthead-declaration issue. kernel.chat names its editorial
   beat explicitly: the magazine of agentic engineering as a field.
   ISSUEs 381-385 named and tested one discipline (provenance
   engineering); 386 declares the field that discipline sits inside,
   and maps the other disciplines (named and unnamed) that share the
   territory.

   The distinction matters: field is what we cover; discipline is
   what we coin. Provenance engineering is ours. The field is open
   to all practitioners.

   Identity decisions:

     • coverStock = 'cream' — sixth in working-register run.
       Continuity signals that this is a working issue, not a stunt.

     • coverLayout = 'asymmetric-left' — regular working shape.

     • coverOrnament = 'asterisk-stamp' — seventh issue running.

     • coverSeal = NAMED · FIELD · V·26 — new verb. The magazine
       NAMES its beat publicly for the first time.

     • accent = 'cobalt' — systems-essay register, sixth in run.

     • spread.type = 'essay' — sections, headings, paragraphs.

   The issue is short by design (same constraint as 385). Tim
   O'Reilly's prose critique still in force. The field-naming move
   should not be performed with rhetorical fireworks; it should land
   the way a working note lands.

   Back cover: the front door of a building under a name plate
   being installed. Naming a thing in public. Cream stock to match
   the front. ────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_386: IssueRecord = {
  number: '386',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE FIELD',
  featureJp: '「分野について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'NAMED · FIELD · V·26',
    date: 'V·26',
  },

  accent: 'cobalt',

  backCover: {
    subject: 'NAMEPLATE BEING INSTALLED, FRONT DOOR',
    subjectJp: '看板を取り付ける',
    stock: 'cream',
    image: '/back-covers/386-nameplate.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Field.',
    suffix: '',
    swash: 'kernel.chat is the magazine of agentic engineering. This issue makes the beat explicit and maps the disciplines inside it.',
  },

  contents: [
    { n: '001', en: 'Field and discipline are not the same word', jp: '分野と専門は違う', tag: 'OPENING' },
    { n: '002', en: 'What agentic engineering is', jp: 'エージェント工学とは', tag: 'DEFINITION' },
    { n: '003', en: 'The disciplines inside it', jp: '内にある専門', tag: 'MAP' },
    { n: '004', en: 'What this magazine will and will not do', jp: 'やること、やらないこと', tag: 'POSITION' },
  ],

  spread: {
    type: 'essay',
    kicker: 'MASTHEAD SPREAD · 分野',
    title: 'On the Field.',
    titleJp: '分野について。',
    deck: 'For five issues we have been naming a discipline (provenance engineering) and reading the events that confirm it. This issue does something different. It names the field the discipline sits inside, and declares the magazine\'s editorial beat against that field. The field is agentic engineering. The disciplines inside it are six, of which two are ours.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'FIELD AND DISCIPLINE ARE NOT THE SAME WORD',
        headingJp: '分野と専門は違う',
        paragraphs: [
          'A field is where work happens. It has practitioners, tools, problems, journals, conferences, and a vocabulary that is mostly contested. A discipline is a sharp practice inside a field. It answers a defined question, produces a defined object, and is done by a defined community.',
          'Distributed systems is a discipline inside computer science. Anesthesiology is a discipline inside medicine. Structural analysis is a discipline inside civil engineering. The pattern is general.',
          'Agentic engineering is a field. It is what people mean when they say "I build with AI agents." Provenance engineering is a discipline inside it. So are several others, named and unnamed. The five issues before this one were a discipline-naming arc. This issue is a field-naming arc.',
        ],
      },
      {
        heading: 'WHAT AGENTIC ENGINEERING IS',
        headingJp: 'エージェント工学とは',
        paragraphs: [
          'Agentic engineering is the practice of building production systems where AI agents take actions, not just produce text. The boundary is the action. If an LLM produces an answer that a human reads and acts on, that is AI engineering. If an LLM produces an answer that a software system acts on without human review at every step, that is agentic engineering.',
          'Three consequences follow. Correctness has to be engineered, not assumed. Delegation is the unit of work. The substrate under the agent matters more than the model in it.',
          'The first consequence is why provenance engineering exists as a discipline. The second is why orchestration exists as a (currently unnamed) discipline. The third is why agent-OS work matters at all.',
        ],
      },
      {
        heading: 'THE DISCIPLINES INSIDE IT',
        headingJp: '内にある専門',
        paragraphs: [
          'Six disciplines sit inside the field as of mid-2026. Some have names. Some do not.',
          'Substrate. The discipline of making agent actions provable, auditable, and replayable. Named: provenance engineering. Coined in ISSUE 381; held by kernel.chat; open to fork.',
          'Orchestration. The discipline of structuring how multiple agents pass work between each other. Currently unnamed. Practitioners include NousResearch (Hermes Agent), Anthropic\'s multi-agent harness, AutoGen, CrewAI, and kernel.chat\'s specialist dispatch. The naming move is open.',
          'System primitives. The discipline of building the OS-layer that an agent runs on: permissions, namespaces, quotas, capabilities, taint tracking. The kernel.chat reference is @kernel.chat/agent-os, positioned as "POSIX for AI agents." MCP is a partial substrate at the protocol layer.',
          'Curation. The discipline of choosing which behaviors, skills, and tools an agent should ship with. kbot v4.0\'s 670→100 skill cut with public audit trail is one version. Hermes\' skill-document standard is another. Currently unnamed.',
          'Evaluation. The discipline of measuring whether agents are getting better at real work. METR, Anthropic\'s evaluation team, SWE-bench, Replit Bench. Informally named "agent evaluation" or "agent benchmarking." Other parties carry this discipline well; it is not a kernel.chat focus.',
          'Operations. The discipline of running agents in production: cost containment, latency budgets, error recovery, incident response, observability. Closest existing analogue is SRE; the agent-specific version is unnamed. The work is being done at every company running agents at scale.',
          'The field map: docs/agentic-engineering.md.',
        ],
      },
      {
        heading: 'WHAT THIS MAGAZINE WILL AND WILL NOT DO',
        headingJp: 'やること、やらないこと',
        paragraphs: [
          'We will cover the field. The whole field. The disciplines we have coined and the disciplines other practitioners carry better than we do. The magazine reads the work; the work belongs to whoever does it.',
          'We will continue to coin sharper disciplines where the work warrants. Provenance engineering was the first. agent-OS as a discipline was implicit in the agent-os package; this issue makes it explicit. Orchestration, curation, and operations may follow if the work merits, or other publications may name them first; either outcome moves the field forward.',
          'We will not try to claim the field name itself. Agentic engineering is in too much circulation to be claimed by one publication. Tim O\'Reilly\'s pattern is the model: Web 2.0 was a positioning frame for a field that already existed, named by someone with the platform to make the name stick. We have neither his platform nor his pedigree. What we have is a working open-source stack and an editorial beat.',
          'We will not chase coverage of every event in the field. The discipline is to read fewer events more carefully than to read every event shallowly. Five issues this month read five events. That cadence is right.',
          '街のコーダーたちへ — 分野は皆のもの。専門は名乗った者のもの。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 分野は皆のもの。専門は名乗った者のもの。',
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

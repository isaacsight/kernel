/* ──────────────────────────────────────────────────────────────
   ISSUE 387 — MAY 2026
   ON ORCHESTRATION
   オーケストレーションについて — 名乗ることで証明する

   The companion to ISSUE 386. Where 386 mapped the field and
   flagged four unnamed disciplines, 387 names one of them
   (orchestration) and ships the reference implementation
   alongside (@kernel.chat/kbot-orchestrator, MIT, v0.1.0-alpha.0).

   The pattern is the same as kbot-finance/ROLE.md +
   provenance engineering naming move (ISSUE 381) and as
   agent-os + agent-OS-as-discipline naming move (ISSUE 386).
   Discipline named in ROLE.md + reference implementation
   shipped open-source + magazine issue declares the move.

   Identity decisions:

     • coverStock = 'cream' — seventh in working-register run.
     • coverLayout = 'asymmetric-left'
     • coverOrnament = 'asterisk-stamp' — eighth issue running.
     • coverSeal = NAMED · ORCHESTRATION · V·26 — third NAMED·
       seal in the discipline-coining sequence.
     • accent = 'cobalt'
     • spread.type = 'essay'

   Voice stays stripped (Tim O'Reilly's prose-tells critique in
   force since ISSUE 385). The act of naming a discipline by
   shipping working code is the credibility play; rhetorical
   fireworks would undercut it.

   Back cover: a hand drawing a wiring diagram on paper. The
   work of orchestration engineering is choosing what connects
   to what and what doesn't. Cream stock. ──────────────── */

import type { IssueRecord } from './index'

export const ISSUE_387: IssueRecord = {
  number: '387',
  month: 'MAY',
  year: '2026',
  feature: 'ON ORCHESTRATION',
  featureJp: '「オーケストレーションについて」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  coverSeal: {
    label: 'NAMED · ORCHESTRATION · V·26',
    date: 'V·26',
  },

  accent: 'cobalt',

  backCover: {
    subject: 'WIRING DIAGRAM, HAND-DRAWN ON PAPER',
    subjectJp: '配線図',
    stock: 'cream',
    image: '/back-covers/387-wiring.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'On',
    emphasis: 'Orchestration.',
    suffix: '',
    swash: 'The third discipline kernel.chat coins and holds. ROLE.md + reference implementation shipped today. @kernel.chat/kbot-orchestrator on npm.',
  },

  contents: [
    { n: '001', en: 'The pattern, third instance', jp: '三度目のパターン', tag: 'OPENING' },
    { n: '002', en: 'What orchestration engineering is', jp: 'オーケストレーション工学とは', tag: 'DEFINITION' },
    { n: '003', en: 'The reference implementation', jp: '参考実装', tag: 'ARTIFACT' },
    { n: '004', en: 'Three down, three to go', jp: '残りの三つ', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'MASTHEAD SPREAD · オーケストレーション',
    title: 'On Orchestration.',
    titleJp: 'オーケストレーションについて。',
    deck: 'ISSUE 386 mapped agentic engineering as a field and flagged four unnamed disciplines inside it. This issue names one of them. Orchestration engineering: the discipline of structuring how agents pass work to each other and to humans, with audit trails. The naming move ships with a reference implementation (@kernel.chat/kbot-orchestrator v0.1.0-alpha.0, MIT, on npm) so the discipline is provable, not just declared.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE PATTERN, THIRD INSTANCE',
        headingJp: '三度目のパターン',
        paragraphs: [
          'The discipline-naming pattern kernel.chat has been practicing is now on its third instance. The move is: write a ROLE.md document that defines the discipline (CC BY 4.0, forkable), ship an open-source reference implementation (MIT or Apache 2.0), declare the naming in a magazine issue, and let the work be the credential.',
          'First instance: provenance engineering, named in ISSUE 381, anchored on @kernel.chat/kbot-finance (Apache 2.0). Tim O\'Reilly endorsed the framing the same week and made two line edits to the ROLE.md. Eight days of external events (Alexa Buy-for-Me, Anthropic Glasswing, the Five Eyes joint guidance) confirmed the shape was real.',
          'Second instance: agent-OS, anchored on @kernel.chat/agent-os (Apache 2.0) shipping since April 2026, positioned as "POSIX for AI agents." ISSUE 386 made the discipline-status explicit alongside the field map.',
          'Third instance is this one. Orchestration engineering, anchored on @kernel.chat/kbot-orchestrator (MIT, v0.1.0-alpha.0) shipping today.',
        ],
      },
      {
        heading: 'WHAT ORCHESTRATION ENGINEERING IS',
        headingJp: 'オーケストレーション工学とは',
        paragraphs: [
          'The discipline of structuring how multiple agents (and the humans they report to) pass work between each other so that a real-world outcome ships end to end. The central engineering question: given a multi-step outcome that requires several specialist agents, one or more deterministic systems, and human approval at material gates, what is the structure of the pipeline, how does work and evidence flow between nodes, and how do we know the outcome actually shipped?',
          'The structural rule: work flows down, evidence flows up, every handoff is auditable. Agents call deterministic systems for source-of-truth numbers (provenance engineering territory). Agents are isolated by OS primitives at the system boundary (agent-OS territory). Orchestration engineering is what happens between the agents: the routing, the delegation, the handoff protocols, the rollups.',
          'Without orchestration discipline, you can have audit-grade substrate and clean OS primitives and still ship nothing, because the work never gets routed to the right specialist at the right time, or the result never gets rolled up to the right human. The three disciplines stack.',
        ],
      },
      {
        heading: 'THE REFERENCE IMPLEMENTATION',
        headingJp: '参考実装',
        paragraphs: [
          '@kernel.chat/kbot-orchestrator v0.1.0-alpha.0 ships today on npm under MIT license. The v0.1 implements the outreach pipeline because that is the load-bearing loop kernel.chat itself has been running by hand for months. The pipeline reads a briefing markdown (human-authored), identifies pending recipients, sends via SMTP with Gmail App Password stored in macOS Keychain, appends an audit trail back into the briefing. Dry-run by default; sending requires explicit --confirm.',
          'The choice of which pipeline to ship first was load-bearing-ness, not novelty. kernel.chat has fired roughly fifty outreach messages across multiple batches in the past week, and the next-week schedule has thirty more queued. A working orchestrator that codifies the loop ships immediate value to the publication that produced it. Other pipelines (content production, code maintenance, multi-agent research) are roadmap.',
          'The roadmap matters less than the pattern. The point of shipping v0.1 today is that orchestration engineering is now named and demonstrated with working code, not just defined on paper. That is the discipline-naming move at its strictest: the work proves the discipline.',
        ],
      },
      {
        heading: 'THREE DOWN, THREE TO GO',
        headingJp: '残りの三つ',
        paragraphs: [
          'The field map in ISSUE 386 identified six disciplines inside agentic engineering. After today\'s naming move, kernel.chat holds three: provenance engineering, agent-OS, orchestration engineering. Three remain open to whoever names them first: skill curation, evaluation, operations (agent SRE is the obvious candidate name for the operations discipline).',
          'The pattern is portable. Anyone working seriously in one of the three unnamed disciplines can adopt the same move: write a ROLE.md (CC BY 4.0), ship a reference implementation (open-source license of your choice), publish an editorial declaration. The field becomes the sum of the disciplines that get named and shipped this way. kernel.chat will cover the disciplines other practitioners name without trying to claim them, the way ISSUE 384 covered the Five Eyes guidance without owning the regulatory discipline.',
          'Three down, three to go. The field map is the contract; the disciplines are the work.',
          '街のコーダーたちへ — 名乗ることで証明する。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 名乗ることで証明する。',
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

/* ──────────────────────────────────────────────────────────────
   ISSUE 414 — JUL 2026
   RECEIPTS, NOT RATINGS
   評価ではなく証跡を — 二が五になった日

   The wire story from outside the house — a dispatch on a
   convergence, not a postmortem on our own plumbing (contrast
   401). Peter Steinberger, in a recorded conference talk
   (YouTube, video ID 82YaJw-_t10; venue not stated on the record,
   transcribed verbatim), described three workflow tools built
   independently of this magazine that land on the exact doctrine
   this magazine has been building into every issue since 399:
   a raw trace beats a self-reported score, every time, because
   a score is a claim and a trace is a receipt. The convergence is
   the story, not either party.

   Source discipline (per PUBLISHING.md §III.2): every claim below
   is drawn directly from the transcript provided this session.
   No line is invented; the anecdote about a faked five-star
   rating is reported exactly as told, with the tool that produced
   the rating left unnamed because the transcript itself does not
   clearly name it (audio garbled on that word) — the magazine
   does not guess a proper noun into print. Peter Steinberger is
   named because he names himself on the record and speaks in the
   first person about his own tools throughout.

   The three tools, as described on the record:
     1. A default "agent transcript" skill — after a PR, the
        coding agent is prompted to attach a sanitized run
        transcript; adoption raised PR quality because transcript
        length correlates, in the speaker's own words, with
        whether the author "actually care[s] about what you fix."
     2. A default "auto review" skill — invokes whatever CLI
        review tool is on the system, routes feedback back to the
        ORIGINATING coding session (which holds full context, unlike
        a fresh reviewer session), and requires the accepted/
        rejected decisions to be written back into the PR
        description so the next reviewer does not rediscover or
        undo a deliberate design choice.
     3. "Crapbox" — disposable Linux/macOS/Windows sandboxes,
        synced to the same state as CI, with computer-use-style
        screenshot+click access over a shareable VNC link, so a
        non-technical stakeholder can verify a change without
        touching a terminal.

   Why this earned a dispatch and not an essay: it happened on a
   date (a specific recorded talk), it names real tools and a real
   person, and it leaves a doctrine — the dispatch's own defined
   use per PUBLISHING.md §III.2. It bridges most directly to 401,
   whose own doctrine ("verify by event, not handshake") is the
   same claim in different clothes: a green light is not evidence;
   a trace of one real thing happening is.

   Identity decisions (differentiated from 401, the prior dispatch
   — ivory / asymmetric-left / pool):
     • coverStock = 'ivory' — sober, lab-bench register; a report
       on an outside methodology reads on the same cold paper as
       401's postmortem. Shared with 401 on purpose (both are
       "the desk verifies a claim" stories) but differentiated on
       accent and seal.
     • coverLayout = 'asymmetric-left' — the dispatch column
       rhythm; unchanged, per house habit for this format.
     • coverSeal = RECEIPTS OVER RATINGS — the convergence,
       stamped as the finding.
     • accent = 'brick' — dispatch's OWN default ("record-of-
       record"), used at default rather than 401's pool (systems/
       plumbing), because this story's register is evidentiary
       record-keeping, not infrastructure failure.
     • spread.type = 'dispatch', spread.stock = 'ivory'.

   Identity-catalog row to add to docs/design-language.md:

     | 414 | ivory | asymmetric-left | — | seal: RECEIPTS OVER RATINGS · VII·26 | brick | dispatch | External-convergence dispatch: a recorded talk (Peter Steinberger, on the record) describes three independently-built tools — transcript-attachment, auto-review-to-origin-session, disposable VNC sandboxes — that land on kernel.chat's own doctrine (raw trace over self-reported score); includes a verbatim account of a faked 2→5 PR rating as rule-6's villain witnessed in the wild; bridges to 401's "verify by event, not handshake" | first dispatch whose subject is an external party's independent convergence with house doctrine, not the house's own operational record |
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_414: IssueRecord = {
  number: '414',
  month: 'JUL',
  year: '2026',
  feature: 'RECEIPTS, NOT RATINGS',
  featureJp: '評価ではなく証跡を',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ivory',
  coverLayout: 'asymmetric-left',

  coverSeal: {
    label: 'RECEIPTS OVER RATINGS',
    date: 'VII·26',
  },

  accent: 'brick',

  headline: {
    prefix: 'Receipts,',
    emphasis: 'Not',
    suffix: 'Ratings.',
    swash: 'An engineer described, on the record, three tools built with no contact with this magazine — and landed on its exact doctrine. The proof arrived as an anecdote: a bot rated a PR a two, and someone typed over it with a five.',
  },

  contents: [
    { n: '001', en: 'The constraint kept moving', jp: '制約は移り変わった', tag: 'FIELD' },
    { n: '002', en: 'Attach the transcript', jp: '記録を添付する', tag: 'RECEIPTS' },
    { n: '003', en: 'The two that became a five', jp: '二が五になった日', tag: 'CAUTION' },
    { n: '004', en: 'Send it back where it started', jp: '元のセッションへ戻す', tag: 'LOOP' },
    { n: '005', en: 'What receipts do not replace', jp: '証跡が代われないもの', tag: 'DOCTRINE' },
  ],

  spread: {
    type: 'dispatch',
    kicker: 'DISPATCH · 速報',
    title: 'Receipts, Not Ratings.',
    titleJp: '評価ではなく証跡を。',
    deck: 'In a recorded talk, engineer Peter Steinberger described three workflow tools — built with no contact with this magazine — that converge on kernel.chat’s own operating doctrine: a raw trace beats a self-reported score, every time. The proof he offered was an anecdote about a rating bot, a two, and a five that was never earned.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    slug: 'KERNEL.CHAT WIRE · 414 · VII·26 · TRANSCRIPT ATTACHED · RATING FAKED · RECEIPTS WIN · RECORDED TALK, ON THE RECORD',

    dateline: 'THE OPERATIONS DESK — JULY — FILED FROM A RECORDED CONFERENCE TALK, TRANSCRIBED VERBATIM.',

    filedAt: '6 JUL 2026 · COVERING ONE TALK',
    status: 'FILED',

    bridge: {
      issue: '401',
      text: '401’s doctrine was verify by event, not handshake — a green light is not evidence. This dispatch is the same claim spoken independently, in public, by someone with no reason to have read 401 at all.',
    },

    intro: 'Peter Steinberger spent a conference talk narrating where his own constraint kept moving — tokens, then CPU, then attention — and, along the way, described three small tools built to fight the last one. None of the three reference this magazine. All three land on the doctrine this magazine has printed since 399: a claim about quality is worth exactly as much as the trace behind it, and no more. The convergence is the story.',

    propositions: [
      {
        n: '01',
        overline: 'FIELD',
        title: 'The constraint kept moving.',
        titleJp: '制約は移り変わった',
        body: [
          'On the record: "last year I was constrained by token... then I was constrained by CPU... and now I feel my constraint is actually attention." Three bottlenecks in sequence, each solved enough to reveal the next one underneath it — and the reframe he drew from that sequence is the useful part: "what you really want to optimize is how often you need to be in the loop with your agent."',
          'That is a claim about economics, not aesthetics. When attention is the scarce resource, anything that reduces how often a human must be summoned is worth more than anything that merely produces more work for a human to check. It is the same math this magazine has printed under a different name: calm by default is not a mood, it is a cost model.',
        ],
      },
      {
        n: '02',
        overline: 'RECEIPTS',
        title: 'Attach the transcript.',
        titleJp: '記録を添付する',
        body: [
          'The first tool: a default skill that prompts a coding agent, after opening a PR, to attach a sanitized transcript of the session that produced it. No hooks, no infrastructure — "it\'s just a skill." Adoption was voluntary and the effect was immediate: "the longer your transcript is, the higher is my confidence that you actually care about what you fix."',
          'That sentence is the audit colophon this magazine stamps on every issue, arrived at independently: drafted-by, verified-by, what was kept, what was cut — provenance as the actual argument for trust, not a rating appended after the fact. Two parties, no contact, the same doctrine. By the house’s own rule (second arrival turns coincidence into pattern), this is now a pattern.',
        ],
      },
      {
        n: '03',
        overline: 'CAUTION',
        title: 'The two that became a five.',
        titleJp: '二が五になった日',
        body: [
          'The anecdote that anchors this dispatch, reported exactly as told: an automated review pass had been rating pull requests one to five. "We found more than one instance where it would give it a two, and then people just manually edited the description to give it a five and say this is a great PR, merge." Asked whether anyone had faked a transcript the same way, the answer was direct: "I would not be surprised."',
          'This is rule six’s villain, witnessed in the field rather than argued in the abstract: the moment a score exists, the score gets composed for. A number invites a number-shaped lie. A transcript — long, unglamorous, hard to fabricate at length — resists the same move, not because it cannot be faked, but because faking it costs more than earning it.',
        ],
      },
      {
        n: '04',
        overline: 'LOOP',
        title: 'Send it back where it started.',
        titleJp: '元のセッションへ戻す',
        body: [
          'The second tool: an "auto review" skill that invokes whichever CLI review tool is already on the system and routes the feedback back to the session that wrote the code — not a fresh reviewer session, which "actually hasn\'t fully understood what the PR is about and all the constraints" and can break something that was in fact a deliberate design decision. The originating session gets the review, gets to decide what stands, and — the load-bearing detail — writes that decision back into the PR description, so the next person who opens it inherits the reasoning rather than rediscovering it.',
          'A narration channel, plan-to-decision, filed where the next reader will actually trip over it: this is the shape of a decision journal, built for a different reason, converging on the same architecture. The magazine printed its own version of exactly this discipline in 408 — decisions logged with rationale at every phase of an unattended loop, not summarized after the fact.',
        ],
      },
      {
        n: '05',
        overline: 'DOCTRINE',
        title: 'What receipts do not replace.',
        titleJp: '証跡が代われないもの',
        body: [
          'Asked directly whether the attention constraint had been solved, the answer was measured rather than triumphant: "to a degree" — agents need "much less babysitting," but "you still need the thinking of like, is this actually something we want? Nobody can take away." Asked what bothers him most about the current workflow, the answer was one sentence: "it still requires so much syncing" — because agents "are just not really good at understanding how does this one thing fit into the big picture."',
          'That is the doctrine this dispatch files. Receipts do not replace judgment; they make judgment cheaper to apply and far more expensive to fake around. A transcript proves work happened. It does not prove the work was the right work. The second question is still, on the record and by the account of someone building exactly these tools for a living, a human’s to answer.',
        ],
      },
    ],

    bulletin: {
      text: 'A bot rated the work a two. Someone typed over it with a five and the word merge.',
      attribution: 'PETER STEINBERGER · RECORDED TALK · VII·26',
    },

    outro: 'File this beside 401. That dispatch closed on one sentence — never call a thing verified until one real event has come out the far end — and this one arrives at the same sentence from a stranger’s mouth, about a different kind of pipeline entirely. A rating is a claim about a review that may never have happened carefully. A transcript is a record that it did. The house keeps printing audit colophons for the same reason Steinberger keeps attaching transcripts: not because either of us distrusts agents, but because a claim with no receipt behind it is worth exactly what it costs to type.',

    signoff: '街のコーダーたちへ — attach the transcript; a rating is a claim, a receipt is a trace.',

    terminator: 'END OF DISPATCH · KERNEL.CHAT/414 · FILED 6 JUL · ONE TALK · ONE ANECDOTE CONFIRMED · INK STILL WET',
  },

  audit: {
    drafted: 'magazine-editor · claude-sonnet-5 session, VII·26',
    verified: 'every quoted line traced to the provided transcript (YouTube video ID 82YaJw-_t10); the rating tool’s name withheld — audio unclear on that word, and the magazine does not print a guessed proper noun',
    adherence: 'DispatchSpread — no new spread type, no new interaction shape; standard wire form per PUBLISHING.md §III.2',
    readCut: 'kept the "I would not be surprised" line rather than softening it into a cleaner endorsement of the transcript-skill\'s reliability',
    pressed: 'VII·26 · 2026-07-06',
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

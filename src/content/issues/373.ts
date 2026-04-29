/* ──────────────────────────────────────────────────────────────
   ISSUE 373 — APRIL 2026
   ON COMPOSITION — DIFFERENT CATEGORIES, NOT COMPETITORS
   構成について — 隣り合うこと、競争でなく

   The essay 370 promised one level up. 370 declared that a
   design language is found by picking a spine and decoding the
   neighbours; 371 exercised the framework on a cinematographer.
   373 raises the same framework one level — to AI tools. Three
   things came up this week and got flattened by the viral feed
   onto a single axis (memory at startup, time-to-first-token):
   jcode (a fast meta-harness that wraps an existing
   subscription), kbot (a parallel BYOK agent with vertical depth
   in music, security, computer-use, channels), and Claude Code
   (the reasoner). On the wrong axis, one wins. On the right
   axes, they compose.

   The claim of this issue is that the editorial-neighbours
   discipline applies to the tools we use to think. Pick a spine
   (Claude Code, for its reasoning); collect the neighbours
   (jcode for harness speed, kbot for vertical depth); steal the
   mechanic (the seam where they hand off to each other) without
   imitating the silence (kbot doesn’t ape Claude Code, jcode
   doesn’t pretend to reason, Claude Code doesn’t learn
   Ableton). The proof is that the v4.0.1 release of kbot ships
   a templates/jcode-mcp-snippet.json so jcode users can wrap
   kbot as a backend. Composition becomes infrastructure when
   you write down where the seams are.

   Identity decisions:
     • coverStock = 'cream'           — anchor stock. 370 was
                                        cream as monument-hero;
                                        373 returns to cream as
                                        the foundational paper
                                        for a foundational
                                        argument. No new
                                        register needed.
     • coverLayout = 'asymmetric-left' — editorial-column rhythm,
                                        mirroring 371’s profile
                                        rhythm. The cover hosts a
                                        quieter argument; the
                                        left-aligned lockup gives
                                        the prose its weight.
     • accent           = default      — tomato, omitted. No
                                        experiment here. The
                                        argument itself is the
                                        move; the palette stays
                                        canonical.
     • coverOrnament    = none         — restraint by absence.
                                        370 earned the quiet
                                        cover at the milestone;
                                        373 earns the quiet cover
                                        by letting the prose land
                                        without help.
     • coverSeal        = none         — same reasoning. No
                                        postmark dateline either;
                                        this subject is not
                                        place-bound. Postmark is
                                        held back for an issue
                                        whose subject is.
     • spread.type      = 'essay'      — long-form prose, the
                                        right tool for an
                                        argument. No dossier, no
                                        filmstrip, no data block:
                                        the essay alone makes the
                                        case.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_373: IssueRecord = {
  number: '373',
  month: 'APRIL',
  year: '2026',
  feature: 'ON COMPOSITION — DIFFERENT CATEGORIES, NOT COMPETITORS',
  featureJp: '構成について — 隣り合うこと、競争でなく',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream stock, asymmetric-left layout, no
      ornament, no seal, no declared accent. The anchor stock
      under the editorial-column lockup, with the prose alone
      carrying the issue. The most under-decorated cover of the
      run, and the one that has to read on the strength of the
      argument. */
  coverStock: 'cream',
  coverLayout: 'asymmetric-left',

  headline: {
    prefix: 'Different',
    emphasis: 'Categories,',
    suffix: 'Not Competitors.',
    swash: 'On editorial neighbours, applied to the tools we use to think.',
  },

  contents: [
    { n: '001', en: 'The magazine’s own practice', jp: '雑誌自身の実践', tag: 'METHOD' },
    { n: '002', en: 'Three tools, one feed', jp: '三つの道具、一つの流れ', tag: 'FIELD' },
    { n: '003', en: 'The wrong axis', jp: '間違った軸', tag: 'CRITIQUE' },
    { n: '004', en: 'The right framing', jp: '正しい枠組み', tag: 'STRUCTURE' },
    { n: '005', en: 'Composition as infrastructure', jp: '構成を基盤に', tag: 'PROOF' },
    { n: '006', en: 'The same room, one floor up', jp: '同じ部屋、一階上', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'METHOD SPREAD · ★ · 方法',
    title: 'Different Categories, Not Competitors.',
    titleJp: '隣り合うこと、競争でなく。',
    deck: 'A small claim filed at issue 373. The editorial-neighbours grammar — the spine, the neighbours, the borrow without imitation — is not only how this magazine reads other magazines. It is also, as it happens, the right way to read the AI tools sitting next to each other on the desk.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE MAGAZINE’S OWN PRACTICE',
        headingJp: '雑誌自身の実践',
        paragraphs: [
          'This magazine has a spine and it has neighbours. The spine is one specific magazine — picked, named in private, never named on the cover, decoded from memory at the start of every issue. The neighbours are the others on the shelf: PAPERSKY first, then a slowly growing file of decoded references, each entered with a list of borrowable mechanics next to it.',
          'The discipline of the neighbours is not a discipline of comparison. We do not rank the magazines, do not pick the winning one, do not run a feature on which is best at margins or which is best at type. We pick the spine because we needed an anchor and that magazine’s anchor matched what we wanted to build. We collect the neighbours because each of them does one move the spine does not, and we want the move without the costume.',
          'The grammar of editorial neighbours, written down in our own design notes a year ago, has four small rules: pick the spine; collect the neighbours; steal mechanics, not silence; reduce to one mark you use everywhere. The rules look like rules for a magazine. This issue claims they are also, almost word for word, the rules for a working stack of tools.',
        ],
      },
      {
        heading: 'THREE TOOLS, ONE FEED',
        headingJp: '三つの道具、一つの流れ',
        paragraphs: [
          'Three things came across the feed this week. The first was jcode — a meta-harness, a thin command-line wrapper that boots in roughly fourteen milliseconds and dispatches the work to whichever underlying agent the user already has a subscription to: Claude Code, Codex, OpenCode, Pi. jcode does not reason; jcode launches. Its argument for itself is that the cold start is fast, the surface is small, and it stays out of the way of the agent the user is paying for elsewhere.',
          'The second was kbot, the magazine’s own working agent — a parallel BYOK system that boots in roughly ninety-one milliseconds and brings about a hundred specialty skills with it: a music-software bridge that drives Ableton through a typed protocol, a security toolkit, a computer-use layer for desktop control, a memory-and-channels system that survives across sessions, a dream engine that consolidates the day’s work overnight. kbot does not wrap a subscription; it asks for the user’s own provider keys and pays its own way.',
          'The third was Claude Code itself — the reasoner. The Anthropic harness running Opus 4.7, the model both jcode and kbot can hand work off to, the surface that, on the right kind of question, simply outthinks anything next to it. Claude Code is not fast in the way jcode is fast and not deep in the way kbot is deep. It is something else: it is the thing that, when the question is hard, knows what to do about it.',
        ],
      },
      {
        heading: 'THE WRONG AXIS',
        headingJp: '間違った軸',
        paragraphs: [
          'The viral framing of those three tools, when it surfaces in the feed, almost always picks a single axis and ranks them on it. Cold-start time. Memory at startup. Latency to first token. Number of tools registered. Cost per million tokens. Stars on GitHub. Pick any one of these and one of the three tools wins the chart. The chart is shareable. The chart is, on its own terms, accurate. The chart is wrong.',
          'It is wrong because the three tools are not the same kind of object. Asking which one is faster is asking which one of a magazine, a printing press, and a typesetter is faster. The question has a literal answer; the literal answer does not describe the work. A meta-harness is supposed to be small and fast — that is the entire job. A parallel agent with a hundred specialty skills is supposed to be heavier — that is also the job. A reasoner running Opus 4.7 is supposed to spend its compute on thinking — that, again, is the job.',
          'The chart flattens three categories onto one axis and declares a winner. The categories disappear. What is left is a feed item that performs as comparison and reads, on closer inspection, as a category error.',
        ],
      },
      {
        heading: 'THE RIGHT FRAMING',
        headingJp: '正しい枠組み',
        paragraphs: [
          'The right framing is the editorial one. Each tool does a job the others structurally cannot. Claude Code reasons; that is the spine. jcode wraps the subscription the user already has, fast, with almost no surface area; that is one neighbour. kbot owns the verticals — Ableton, security, computer-use, memory, channels — and pays its own way through BYOK; that is the other neighbour.',
          'On the right axes the picture changes. Pick the axis "cold start to a wrapped subscription" and jcode is the answer. Pick the axis "depth in a vertical I care about, with no subscription dependency" and kbot is the answer. Pick the axis "what should I send the genuinely hard question to" and Claude Code is the answer. None of these answers compete. They name three different rooms, and the work moves between the rooms over the course of a day.',
          'The neighbours discipline is the same as the magazine’s. Pick a spine — the reasoner — because the hard questions need somewhere to land. Collect the neighbours — the harness for speed, the agent for depth — because each of them does a move the spine does not. Steal the mechanic, which here is *handing work off cleanly across the seam between tools*, and leave the silence. Reduce to one small mark — in the codebase’s case, a single shared protocol — that travels through every layer.',
        ],
      },
      {
        heading: 'COMPOSITION AS INFRASTRUCTURE',
        headingJp: '構成を基盤に',
        paragraphs: [
          'The proof, this week, is in a small file. The kbot 4.0.1 release pushed a snippet at templates/jcode-mcp-snippet.json — a five-line MCP block that lets a jcode user mount kbot as a backend. The harness gets its fast cold start; it forwards the deep verticals to kbot; the user keeps using their existing subscription for everything else. No tool is replaced. No category is collapsed.',
          'Until that snippet existed, the composition was theoretical — *of course* the three tools could be used together, in principle, by anyone with the patience to wire them up. After the snippet exists, the composition is infrastructure. The seams have addresses. The neighbours have a contact card. The handoff between categories is a configuration block, not a manifesto.',
          'This is the editorial-neighbours framework cashed in at the level of code. The PAPERSKY paper-airplane is a small mark used everywhere. The kbot–jcode MCP snippet is a small file used at the seam. Both reduce something the system was already doing implicitly to one explicit, repeatable, one-line move. Both are how a working file of neighbours becomes a working stack.',
        ],
      },
      {
        heading: 'THE SAME ROOM, ONE FLOOR UP',
        headingJp: '同じ部屋、一階上',
        paragraphs: [
          'There is a habit the feed encourages that this magazine should resist. The habit is to take three things and ask which one is best, post the chart, count the engagements, move on. The habit produces sharp posts and dull thinking. It treats every triplet as a tournament and every category as a dimension on the same axis.',
          'The editorial-neighbours framework is the alternative. It says: hold space for the neighbours. Decode each one separately. Borrow the mechanic; refuse the imitation. Build the layered thing — a spine plus a working file of decoded references — and let the layers each be themselves. The framework was written down for magazines first because the magazines were the example we had. It works on tools. It probably works on most things you can put more than one of in a room.',
          'A magazine claims very little, in general. This issue makes one small claim and intends to leave it there: when the next chart appears with three tools on it and one of them winning, ask what axis the chart is using and whether all three were even in the same category to begin with. Most of the time they are not. Most of the time the right answer is to keep all three, on different shelves, and write down where the seams are.',
          '街のコーダーたちへ ★ pick the spine; hold the neighbours; borrow the mechanic; write the seam down where the next reader can find it.',
        ],
      },
    ],

    pullQuote: {
      text: 'Asking which one is faster is asking which one of a magazine, a printing press, and a typesetter is faster. The question has a literal answer; the literal answer does not describe the work.',
      attribution: 'KERNEL.CHAT · ON THE WRONG AXIS',
    },

    signoff: '街のコーダーたちへ ★ different categories, not competitors — and write the seam down.',
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

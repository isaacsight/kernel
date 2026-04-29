/* ──────────────────────────────────────────────────────────────
   ISSUE 374 — APRIL 2026
   AGAINST VIRAL BENCHMARKS
   脚注こそが命 — 「20倍」の見出しに落ちた星印について

   A craft piece, not a takedown. A TikTok claimed an open-source
   agent harness was "20× more memory efficient than Claude Code."
   The README's actual figure was 13.9× at one session, 19.7× at
   ten sessions, both *with the embedding subsystem disabled*.
   Default config (the user-visible one): 8.8×. The footnote was
   load-bearing; the headline number was selected to win the
   share, not to inform. The repo, project, and engineer are all
   real and impressive — only the framing is doing journalism it
   shouldn't.

   The essay argues the durable signal is methodology: hardware
   spec, sample size, exclusion criteria, reproduction commands.
   kbot's BENCHMARKS.md is the foil — it lists where kbot wins
   (Aider 4.4×, OpenCode 5.7×) and where kbot loses (Claude Code,
   Codex, jcode on raw boot) with n=5 numbers and a copy-paste
   shell loop. The point isn't who wins; it's that the comparison
   is real.

   Identity decisions:
     • coverStock = 'ivory'           — the lab-bench / press-
       preview white. Ivory is the right paper for sober,
       methodological claims; cream would be too warm, ink too
       dramatic. The argument is plain, the paper is plain.
     • coverLayout = 'classic'        — centered, monument
       bottom-right. No monument-hero, no asymmetric drama. The
       cover earns its quiet by being structurally ordinary while
       the inside is structurally rigorous. (See ISSUE 370 §06,
       "earn the quiet cover" — except where 370 cashed quiet at
       a milestone, 374 cashes it because the topic itself is
       about restraint.)
     • coverOrnament = (none)         — see note below.
     • coverSeal                      — omitted. POSTMARK DATELINE
       is explicitly held back per brief; a generic seal would
       muddy that restraint.
     • accent = 'tomato'              — default. The essay is
       house-voice, methodological, and explicitly NOT a manifesto
       or after-hours register. Tomato keeps it in the magazine's
       canonical warm grammar.
     • spread.type = 'essay'          — long-form prose, drop cap,
       section kickers, pull quote. No dossier (the methodology
       is the body of the piece, not a top-card abstract); no
       filmstrip; no dataBlock (the numbers belong inline, where
       a reader follows the prose into them — putting them in a
       grid would do exactly what the TikTok did).

   Author note — proposed future ornament:
     The brief asked for `coverOrnament: 'asterisk-stamp'`, the
     metaphor being "the asterisk that should have followed the
     headline number." The IssueCoverOrnament union currently
     allows only 'ink-spread' | 'warty-spots' | 'flash-burn'.
     `asterisk-stamp` is a candidate addition for a future issue
     and would extend the §III.5 signature-move catalog: a small
     tomato asterisk rendered as a rubber-stamp impression, sized
     between the seal and the wordmark, ideally placed near the
     monument number so the cover literally carries the asterisk
     a published headline would have. ISSUE 374 ships without an
     ornament rather than substitute a less appropriate one. The
     ornament is held for the issue that earns it.

   Voice constraints honored:
     - The TikTok creator is not named. The engineer is not
       named. The project is not named on the cover; on the
       inside, "an open-source agent harness" carries the
       reference without naming the repo, even though
       jcode-analysis.md and BENCHMARKS.md cite the project
       directly. The essay is a craft piece, not a call-out.
     - No "POPEYE" string. No app vocabulary.
     - The numbers cited (13.9×, 19.7×, 8.8×, kbot 91ms,
       jcode ~14ms, Aider 396ms, OpenCode 519ms) come straight
       from BENCHMARKS.md and the cited project's README via
       jcode-analysis.md.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_374: IssueRecord = {
  number: '374',
  month: 'APRIL',
  year: '2026',
  feature: 'AGAINST VIRAL BENCHMARKS',
  featureJp: '脚注こそが命 — バイラル・ベンチマークについて',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory stock + classic layout, no ornament,
      no seal. The paper is plain because the argument is plain.
      An issue arguing that methodology is the durable signal
      should not arrive dressed up. */
  coverStock: 'ivory',
  coverLayout: 'classic',
  /** Asterisk-stamp — a small asterisk rendered as a postmark-style
      stamp, slightly off-register. The metaphor at the heart of the
      issue: the asterisk that should have shipped with the headline
      number. Newly admitted to the cover-ornament union alongside
      this issue. Distinct from the system-glyph asterisk that
      travels through the folio strip. */
  coverOrnament: 'asterisk-stamp',

  /** Tomato — house default. The essay belongs in the magazine's
      canonical warm grammar; deviating would imply a register
      shift the topic doesn't ask for. */
  accent: 'tomato',

  headline: {
    prefix: 'The',
    emphasis: 'Footnote',
    suffix: 'Was Load-Bearing.',
    swash: 'On viral benchmarks, methodology, and the asterisk that should have shipped with the headline.',
  },

  contents: [
    { n: '001', en: 'Eight hours old', jp: '八時間前のシェア', tag: 'OPENING' },
    { n: '002', en: 'The number, with the asterisk', jp: '見出しの数字と、本当の脚注', tag: 'NUMBERS' },
    { n: '003', en: 'Two reward functions', jp: '二つの評価関数', tag: 'INCENTIVES' },
    { n: '004', en: 'Why magazines publish methodology', jp: 'なぜ雑誌は手法を載せるのか', tag: 'CRAFT' },
    { n: '005', en: 'The kbot foil', jp: 'kbotという対照', tag: 'COMPARISON' },
    { n: '006', en: 'Where the asterisk belongs', jp: '星印のあるべき場所', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'CRAFT SPREAD · 手法',
    title: 'The Footnote Was Load-Bearing.',
    titleJp: '脚注こそが命。',
    deck: 'A TikTok said "20× more memory efficient than Claude Code." The README said 13.9× at one session, 19.7× at ten — with the embedding subsystem disabled. Default config: 8.8×. The footnote was the most editorial part of the original benchmark, and the share dropped it. Notes on what magazines are for.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'ivory',

    sections: [
      {
        heading: 'EIGHT HOURS OLD',
        headingJp: '八時間前のシェア',
        paragraphs: [
          'The TikTok was eight hours old when we saw it. The framing was the kind that travels: a young engineer in front of a terminal, the cursor blinking, a chyron in punchy sans-serif across the lower third. NEW AGENT HARNESS JUST BLEW PAST CLAUDE CODE & CODEX. 20× MORE MEMORY EFFICIENT. By morning the clip had passed two million views, and the comments under it were already doing the next stage of the work — declaring the older harnesses obsolete, asking which YouTube channel to follow, demanding a Mac build by Tuesday.',
          'The repo behind the clip is real. The project is real. The engineer is real and, by any honest accounting, remarkable: a single contributor pushing roughly two hundred and ten commits a week, four months into a Rust-native rewrite of an entire category of developer tool. Stars are climbing. The benchmark tables in the README are detailed, candid, and signed. None of this issue is about that engineer, or that repo, or even about Rust versus Node. The engineer is doing the work. The work is honest. Only the headline number is doing journalism it should not.',
          'Magazines exist, in a small but real way, to keep asterisks where they belong. This issue is about a missing one.',
        ],
      },
      {
        heading: 'THE NUMBER, WITH THE ASTERISK',
        headingJp: '見出しの数字と、本当の脚注',
        paragraphs: [
          'The README publishes three numbers, and they are all in the same table. With one active session, the harness consumes 27.8 MB of memory against Claude Code’s 386.6 MB — a ratio of 13.9×. With ten active sessions, the gap widens: 117 MB against 2,300 MB, a ratio of 19.7×. Both numbers are measured *with the local embedding subsystem disabled*. With the embedding subsystem on — which is the user-visible default the harness ships — the same ten-session comparison is 261 MB against 2,300 MB, or 8.8×.',
          'Three numbers, one footnote. 13.9× at one session with embeddings off. 19.7× at ten sessions with embeddings off. 8.8× at ten sessions with embeddings on, which is the configuration almost every reader of the TikTok will actually run. The headline rounded the second number up to twenty and dropped the rest. It is not a lie; you cannot meaningfully say 19.7× rounds *down*. It is a selection. Of the three available framings, the share picked the one that won the share, and the price of that selection was the asterisk.',
          'A footnote in a benchmark is not decoration. It is the part of the document that says: here is the configuration, here is the caveat, here is what you would have to disable to reproduce this number. A footnote is a methodology statement compressed into superscript. Drop it and the number becomes a slogan.',
        ],
      },
      {
        heading: 'TWO REWARD FUNCTIONS',
        headingJp: '二つの評価関数',
        paragraphs: [
          'The share-cycle has its own optimization target. It rewards round numbers, big-name comparisons, and a single axis the eye can lock onto in three seconds before the thumb scrolls. "Twenty times more memory efficient than Claude Code" passes that test perfectly: round number, top-of-mind incumbent, single axis. "Eight point eight times more memory efficient than Claude Code at ten concurrent sessions, with the local embedding subsystem enabled as it ships" passes none of it. The thumb is gone before the second clause.',
          'Journalism — even small-magazine, low-stakes, footnoted-in-margins journalism — is optimizing for something else. Methodology. Hardware spec. Sample size. Exclusion criteria. Whether the runs were warm-cached or cold-disk. Whether the comparison harness was launched with its own defaults or with the test author’s defaults. None of these belong in a fifteen-second clip; all of them belong in the document the clip points to. The two reward functions are not enemies. They are simply pointed at different time horizons. The share is optimizing for the next eight hours; the methodology is optimizing for the next eight months.',
          'The mistake is treating the share as the document. The share is a flag planted on top of the document. If the document is rigorous, the flag holds. If the document is a single Linux machine with no hardware spec, no percentile distribution, and one footnote that was the most important sentence in the whole table, the flag is in sand.',
        ],
      },
      {
        heading: 'WHY MAGAZINES PUBLISH METHODOLOGY',
        headingJp: 'なぜ雑誌は手法を載せるのか',
        paragraphs: [
          'A magazine that publishes a piece without method is publishing a feed item. A magazine that publishes a piece with method is publishing a record. The difference is not length, or rigor, or even accuracy in any single instance — both can land the same number on the same day. The difference is what survives the share-cycle. Numbers without a method are confetti. Numbers with a method are evidence. Confetti is louder for an afternoon; evidence is louder forever.',
          'The shape of the work survives the share. The shape is the methodology. It is the table caption that says n=5 and not "I ran it on my Linux box." It is the column that lists the version of every CLI under test. It is the sentence at the bottom that reads, "If you don’t see your favorite tool here, it isn’t on disk." It is the copy-pasteable shell loop printed below the table so a reader on the other side of the world can rerun the experiment in their own kitchen, on their own machine, against their own background processes, and either confirm or correct the number. The reader rerunning the experiment is not the editor’s adversary. The reader rerunning the experiment is the editor’s collaborator. A magazine that publishes the loop is welcoming the collaboration.',
          'A magazine that does not publish the loop is asking for trust without giving the means to check it.',
        ],
      },
      {
        heading: 'THE KBOT FOIL',
        headingJp: 'kbotという対照',
        paragraphs: [
          'kbot, the terminal agent this magazine’s engineering desk also runs, kept its own benchmarks document as a foil while this issue was being written. The document begins with the sentence that should begin every benchmarks document: "Methodology — read first." It states n=5. It states the hardware. It states which CLIs were measured ("every coding-agent CLI installed on the test machine — if you don’t see one, it isn’t on disk"). It states which runs were excluded — none — and gives all five raw numbers per CLI per metric, not just the average. Below the table, a four-line shell loop reproduces every figure.',
          'The numbers themselves are mixed. kbot beats Aider four-point-four times over on cold start; beats OpenCode five-point-seven times over. kbot loses to Claude Code, loses to Codex, and loses outright to the harness that started this essay — which boots in roughly fourteen milliseconds against kbot’s ninety-one. The document records the loss without softening it: "Node and TypeScript can’t beat Rust on startup. We’re not chasing this." It also records what the boot-time axis does not measure — cost per finished task, vertical depth (Ableton, security, computer-use, local image generation), offline availability — and gives reproduction commands for those axes too.',
          'The point of the foil is not that kbot wins. On the axis the TikTok picked, kbot loses. The point is that the comparison is real. Where kbot wins, you can rerun the experiment and see it win. Where kbot loses, you can rerun the experiment and see it lose. The asterisks are printed. The reader is trusted. That is what a benchmark is when it is allowed to be a piece of journalism rather than a piece of marketing.',
        ],
      },
      {
        heading: 'WHERE THE ASTERISK BELONGS',
        headingJp: '星印のあるべき場所',
        paragraphs: [
          'The viral clip will keep traveling. It is doing what the medium asks of it. The harness it points at is going to be remembered as the one that was twenty times more efficient, and most of the people who remember it that way will never read the table the number came from. That is not a tragedy. It is the price of working in a culture where the share is faster than the document. The price is paid by everyone — the engineer who shipped the honest README, the reader who runs the harness with embeddings on and finds the gap is closer to nine, the next benchmarker who has to compete against a number nobody will ever again look up.',
          'The price could be lower. It would be lower if the people best positioned to publish numbers — the maintainers, the methods-papers magazines, the small editorial outfits that still treat a footnote as load-bearing — kept publishing them with the methodology in plain view. The asterisk that the share dropped is the most editorial part of the original document. The work of the magazine is to keep printing it.',
          'A design language is found, not designed. So is a craft of measurement. You find it the way you find anything durable — by writing the conditions down, by stating the sample, by showing the loop, by leaving the asterisk in. Once. Then again. Then for the eight months after the share-cycle has forgotten which clip was which.',
          '街のコーダーたちへ — print the methodology; keep the footnote; the asterisk is the editorial.',
        ],
      },
    ],

    pullQuote: {
      text: 'A footnote in a benchmark is not decoration. It is a methodology statement compressed into superscript. Drop it and the number becomes a slogan.',
      attribution: 'KERNEL.CHAT · ON THE LOAD-BEARING ASTERISK',
    },

    signoff: '街のコーダーたちへ — print the methodology; keep the footnote; the asterisk is the editorial.',
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

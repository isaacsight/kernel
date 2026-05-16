/* ──────────────────────────────────────────────────────────────
   ISSUE 383 — MAY 2026
   ON THE COMMITMENT
   約束について — フロンティアが基盤の形を写し取る

   The second fieldwork issue. Where ISSUE 382 read the consumer
   surface (Alexa "Buy for Me") as proof of the material-gate
   pattern, ISSUE 383 reads the frontier-lab surface (Anthropic's
   Project Glasswing + Claude Mythos Preview) as proof of the
   cryptographic-commitment pattern that the substrate has been
   shipping under a different name.

   Glasswing's specific demonstration: SHA-3 hash-commitments to
   undisclosed vulnerabilities. Publishing a hash of evidence you
   hold but cannot yet reveal, so you can later verify you held
   the finding at publication time without prematurely exposing
   its content. The discipline that calls itself provenance
   engineering recognizes this immediately as a sibling of the
   content-addressed envelope pattern kbot-finance ships for
   regulated workflows. Different surface, same shape.

   Identity decisions:

     • coverStock = 'cream' — the working register, third issue
       in a row in the analytical voice. 380, 382, and 383 form
       a visual triplet: the discipline doing fieldwork after the
       manifesto of 381 declared the throughline. The repetition
       is editorial choice; the issues that sit beside one another
       in cream are the issues that read the world coldly.

     • coverLayout = 'asymmetric-left' — same as 380 and 382. The
       regular working shape. The discipline at work, not the
       discipline declaring.

     • coverOrnament = 'asterisk-stamp' — fourth issue running.
       The mark is now the magazine's editorial-footnote glyph,
       used when the writing annotates something that shipped
       elsewhere. The asterisk that should have been on Anthropic's
       press release.

     • coverSeal = MIRRORED · COMMITMENT · V·26 — new verb. The
       frontier MIRRORED what the substrate already does. The
       object is the SHA-3 commitment pattern specifically — the
       sibling of the content-addressed envelope, named separately
       at frontier scale.

     • accent = 'cobalt' — the systems-essay register. Same as
       380 and 382. The temperature when the writing is examining
       a pattern coldly.

     • spread.type = 'essay' — sections, headings, paragraphs.
       The same form the discipline uses between manifestos.

   The dateline event is Anthropic's Glasswing announcement
   (May 14, 2026): Claude Mythos Preview given to AWS, Apple,
   Cisco, Google, JPMorgan Chase, Microsoft, and ~40 other
   critical-infrastructure organizations for finding and patching
   vulnerabilities. The model identified thousands of zero-days
   including a 27-year-old OpenBSD flaw. The mechanism worth
   reading carefully is not the bug count — it is the publication
   of SHA-3 224 hashes of undisclosed vulnerabilities in the
   release appendix, a literal instance of provenance engineering
   in a different costume.

   The back cover names a physical artefact carrying the
   commitment shape — a sealed envelope with a wax-impressed seal
   over the closure, the centuries-old pattern of "the contents
   are committed; the opening is recorded; the seal proves the
   record." Cream stock to match the front. ────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_383: IssueRecord = {
  number: '383',
  month: 'MAY',
  year: '2026',
  feature: 'ON THE COMMITMENT',
  featureJp: '「約束について」',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — cream stock, asymmetric-left, asterisk-stamp.
      Third issue in the working-register triplet after 380 and 382.
      The repetition is the editorial choice. */
  coverStock: 'cream',
  coverLayout: 'asymmetric-left',
  coverOrnament: 'asterisk-stamp',

  /** Registry stamp — MIRRORED is a new verb. The frontier
      mirrored what the substrate already does. The object is the
      SHA-3 cryptographic-commitment pattern specifically. */
  coverSeal: {
    label: 'MIRRORED · COMMITMENT · V·26',
    date: 'V·26',
  },

  /** Cobalt — same as 380 and 382. The systems-essay register. */
  accent: 'cobalt',

  /** Back cover: the physical analog of the commitment pattern —
      a sealed envelope with wax impression over the closure. The
      centuries-old shape of "contents committed; opening recorded;
      seal proves the record." Cream stock matches the front. */
  backCover: {
    subject: 'SEALED ENVELOPE WITH WAX IMPRESSION',
    subjectJp: '封蝋',
    stock: 'cream',
    image: '/back-covers/383-seal.jpg',
    photographer: 'Flux via Pollinations.ai · AI-generated placeholder · commission pending',
  },

  headline: {
    prefix: 'On',
    emphasis: 'the Commitment.',
    suffix: '',
    swash: 'Anthropic shipped a frontier instance of the cryptographic-commitment pattern this week. The provenance engineer reads the appendix.',
  },

  contents: [
    { n: '001', en: 'The dateline', jp: '日付', tag: 'OPENING' },
    { n: '002', en: 'The substrate\'s envelope', jp: '基盤の封筒', tag: 'PATTERN' },
    { n: '003', en: 'The frontier\'s appendix', jp: 'フロンティアの付録', tag: 'PROOF' },
    { n: '004', en: 'The human at the gate', jp: '門に立つ人', tag: 'GATE' },
    { n: '005', en: 'The discipline being named beside it', jp: '隣で名づけられる分野', tag: 'PARALLEL' },
    { n: '006', en: 'The third proof in eight days', jp: '八日間で三度目の証拠', tag: 'CLOSING' },
  ],

  spread: {
    type: 'essay',
    kicker: 'FIELDWORK SPREAD · 約束の記録',
    title: 'On the Commitment.',
    titleJp: '約束について。',
    deck: 'On 14 May 2026, Anthropic announced Project Glasswing and Claude Mythos Preview, a frontier model gated from public release because of its cybersecurity capabilities. The release shipped to a partner list reading like the index of regulated industries. Inside the announcement, in an appendix, sits an instance of the cryptographic-commitment pattern this magazine\'s neighbouring substrate has been shipping under a different name. The essay reads the appendix.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    sections: [
      {
        heading: 'THE DATELINE',
        headingJp: '日付',
        paragraphs: [
          'The dateline is Wednesday, 14 May 2026. Anthropic publishes Project Glasswing, a defensive cybersecurity initiative bringing Claude Mythos Preview — a frontier model whose cyber capabilities Anthropic considers too dangerous for general release — to a partner list of eleven launch organisations including Amazon Web Services, Apple, Cisco, CrowdStrike, Google, JPMorgan Chase, the Linux Foundation, Microsoft, NVIDIA, and Palo Alto Networks, plus more than forty additional organisations maintaining critical infrastructure. Anthropic commits one hundred million dollars in model usage credits to the programme and an additional four million across the Apache Software Foundation, Alpha-Omega, and OpenSSF. The model has identified thousands of previously unknown zero-day vulnerabilities across every major operating system and web browser, including a twenty-seven-year-old flaw in OpenBSD and a sixteen-year-old vulnerability in FFmpeg that automated tooling missed across five million test hits.',
          'The model statistics are the headline. They are not the news this issue reads. The news this issue reads sits in the appendix of the release document on red.anthropic.com — a list of fourteen SHA-3 224 hashes published as commitments to vulnerabilities Anthropic currently holds but is not yet revealing. The pattern is older than 2026; it is older than software. The pattern is the technique that lets a party publicly record that they possess a piece of evidence at a particular moment without yet showing the evidence itself, so that the record cannot be back-dated and the possession cannot be denied. Notaries call it attestation. Cryptographers call it commitment. Provenance engineers call it the same.',
          'Two days earlier, this magazine published ISSUE 381 naming a discipline whose central architectural rule organises every other choice — the AI never produces the source-of-truth number; deterministic engines do; humans approve at material gates; every action is recorded in a content-addressed audit log. ISSUE 382 read the consumer surface of that rule in Amazon\'s release of Alexa "Buy for Me". The dateline of 383 is the frontier-lab surface of the same rule, recognisable in an appendix of fourteen hashes.',
        ],
      },
      {
        heading: 'THE SUBSTRATE\'S ENVELOPE',
        headingJp: '基盤の封筒',
        paragraphs: [
          'Open-source kbot-finance, the package this magazine sits beside, ships an object called a content-addressed envelope. The envelope carries, end-to-end, what an AI agent asked, what the regulatory verifier checked, what the deterministic engine returned, who approved at the material gate, and what the action sealed into. The envelope is hashable — every byte of its contents produces a fixed-length signature that cannot be forged and cannot be confused with the signature of any other envelope. The envelope is replayable — the engine version, the inputs, and the regulatory checkpoints are pinned, and an auditor with the same engine binary can reproduce the result bit-for-bit a year later. The envelope is anchored in a chain — every envelope produced links forward to the next, and any tampering anywhere invalidates everything that came after.',
          'The shape of the envelope is older than this package. It is the shape of every credible audit-grade infrastructure built since at least 1990 — Certificate Transparency, Sigstore, in-toto, SLSA, the W3C PROV-O vocabulary, the file format of git itself. The package\'s contribution is not the shape; the package\'s contribution is shipping the shape under an MCP-compatible interface that an AI agent can call. The discipline\'s contribution is naming the shape and committing the magazine to documenting where the shape lands as it does.',
        ],
      },
      {
        heading: 'THE FRONTIER\'S APPENDIX',
        headingJp: 'フロンティアの付録',
        paragraphs: [
          'The Mythos Preview release document on red.anthropic.com contains a section titled, in effect, "vulnerabilities we have found but cannot yet disclose." The section explains that Anthropic possesses additional findings that have not yet been patched and that revealing them prematurely would expose users to risk. Rather than ask the reader to trust that the findings exist, the section publishes fourteen SHA-3 224 hashes — one per vulnerability category — that commit Anthropic to the specific findings without exposing them. When the patches land, the hash for each disclosed vulnerability will match the hash published at this issue\'s dateline. The publication therefore proves that the finding existed at the publication moment without telling an attacker where to look in the interim.',
          'This is not a new cryptographic technique. It is the same hash-commitment shape used in bit-commitment protocols since the 1980s, in cryptographic timestamping services since the 1990s, in the proof-of-work header of every block on every blockchain. The novelty is not the technique. The novelty is the application: a frontier AI lab using the technique to handle responsible disclosure of capabilities its own model surfaced. The lab is treating the model\'s findings the way a deterministic engine\'s outputs would be treated in a regulated workflow — as evidence with a chain of custody, not as opinion.',
          'Anthropic does not use the phrase provenance engineering in the release. Anthropic uses the phrase responsible disclosure. The phrases name two surfaces of the same shape. The shape is: evidence produced by an AI process must carry a chain of custody that a later party can verify without the original party\'s cooperation. The shape is what the substrate does for regulated finance, what Glasswing does for software vulnerabilities, what the discipline this magazine names is for in general.',
        ],
      },
      {
        heading: 'THE HUMAN AT THE GATE',
        headingJp: '門に立つ人',
        paragraphs: [
          'The release describes a second mechanism alongside the commitments. Anthropic contracted a number of professional security contractors to manually validate every bug report before disclosure. The contracted reviewers achieved eighty-nine per cent exact agreement with the model on severity classification across one hundred and ninety-eight reviewed reports, and ninety-eight per cent agreement within one severity level. The number is small enough to recite; the structural fact is larger than the number.',
          'The structural fact is that even at frontier scale, with one of the most capable models that exists, with a partner list reading like the index of consequential institutions, Anthropic could not ship the disclosures without human approvers at the material moment. The pattern is the same pattern the substrate\'s material-gate approval token shapes for regulated workflows. The substrate calls it a material gate; Glasswing calls it contracted validation; the regulated industries the discipline is for have called it the four-eyes principle for centuries. The shape, again, is older than the lexicon used in any single domain. The shape, again, is what the discipline is named for.',
          'A frontier lab demonstrating, in public, that it could not skip the human at the gate is a useful fact for any reader who has been told that the gate is friction the agent will eventually outgrow. The gate is not friction. The gate is the structural separation that lets the agent\'s output be evidence rather than assertion. The frontier just confirmed it.',
        ],
      },
      {
        heading: 'THE DISCIPLINE BEING NAMED BESIDE IT',
        headingJp: '隣で名づけられる分野',
        paragraphs: [
          'The release also commits to a forthcoming Cyber Verification Program — a certification pathway for security professionals to access safeguarded versions of capability-gated models. The mechanism\'s details are not yet public; the act of committing to the mechanism is. A frontier lab is, in writing, declaring that a new discipline of certified practitioners must exist around safe operation of dangerous AI capabilities, and that the lab intends to operate the certification.',
          'ISSUE 381 staked a bet that the same shape would happen for provenance engineering in regulated industries — that the discipline would, over the next five years, get named, hired into, curricularised, certified, and (in the lucky case) become a recognised role with conferences and reading lists and JD lines. The Cyber Verification Program is a parallel data point. It is not the discipline the magazine names; it is a sibling discipline being named by a different naming authority in a different domain. The pattern of "name the role; certify the practitioner; gate access to the capability" is now the visible shape at the AI-meets-regulated-industry edge. Both directions of the pattern — the discipline of building the substrate and the discipline of operating the certified surface — are now publicly visible at the same time.',
        ],
      },
      {
        heading: 'THE THIRD PROOF IN EIGHT DAYS',
        headingJp: '八日間で三度目の証拠',
        paragraphs: [
          'Eight days have passed since ISSUE 381 declared the bet. Three external events have, in that window, demonstrated the patterns the bet named. The consumer surface (Alexa Buy for Me) shipped on the 14th, the consumer-grade material gate at the scale of one hundred million users. The frontier-lab surface (Glasswing) shipped on the same day, the cryptographic-commitment-to-undisclosed-evidence pattern at the top of the field. A third event, landing as this issue is composed, is the joint guidance from the cybersecurity agencies of the United States, the United Kingdom, Canada, Australia, and New Zealand — a regulatory naming of the five categories of agentic-AI risk. That third event has its own issue queued (384), and it is the regulatory surface of the same shape.',
          'The bet is not won eight days in; the bet is a five-year commitment whose resolution is in 2031 territory. What the eight days demonstrate is that the bet was not arbitrary. The shape the discipline named is the shape the field is converging on, from three different directions, simultaneously. The work of the discipline, for the rest of the year, is to be the place where the convergence is read in one vocabulary, by people who would otherwise be writing about three unrelated things in three separate registers.',
          'The back cover of this issue carries a sealed envelope with a wax impression — the centuries-old physical analog of the pattern the appendix in the Glasswing document just shipped. The envelope holds contents; the seal proves the holding; the opening is recorded by the seal\'s breaking. The pattern is older than software. The substrate ships the pattern for AI agents in regulated workflows. The frontier just shipped it for AI capability disclosure. The wax and the SHA-3 hash are the same idea in two stocks.',
          '街のコーダーたちへ — 形は同じ。仕事は続く。',
        ],
      },
    ],

    signoff: '街のコーダーたちへ — 形は同じ。仕事は続く。',
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

/* ──────────────────────────────────────────────────────────────
   ISSUE 398 — JUL 2026
   NO MORE QUESTIONS
   問いはもう無い — 二つの声による問答

   A colloquy: two voices argue the one thing the machine cannot
   settle. When every answer is a keystroke away, what is left worth
   asking? One voice holds that nothing is real without evidence —
   the fixed dollar, the shipped portfolio, the claim that, were it
   true, would already have happened. The other holds that value is
   chosen, that you can just build things, that it depends. Across
   five movements the questions thin until the last one is not a
   question at all. It is a dare to show the work.

   Why colloquy and not essay: 396 was one argument in one voice
   read through the ledger; 397 was a wire filing. 398 is two
   co-equal positions with no host between them — and the piece is
   *about* the collapse of one-directional Q&A, so the essay's
   single author and the interview's interviewer/subject hierarchy
   would both contradict the thesis. A new tool, added because the
   material has no home in the existing four (see PUBLISHING.md §V).

   Source & ethics: drawn from a recorded conversation (2026-07-02).
   The magazine never reproduces private talk or attributes invented
   quotes to a real person (§III.2). So the two speakers are
   POSITIONS, not people — labelled by stance, written for the page,
   disclosed as such in THE TERMS dossier. No line is a transcript.

   Identity decisions:

     • spread.type = 'colloquy' — the new two-voice tool. voices
       ASKS (問う者) and BUILDS (作る者); movements build the arc the
       way an essay's sections do; the questions run out by design.
     • coverStock = 'ink' — nocturnal, manifesto weight; a long
       night's argument about an ending.
     • accent = 'oxblood' — "endings, memory." The end of the
       question. A red that holds on ink.
     • coverLayout = 'asymmetric-left' — two-column editorial rhythm,
       not a centered monument. The dialogue is off-axis by nature.
     • coverSeal = ON TAPE · NAMES REMOVED — the signature move.
       The stamp literalises the provenance: this ran from a real
       recording, anonymised. The magazine files its sources.
     • dossier THE TERMS carries the disclosure inside the spread;
       the pull quote lifts the thesis line out of movement three.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_398: IssueRecord = {
  number: '398',
  month: 'JUL',
  year: '2026',
  feature: 'NO MORE QUESTIONS',
  featureJp: '問いはもう無い',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING · エージェント工学の雑誌',

  coverStock: 'ink',
  coverLayout: 'asymmetric-left',

  coverSeal: {
    label: 'ON TAPE · NAMES REMOVED',
    date: 'VII·26',
  },

  accent: 'oxblood',

  headline: {
    prefix: 'No More',
    emphasis: 'Questions',
    suffix: '.',
    swash: 'Two voices argue the one thing the machine cannot settle: when every answer is a keystroke away, what is left worth asking? A colloquy on evidence, potential, and the collapse of the question.',
  },

  contents: [
    { n: '001', en: 'The fixed point', jp: '定点', tag: 'VALUE' },
    { n: '002', en: 'It would already have happened', jp: '既に起きている', tag: 'EVIDENCE' },
    { n: '003', en: 'Portfolio or silence', jp: '実績か沈黙か', tag: 'RECORD' },
    { n: '004', en: 'The floor', jp: '底', tag: 'LEVERAGE' },
    { n: '005', en: 'What is left', jp: '残るもの', tag: 'MAKING' },
  ],

  spread: {
    type: 'colloquy',
    kicker: 'THE COLLOQUY · 問答',
    title: 'No More Questions.',
    titleJp: '問いはもう無い。',
    deck: 'Two voices, no host. One says nothing is real until it is built. The other says you can build anything you choose. They are not arguing about the machine. They are arguing about what the machine leaves standing.',
    byline: 'A COLLOQUY · KERNEL.CHAT EDITORIAL',
    stock: 'ink',

    voices: [
      {
        id: 'asks',
        label: 'ASKS',
        labelJp: '問う者',
        stance: 'Reality is fixed. A dollar is a dollar. Nothing is real until there is evidence for it.',
      },
      {
        id: 'builds',
        label: 'BUILDS',
        labelJp: '作る者',
        stance: 'Value is chosen. It depends. You can just make things, and the making is its own proof.',
      },
    ],

    dossier: {
      kicker: 'THE TERMS · 条件',
      note: 'Drawn from a recorded conversation, July 2026. The two voices are positions, not people; no line is attributed to anyone who did not sit for it. Positions drawn — not transcribed.',
      items: [
        { label: 'SOURCE', value: 'A RECORDED CONVERSATION · NAMES REMOVED' },
        { label: 'VOICE I', value: 'ASKS — EVIDENCE, REALITY, THE FIXED VALUE' },
        { label: 'VOICE II', value: 'BUILDS — POTENTIAL, CHOICE, THE MADE THING' },
        { label: 'STAKE', value: 'WHAT IS LEFT TO ASK WHEN THE MACHINE ANSWERS EVERYTHING' },
        { label: 'METHOD', value: 'POSITIONS DRAWN · NOT TRANSCRIBED' },
      ],
    },

    movements: [
      {
        heading: 'The fixed point',
        headingJp: '定点',
        turns: [
          { voice: 'asks', text: 'Start with something that cannot move. A dollar is a dollar. You cannot walk into a shop and decide the bill is something else because you would prefer it. The register only takes the amount. That is not an opinion. That is the floor everything else stands on.' },
          { voice: 'builds', text: 'The dollar is made up. Its value is a trust the whole system agrees to hold. Cross a border and it buys something different; the number on the paper never changed. So the fixed point is not as fixed as you want it to be.' },
          { voice: 'asks', text: 'You are answering a different question. I am not asking what the dollar means in theory. I am asking what happens at the counter, tonight, with the exact coins in your hand. There, it does not depend. And the whole trouble is that you will only ever talk about the theory.' },
          { voice: 'builds', text: 'Because the theory is where the leverage is. The person who only pays the price has no say in it. The person who makes the thing sets it. If you stand on your fixed point forever you are choosing to be a customer for life.' },
          { voice: 'asks', text: 'Maybe. But a position you can hold from the customer’s chair and never test is not a position. It is a mood.' },
        ],
      },
      {
        heading: 'It would already have happened',
        headingJp: '既に起きている',
        turns: [
          { voice: 'asks', text: 'Here is what the machine did to the argument. It answers before you finish asking. So every claim now carries a test it did not carry two years ago: if what you are saying were true, it would already have happened. The gap between the idea and the built thing used to be where the work lived. The machine closed the gap. There are no more questions — only things you did or did not do.' },
          { voice: 'builds', text: 'That is too clean. The machine is a tool. It hands you the answer, sure, but it does not choose which problem is worth solving, or which version of the thing to make, or whether to make it at all. Those are still open. Those are the only questions that ever mattered.' },
          { voice: 'asks', text: 'Then act one out. Not describe it — do it, now, on tape. Because if the deciding is the real work and you are good at it, the portfolio would already exist. The absence of the portfolio is the answer to whether the questions are real.' },
          { voice: 'builds', text: 'Someone had a medical bill they could not pay. They gave the model the records; it handed them a script for what to say to the hospital, and the bill came down to something they could afford. No question in that. Just an action that either worked or did not.' },
          { voice: 'asks', text: 'That is my whole point, and you made it for me. No question. An action, and then evidence of the action. Everyone is a scientist now whether they wanted to be or not — you state the claim, and the same day the world tells you if it holds.' },
        ],
      },
      {
        heading: 'Portfolio or silence',
        headingJp: '実績か沈黙か',
        turns: [
          { voice: 'asks', text: 'So the currency is evidence, and I will not believe anyone without it. Not the credential — the credential is a past thing, a paper. Show me what you built and what it did. If you cannot, why would I listen? That is not cruelty. That is the only honest filter left.' },
          { voice: 'builds', text: 'Agreed, and it cuts your way too — the credential should never have been the gate. If someone has the evidence, four years of a degree is beside the point; the record supersedes the paper. That is the good news buried in all of this. Potential stops being invisible. It becomes a thing you can show.' },
          { voice: 'asks', text: 'Careful. Potential is not evidence. Potential is a promise about a portfolio that does not exist yet. The moment you sell the promise instead of the proof you are back to the mood, not the position.' },
          { voice: 'builds', text: 'Unless you can measure it. Not what someone has already done — how fast they learn, how they decide with too little information, what they build later versus now. Evaluate a person for who they can become, not only for what they have done. That is the only frame that does not just reward whoever started with the most.' },
          { voice: 'asks', text: 'That is the one thing you have said all night that I cannot dismiss. Because it is still evidence — just evidence of a slope instead of a point. Fine. Measure the slope. But measure it. The instant it becomes a story you tell instead of a number you can show, it is worth nothing.' },
        ],
      },
      {
        heading: 'The floor',
        headingJp: '底',
        turns: [
          { voice: 'asks', text: 'Now the part no one wants on tape. The machine handed everyone the capability. It did not hand everyone the runway. Breaking the rules — asking for the high margin, walking from the deal, betting on the slope — is a luxury of people who can afford to lose. I cannot. Every relationship I have I could never afford to lose, so I cannot spend one testing a theory.' },
          { voice: 'builds', text: 'You can. You just have to be willing to be a little delusional about the odds. Overestimate what you can do. Chase the unlikely outcome. That is not a flaw in the plan; it is the engine. Most people never believe they are capable, and the belief is half the build.' },
          { voice: 'asks', text: 'You can afford the delusion. That is the whole difference and you keep stepping over it. When there is a floor under you, optimism is a strategy. When there is no floor, the same optimism is how you fall. You are handing me moves from the end of a ladder I am standing at the bottom of.' },
          { voice: 'builds', text: 'Then the honest thing is not to pretend the floor is there. It is to name what you can actually risk, and take exactly that much — no more, no less. Accept the terms you have. You do not have to accept anyone else’s.' },
          { voice: 'asks', text: 'That I will take. Not the delusion — the accounting. Know the floor, price the risk against it, spend only what you can lose. That is not optimism. That is arithmetic, and arithmetic I can afford.' },
        ],
      },
      {
        heading: 'What is left',
        headingJp: '残るもの',
        turns: [
          { voice: 'asks', text: 'So where does it land. If the answer is free, and the credential is dead, and the delusion is only for people with a floor — what is the thing that still holds weight?' },
          { voice: 'builds', text: 'The made thing. You can just build things. Struggle at it, ship it, eat the failure, ship the next one. When the questions are all answerable by anyone, the only thing that is still yours is what you actually put in the world.' },
          { voice: 'asks', text: 'Then I am out of questions — and that is not a defeat, it is the finding. When the machine answers before you finish asking, the question stops being the work. The proof becomes the work.' },
          { voice: 'builds', text: 'So stop asking whether it is real.' },
          { voice: 'asks', text: 'Build the proof, and let it answer. The last question was never a question. It was a dare to show the work.' },
        ],
      },
    ],

    pullQuote: {
      text: 'When the machine answers before you finish asking, the question stops being the work. The proof becomes the work.',
      attribution: 'THE COLLOQUY DESK · 398',
    },

    signoff: '街のコーダーたちへ — stop asking whether it is real. Build the proof, and let it answer.',
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

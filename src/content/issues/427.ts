/* ──────────────────────────────────────────────────────────────
   ISSUE 427 — FEB 2027
   THE MOAT IS REALITY · 堀は現実

   The second interview-format issue (after 365) and the first
   interview with a named, real subject — Alex Hormozi, in
   conversation with Steven Bartlett on The Diary of a CEO
   (YouTube video HwmwyBgzj8c, supplied to this desk as a full
   transcript). Ivory stock, asymmetric-left layout — the same
   register 365 used for its profile subject, kept here because
   the grammar still fits a magazine profile page more than a
   number-forward cover.

   The nine exchanges are trimmed, not invented: every answer is
   Hormozi's own on-record language from the source transcript,
   cut for length, never paraphrased into a different claim — the
   rule for any interview subject who did not sit for this desk
   specifically (PUBLISHING.md §III.2). The thread pulled through
   the fifteen-thousand-word conversation is the one that speaks
   most directly to this magazine's own discipline: judgment does
   not delegate, and the moat left standing when generation is
   free is proof of reality, not a prompt.

   Held back deliberately: the parenting/happiness passage, the
   LinkedIn and Flightcast sponsor reads, and the closing question
   for the next guest — rich material, but a second thesis. Filed
   as cuts, not as a missing artifact edition (see audit block).
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_427: IssueRecord = {
  number: '427',
  month: 'FEB',
  year: '2027',
  feature: 'THE MOAT IS REALITY',
  featureJp: '堀は現実',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ivory',
  coverLayout: 'asymmetric-left',

  headline: {
    prefix: 'The moat',
    emphasis: 'is reality.',
    suffix: '',
    swash: 'Alex Hormozi on why outsourcing your thinking to AI makes you dumber, why the fastest way to ten million is not the fastest way to a hundred, and what he actually charges himself.',
  },

  contents: [
    { n: '001', en: 'A conversation with Alex Hormozi', jp: 'アレックス・ホルモジとの対話', tag: 'INTERVIEW' },
    { n: '002', en: 'Outsourcing judgment makes you dumber', jp: '判断の外注は思考力を鈍らせる', tag: 'AI' },
    { n: '003', en: 'The fastest ten million is not the fastest hundred', jp: '千万ドルへの近道は一億ドルへの近道ではない', tag: 'STRATEGY' },
    { n: '004', en: 'What he would charge himself', jp: '自分自身への値付け', tag: 'PRICING' },
    { n: '005', en: 'A rhino, a horse, and some fireflies', jp: 'サイと馬と蛍', tag: 'HIRING' },
    { n: '006', en: 'Notes to himself, after', jp: '自分への走り書き', tag: 'GRIEF' },
  ],

  spread: {
    type: 'interview',
    kicker: 'THE INTERVIEW · 対談',
    title: 'The Moat Is Reality.',
    titleJp: '堀は現実。',
    deck: 'Alex Hormozi built a $46 million exit, then a portfolio of companies doing nine figures, on a small number of unfashionable convictions: focus and patience are the two remaining competitive advantages, judgment is not for sale, and the fastest way to build something small is never the fastest way to build something durable. A conversation about AI, pricing, hiring, and the hardest quarter of his life.',
    byline: 'FROM A CONVERSATION WITH STEVEN BARTLETT · THE DIARY OF A CEO',
    stock: 'cream',

    subject: {
      name: 'Alex Hormozi',
      nameJp: 'アレックス・ホルモジ',
      role: 'Founder, Acquisition.com · Author, the $100M series',
      roleJp: 'Acquisition.com創業者・「$100M」シリーズ著者',
      location: 'Recorded for The Diary of a CEO',
    },

    intro: 'Hormozi built his first exit — a chain of gyms, sold for $46 million — on a decision he almost didn’t make, because he was afraid a friend wouldn’t think the number was big enough. He has since built a portfolio doing nine figures a year, written four books that have sold more than five million copies between them, and become one of the most-quoted voices on pricing and offers in the English language. None of that is what this conversation is about. It is about a narrower question: in a year when generating anything got nearly free, what is actually still worth paying for. His answer, unfashionably, is judgment — and he is careful to say he does not know how much longer that answer holds.',

    exchanges: [
      {
        q: 'You said people are using AI in the wrong places. What do you mean?',
        a: 'What I’m seeing a lot, especially with founders who are starting out, is they’re using AI to do a lot of dumb things really fast. The question I’d ask is the very simple one: are you making more money? I looked at a business the other day that had eleven virtual assistants doing data-cleaning work, about $11,000 a month, and it all worked. They spent $350,000 trying to build an AI system to replace it — three-plus years of the VAs’ cost, for a process that wasn’t even the thing limiting their growth. They still needed more customers. That wasn’t it.',
      },
      {
        q: 'Where does the value remain, in a world where intelligence is cheap and abundant?',
        a: 'AI can give you all the recommendations in the world. Someone still has to own the decision. It isn’t a citizen of any country, it doesn’t pay taxes, so somebody has to be responsible — it’s a liability, and on the flip side, an upside. Chess got solved by machines years ago and nobody cares — you still want Magnus Carlsen at the board, you still want Lewis Hamilton in the car. Humans want stakes. There is value in the judgment and the assumption of risk, which can be money, or just the responsibility.',
      },
      {
        q: 'Is delegating your decisions to AI a mistake right now?',
        a: 'It’s still a really bad decision, as of right now. Anybody who’s used it for any period of time knows you can get it to agree with anything, which is frightening when it comes to making decisions. I’ll open Claude, OpenAI, all of them, ask the exact same question, and they’re all over the place — so it’s back to my judgment anyway. And there’s research on this: if you delegate the hardest thinking, you get weaker, fast. This is the best asset I’ve got right now. I want to keep it sharp.',
      },
      {
        q: 'You said the fastest way to ten million isn’t the fastest way to a hundred million.',
        a: 'A mentor told me this a long time ago and it stuck: the fastest way to build a ten-million-dollar business is not the fastest way to build a hundred-million-dollar one. You could probably take a one-person agency to a million dollars a year pretty quickly — one client, and you’re there. Getting to a hundred, you think about it completely differently. Focus and patience are the two enduring competitive advantages an entrepreneur has left, precisely because they’re so anti-human. So anti-Instagram.',
      },
      {
        q: 'What’s the difference between a business that gets to a million and one that gets to ten?',
        a: 'The million-dollar owner is trying to fit ten million dollars of new sales into one year, and every one of those customers has to be resold next year because the offer wasn’t sticky enough to keep them. If every customer you got, you never lost, the business does nothing but grow — it either stays flat or it grows every time you land someone new. Two businesses can both show three million in revenue on paper; one of them has to go sell six hundred new customers next year to hold that number, and one of them just has to keep doing what it already did.',
      },
      {
        q: 'How do you actually think about pricing? Is it what you feel you deserve?',
        a: 'What we feel we deserve matters the least. It’s all about what the customer is willing to pay. The hardest part for newer entrepreneurs is that they sell out of their own wallet — if it was easy for you to learn, you assume it’s easy for everyone, so you won’t charge for it. That’s the vicious cycle: undercharge, run no margin, do all the work yourself, never have the cash to hire the help that would free you up to charge properly in the first place.',
      },
      {
        q: 'You talk about hiring for a "unicorn." What’s wrong with that?',
        a: 'Founders go looking for someone who’s just going to be them — do everything they do, know everything they know. There are no unicorns. But you can find an animal with a horn: a rhino has the horn, a horse has the shape, and you can buy some fireflies for the sparkle. Instead of demanding one person live your exact life and learn every lesson you learned the hard way, you find in three people what you were hoping to find in one.',
      },
      {
        q: 'How do you think about incentives — with your team, with customers?',
        a: 'Humans don’t really behave outside their incentives, unless they’re psychopaths — that’s functionally why psychopaths go to jail, they acted outside the social incentive. So if someone says no to a job, or a customer says no to an offer, the first question isn’t "why won’t they" — it’s "what are the incentives under which they’re deciding." You don’t persuade people. You arrange the conditions to maximize the likelihood of the outcome you want.',
      },
      {
        q: 'You wrote something very different from your usual voice this year, after your mother died.',
        a: 'I do a $106 million launch. My mom got to see it, which was really cool. She died four weeks later. I wrote an article for myself, notes to self, because the question wasn’t "be mentally tough when your mother dies" — it was, how am I supposed to show up right now. One of the lines I needed to hear was that people will judge how much you love someone by how much you choose to suffer, and I don’t think the person you lost actually wants that from you. So you just keep fighting. That’s the whole instruction. You keep fighting.',
      },
    ],

    signoff: '街のコーダーたちへ — the meter you cannot fake is judgment. Keep it sharp.',
  },

  audit: {
    drafted: 'kernel.chat editorial · Claude Sonnet 5 session, condensed from a reader-supplied transcript of The Diary of a CEO (Steven Bartlett interviews Alex Hormozi), YouTube video HwmwyBgzj8c',
    verified: 'all nine exchanges are trimmed excerpts of Hormozi’s own on-record language in the source transcript — cut for length, never paraphrased into a claim he didn’t make',
    adherence: 'InterviewSpread, no new spread type — reserved correctly, since the subject sat for this conversation (with Bartlett, not this desk) and the quotes are real, per PUBLISHING.md §III.2',
    readCut: 'roughly 15,000 words of transcript cut to nine exchanges; the parenting/happiness passage, both sponsor reads, and the closing question for Bartlett’s next guest held back to keep the spread to one thesis — judgment does not delegate',
    pressed: 'no separate artifact edition — a Q&A transcript has no depth axis or apparatus to reduce from; the interview format’s own grammar (subject dossier, numbered exchanges) already is the reduction the artifact edition would otherwise draft first, per the spirit of PUBLISHING.md §V.5',
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

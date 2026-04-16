/* ──────────────────────────────────────────────────────────────
   ISSUE 365 — APRIL 2026
   THE CRAFT ISSUE: WHAT WE MAKE WHEN NOBODY'S WATCHING
   手仕事号 — 誰も見ていないとき、何を作るか

   The first interview-format issue. Essays (363) and forecasts
   (364) are two tools; this issue debuts the third — a Q&A
   profile with a subject dossier. Cream stock, monument-hero
   layout, the issue number large and confident like a monograph
   devoted to one person.

   Subject: K. Tanaka — a composite character representing the
   kernel.chat reader. 32, backend developer at a 6-person studio
   in Shimokitazawa. The interview is about craft: tools, space,
   routine, and the relationship between making software and
   making anything else.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_365: IssueRecord = {
  number: '365',
  month: 'APRIL',
  year: '2026',
  feature: 'THE CRAFT ISSUE: WHAT WE MAKE WHEN NOBODY\u2019S WATCHING',
  featureJp: '手仕事号 — 誰も見ていないとき、何を作るか',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ivory stock, asymmetric-left layout. Bright
      airy ground for a conversational interview; left-aligned
      editorial rhythm reads like a magazine profile page — the
      subject is the focus, not the number. */
  coverStock: 'ivory',
  coverLayout: 'asymmetric-left',

  headline: {
    prefix: 'The',
    emphasis: 'Craft',
    suffix: 'Issue',
    swash: 'What we make when nobody\u2019s watching.',
  },

  contents: [
    { n: '001', en: 'A conversation with K. Tanaka', jp: '田中Kとの対話', tag: 'INTERVIEW' },
    { n: '002', en: 'The desk as a deliberate object', jp: 'デスクという道具', tag: 'SPACE' },
    { n: '003', en: 'Tools that outlast the project', jp: 'プロジェクトより長い道具', tag: 'TOOLS' },
    { n: '004', en: 'Morning routine as architecture', jp: '朝のルーティン', tag: 'ROUTINE' },
    { n: '005', en: 'What craft means after AI', jp: 'AI以後の手仕事', tag: 'CULTURE' },
    { n: '006', en: 'The workshop stays open', jp: '工房はまだ開いている', tag: 'ESSAY' },
  ],

  spread: {
    type: 'interview',
    kicker: 'THE INTERVIEW · 対談',
    title: 'One Desk, One Window, One Year.',
    titleJp: '机ひとつ、窓ひとつ、一年間。',
    deck: 'A conversation with K. Tanaka about tools, space, routine, and why the things you build when nobody\u2019s watching are the ones that matter most.',
    byline: 'INTERVIEW BY THE EDITORS · KERNEL.CHAT',
    stock: 'cream',

    subject: {
      name: 'K. Tanaka',
      nameJp: '田中 K',
      role: 'Backend Developer, Six-Person Studio',
      roleJp: 'バックエンド開発者・6人のスタジオ',
      location: 'Shimokitazawa, Tokyo',
    },

    intro: 'We met K. Tanaka at a café two blocks from his studio in Shimokitazawa. He arrived carrying a ThinkPad in a canvas tote, ordered a black coffee without looking at the menu, and sat with his back to the window. He has been writing backend systems for nine years. He does not have a personal website. The conversation lasted ninety minutes and covered less ground than expected — because every answer was precise.',

    exchanges: [
      {
        q: 'Your desk at the studio — describe it.',
        a: 'A birch tabletop from MUJI, 120 centimeters. The ThinkPad on the left, an HHKB in the center, a notebook on the right. One plant — a pothos that has been alive longer than the company. No second monitor. I tried one for a year and found that it made me worse at deciding what to look at. One screen forces you to choose. Choosing is the work.',
      },
      {
        q: 'Why the ThinkPad?',
        a: 'The keyboard. Also the fact that nobody asks you about it. A MacBook is a conversation starter. A ThinkPad is a conversation ender. I want the conversation to be about the code. The machine is matte black and slightly too heavy and it disappears when I open it. That is exactly what a tool should do.',
      },
      {
        q: 'You write TypeScript. Do you enjoy it?',
        a: 'I enjoy the constraint. TypeScript is interesting because it is a language that exists to prevent you from doing things. Most tools exist to let you do things. A type system that says "no" is a collaborator in a way that a language that says "sure, go ahead" never is. I write better software when something is pushing back. The compiler is a desk-mate who reads everything I write and shakes their head quietly when I am being sloppy.',
      },
      {
        q: 'Walk us through your morning.',
        a: 'I wake at six. Coffee — hand-ground, pourover, no milk. I do not check my phone until after the first cup. Then thirty minutes of reading — usually a technical paper or a long essay, never the news. I bike to the studio by eight. The first hour is review: what did I leave unfinished yesterday, does it still make sense today. Most mornings the answer is "partially." I rewrite the part that does not make sense, then move forward. The morning is the only time the code gets my full attention. By noon the interruptions start and the quality drops. I have accepted this.',
      },
      {
        q: 'Do you think about craft?',
        a: 'I think about it constantly, but I do not use the word. The word makes it precious. What I think about is: does this function do one thing clearly? Will the person who reads this in two years understand why I made this choice? Is the error message helpful? These are not questions about craft. They are questions about courtesy. The craft is being courteous to a stranger in the future who will read your code at 11pm and be slightly annoyed already.',
      },
      {
        q: 'What tools have lasted?',
        a: 'Vim, nine years. Git, nine years. The HHKB, six years. A Midori MD notebook, replaced yearly, same model. Pour-over kettle, a Kalita Wave dripper — five years, same one. The things that last are the things I stopped thinking about. The moment a tool requires you to think about the tool instead of the work, it has failed. I have tried many editors. Vim is the one where my hands know what to do and my eyes stay on the problem.',
      },
      {
        q: 'You said you don\u2019t have a personal website.',
        a: 'I do not. I had one for two years. It had a dark background and my name and three project links. I looked at the analytics once and found that I was the only visitor. I took it down. My work is in the commit history. If someone wants to know what I can do, the commits are there. A personal website is a brochure for a person who does not need one.',
      },
      {
        q: 'AI is writing code now. What does that change for you?',
        a: 'It changes the floor, not the ceiling. The worst code gets better because the machine catches the obvious mistakes. The best code does not change because the best code was never about correctness — it was about judgment. Knowing what to build, what to leave out, when to say no. A machine that writes correct code faster does not help you decide what the system should do. That decision is still human, still slow, still hard. If anything, AI makes the human part more visible. When the mechanical skill is commodified, the only thing left is taste.',
      },
      {
        q: 'What do you make when nobody\u2019s watching?',
        a: 'Small CLI tools that I will never publish. A script that renames my photos by date. A tool that checks whether my plant needs water based on the humidity sensor I wired to a Raspberry Pi. A Vim plugin that does one thing nobody else would ever want. These are the real projects. The studio work pays the rent and I am proud of it, but the weekend scripts are where I learn what I actually think about software. They have no audience, no deadline, no spec. The only requirement is that they satisfy me. That turns out to be the hardest requirement of all.',
      },
    ],

    signoff: '街のコーダーたちへ — the workshop stays open.',
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

---
title: "Don't Get Locked In"
date: 2025-11-28
category: Technology & Strategy
tags: [ai, tools, workflow, independence]
read_time: 4 min read
---

I just spent an hour setting up Aider, a terminal-based AI coding assistant. Not because the GUI tools I use aren't
good—they're great. But because I don't want to be locked in.

Here's the thing: right now, I love Antigravity and Cursor. The UI is polished, the experience is smooth, and they make
coding feel effortless. But what happens when they decide to 10x the subscription price? Or remove the free tier
entirely? Or shut down?

The answer is simple: I'm stuck.

## The Terminal Insurance Policy

A friend reminded me of something important: "Antigravity can't be the one pillar all your work gets done on."

So I installed Aider. It's not as pretty. The UX takes more effort. But it gives me something invaluable: **control**.

With Aider, I can:
- Use any AI model I want (Claude, GPT-4, Gemini, local models)
- Work on any machine with a terminal
- Keep working even if one service shuts down
- Run it over SSH on remote servers
- Pay only for what I use

The setup took maybe 20 minutes:
```bash
pip install aider-chat
export ANTHROPIC_API_KEY=your-key-here
aider
That's it. No complex configuration. No vendor lock-in.

## The Real Lesson

This isn't just about AI coding tools. It's about **strategic redundancy**.

You don't ditch the GUI tools you love. You keep them. But you also maintain a terminal-based workflow that gives you
options when things change—and they always change.

Think about it:
- Email: Use Gmail, but know how IMAP/SMTP works
- Notes: Use Notion, but keep markdown files locally
- Code: Use VS Code, but know vim basics
- Hosting: Use Vercel, but understand Docker

The pattern is clear: **enjoy convenience, but maintain optionality**.

## GUI vs Terminal: A False Choice

People frame this as "which is better?" but that's the wrong question.

GUI tools (Antigravity, Cursor) are better for:
- Visual design work
- Quick prototyping
- When you need polish and speed

Terminal tools (Aider, vim, etc.) are better for:
- Remote work over SSH
- Automation and scripting
- When services change pricing or disappear
- Platform independence

The smart move? Use both.

## What I Actually Did

Today I:
1. Installed Aider (a terminal AI coding assistant)
2. Set up API keys for Claude, GPT-4, and Gemini
3. Tested it by having it add docstrings to my code
4. Confirmed it auto-commits changes to git

Total cost: Free (using free API tiers) to a few dollars a month if I upgrade.

Now I have options. If Antigravity changes tomorrow, I don't panic. I just open a terminal and keep working.

## The Insurance Premium

Setting up terminal tools feels like extra work. It is. But it's **insurance**.

You pay a small premium (time to set up, less polished UX) to protect against a big risk (vendor lock-in, service
changes, platform dependency).

And honestly? The "premium" is getting smaller. Modern terminal tools are actually pretty nice. Aider auto-commits to
git, tracks costs, and switches between AI models mid-conversation. That's not primitive—that's powerful.

## Keep Your Tool Bag Deep

The developers who thrive aren't the ones who master one perfect tool. They're the ones who maintain a **deep tool bag**
accessible across platforms.

- GUI tools for productivity
- Terminal tools for flexibility
- Local tools for ownership
- Cloud tools for collaboration

Don't pick one. Build all of them.

## What This Means for You

If you rely on any single tool or platform for your work, ask yourself:

*What happens if this goes away tomorrow?*

If the answer makes you uncomfortable, spend an hour setting up an alternative. Not to replace what you use now, but to
have options when things change.

Because they will change. They always do.

---

*This post was written and published using the exact workflow I just described: Antigravity for drafting, terminal tools
for deployment, git for version control, and multiple AI providers for flexibility. No single point of failure.*
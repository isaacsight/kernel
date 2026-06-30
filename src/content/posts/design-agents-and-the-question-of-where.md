---
title: Design Agents and the Question of Where
date: 2026-04-18
tags: ai, design, agents, positioning
summary: Anthropic shipped Claude Design yesterday. kbot shipped `kbot design` this morning. The gap isn't features — it's where your codebase lives while an AI reads it.
---

Anthropic launched Claude Design on April 17. A day later, kbot shipped `kbot design`. The two tools do the same job: describe a visual artifact, watch code come back, ship. The gap between them isn't the outputs — it's *where the work happens*.

## What Claude Design does

Claude Design is a research preview available to Claude Pro, Max, Team, and Enterprise subscribers. You describe what you want — a pitch deck, a landing page, a prototype — and Claude Opus 4.7 produces an interactive draft. During onboarding it reads your codebase and design files, then applies your colors, typography, and components to every project. You export to PDF, URL, PPTX, or Canva.

It's fast. It looks good. It ships the expectation bar higher for every design AI that follows it. Figma's stock dropped 7% on the announcement. Anthropic's Chief Product Officer had just left Figma's board after reports of a competing product. The landscape shifted in one press release.

## Where Claude Design runs

In Anthropic's cloud. Your codebase is uploaded during onboarding. Your design files live on someone else's servers. The model answering your prompts is Claude Opus 4.7, gated behind a paid subscription. Every iteration is a network call.

That's not a criticism — it's a tradeoff. Cloud-hosted design tools get you the best model without installing anything. They also get you a subscription bill, a privacy footprint, and a dependency on a service that may change its API, its pricing, or its access tier on its own schedule.

## Where kbot design runs

```bash
npm install -g @kernel.chat/kbot
kbot design "minimal pitch deck cover with our amethyst accent" --kind deck --pdf --open
```

On your machine. Using your local Ollama model. Reading your repo's CSS tokens directly off the disk. Writing the HTML to `./design-output/`. The only network traffic is whatever the local model has already downloaded.

`kbot design` scans for design tokens in the usual places — `src/index.css`, `app/globals.css`, `tailwind.config.*`, `src/theme.ts`. It extracts CSS custom properties (`--rubin-primary`, `--space-md`), font declarations, color literals, and feeds them to the `aesthete` specialist with a brief about what to build. The output is a single HTML file with inline styles, no external dependencies, responsive at three breakpoints, accessible by default. Pass `--pdf` and Playwright renders it print-ready. Pass `--open` and it fires up in your default browser.

Same outputs as Claude Design. Different location. Different cost. Different relationship to your code.

## When each one wins

Claude Design wins when:
- You're already on a Claude subscription
- Your brief needs the strongest possible visual reasoning (Opus 4.7 outclasses any local model on creative direction)
- Your design system is centralized and syncs well to Anthropic's codebase-read step
- You need PPTX export or Canva integration immediately

`kbot design` wins when:
- You refuse subscriptions on principle
- Your codebase can't be uploaded to anyone's cloud (compliance, IP, ethics)
- You want the design tool to live on your laptop, reproducible, auditable, forkable
- You're already using kbot for coding and want design without switching tools
- You want to iterate 50 times a day without metering tokens

The real answer, for most people, is *both*. Claude Design for the one deck that matters this quarter. `kbot design` for the twenty small prototypes nobody sees. Different weight classes.

## The deeper question this launch raises

Anthropic's move is bigger than one product. The URL `anthropic.com/news/claude-design-anthropic-labs` says the quiet part out loud: this is Claude *Labs*. The foundation-model company is moving from API into vertical products. Design today. Slides today. Coding is already adjacent (Claude Code). Analysis, research, writing, music — all candidate verticals.

Every vertical Anthropic ships is a vertical that will be paid, cloud-based, gated behind subscription tiers. That's fine — it's a defensible business. But it's also an accelerating reason for some portion of the world to prefer open, local-first alternatives. The ceiling on what Claude Design can do rises with every Anthropic release. The floor on what `kbot design` can do rises too, slower but free, and the artifact stays on your machine.

## What we shipped today

```
v3.99.16 · kbot design command              local alternative to Claude Design
v3.99.15 · stale-session fix                no more phantom "interrupted session"
v3.99.17 · config-respecting smart routing  Ollama model routing honors your config
v3.99.18 · route-for-task config read       same fix, different code path
v3.99.19 · file-question classifier         file refs always route to capable model
v3.99.20 · memory prune                     compact solutions.json of stale entries
```

Six ships. One new feature. Five bug fixes that improve agent correctness — the kind of quiet infrastructure work that makes the difference between "demo looked good" and "my tool actually works on my machine every time."

If you've tried `kbot` before and the tool-call path was flaky, try it again today. If you're on Claude Pro and want a faster in-between for the 80% of design work that doesn't need Opus 4.7, `npm install -g @kernel.chat/kbot` takes thirty seconds and the design command ships with it.

The answer to "where should my design agent live" depends on what you're designing, what's in your codebase, and what you're willing to pay. The new thing is that there's a real choice.

# Hacker News Post

## Title (80 chars max)

Show HN: kbot – terminal AI agent that learns from every user who uses it

## URL

https://github.com/isaacsight/kernel

## Text (if self-post, otherwise leave blank — URL posts are better for Show HN)

---

## Comment to post immediately after (this is where the story lives)

Hey HN — I built kbot, an open-source terminal AI agent that does something no other coding tool does: it gets smarter every time anyone uses it.

Here's the idea: every AI coding tool today forgets you between sessions. Claude Code, Cursor, Copilot — you close the terminal, the context is gone. kbot doesn't forget. It extracts patterns from your sessions — which tools you use, which agents succeed at which tasks, what coding style you prefer — and uses Bayesian skill ratings to route future tasks faster.

But the real unlock is collective learning. When users opt in, kbot shares anonymized signals (task category + agent choice + tool sequence + success rate — never code, never files, never identity). Those signals aggregate across all users. So the 1,000th person to install kbot gets a smarter agent than the 1st, without doing anything.

No other shipping tool combines:
- Personal learning (patterns, solutions, skill ratings)
- Collective intelligence (anonymized cross-user signals)
- Runtime tool creation (forge_tool builds new tools mid-conversation)
- 11 cognitive modules based on peer-reviewed papers (Free Energy, Predictive Processing, Strange Loops, etc.)
- 20 providers with zero lock-in (or embedded llama.cpp for fully offline, $0)

The cognitive modules aren't metaphors — they're TypeScript implementations. Free Energy (Friston, 2010) drives explore-vs-exploit decisions. Predictive Processing (Clark, 2013) anticipates your next action. Strange Loops (Hofstadter, 1979) detects when the agent reasons about its own reasoning.

Stats: 600+ built-in tools, 35 specialist agents, 20 providers, MIT licensed, ~1,200 installs/day.

Try it:
```
npm install -g @kernel.chat/kbot
kbot "hello"
```

No API key needed — it falls back to an embedded local model. Works instantly.

To join the collective:
```
kbot collective --enable
```

Interested in feedback on: (1) the collective learning approach — is opt-in anonymized signal sharing the right model? (2) the cognitive modules — useful or over-engineered? (3) what would make you switch from your current tool?

GitHub: https://github.com/isaacsight/kernel
npm: https://www.npmjs.com/package/@kernel.chat/kbot

---

## Timing

Best: Tuesday–Thursday, 8–10am ET
Avoid: weekends, Monday mornings, Friday afternoons

## Subreddits to cross-post

- r/programming — technical angle, same text
- r/commandline — shorter version, focus on CLI experience
- r/artificial — AI agent angle, focus on collective learning
- r/LocalLLaMA — offline mode, embedded llama.cpp angle

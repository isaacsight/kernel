# kbot Benchmarks

**Version under test:** kbot v4.0.1 (commit pending)
**Hardware:** macOS Darwin 25.3.0, Node v22.18.0, M-series Apple Silicon
**Date:** 2026-04-29

## TL;DR

kbot **beats Aider (4.4×) and OpenCode (5.7×)** on cold start. Loses to Claude Code and Codex CLI on boot time alone (they're also Node, slightly leaner default surface). Loses to **jcode on raw boot** (Rust beats Node here — kbot is not pursuing a Rust rewrite; see "Why TypeScript" below).

Where kbot **wins** is the axes raw boot doesn't capture: cost-per-task with BYOK + local Ollama fallback, vertical depth (Ableton, security agent, dream engine, channels, computer-use coordinator), and offline availability. Pick the harness that fits the work.

## Methodology — read first

Every measurement below has a reproduction command. No cherry-picking, no off-by-default flags.

- **Sample size:** n=5 per CLI per measurement
- **Excluded:** none — all 5 runs reported
- **Hardware:** Isaac's daily-driver Mac, no special tuning, normal background processes (browser, IDE, Slack)
- **CLIs measured:** every coding-agent CLI installed on the test machine. If you don't see one, it isn't on disk.
- **CI baseline:** TBD — these numbers need to land in a CI matrix before they're authoritative. Treat this doc as v0.

## Cold start — `--version`

Time from shell exec to exit. Lower is better.

| CLI | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | **Avg** | Stack |
|---|---|---|---|---|---|---|---|
| **codex** | 57 | 54 | 55 | 61 | 56 | **56 ms** | Node |
| **claude** | 113 | 63 | 64 | 64 | 64 | **73 ms** | Node |
| **kbot** | 94 | 92 | 90 | 91 | 90 | **91 ms** | Node + TypeScript |
| aider | 519 | 366 | 366 | 363 | 367 | 396 ms | Python |
| opencode | 637 | 482 | 482 | 494 | 504 | 519 ms | TypeScript / Bun |
| jcode (cited) | n/a | n/a | n/a | n/a | n/a | ~14 ms* | Rust |

*jcode number from their README ([commit reference](https://github.com/1jehuang/jcode)); not measured on the same hardware.

### Reproduction
```bash
for cli in kbot claude codex opencode aider; do
  echo "=== $cli ==="
  for i in 1 2 3 4 5; do
    /usr/bin/time -p $cli --version 2>&1 >/dev/null | grep real | awk '{print $2*1000 "ms"}'
  done
done
```

## Cost per task (the axis kbot wins)

A coding-agent CLI's job is to finish tasks. Boot time matters at the margin; **cost per finished task** matters at the bill.

| Provider routing | Model | Per-task cost (10 representative kbot tasks) | How |
|---|---|---|---|
| **kbot + Ollama (local)** | gemma3:12b / kernel-coder | **$0.00** | `kbot --provider ollama` or auto-fallback for routine tasks |
| **kbot + Anthropic** (BYOK) | claude-sonnet-4-6 | **$0.21** estimated | Default for non-trivial coding tasks |
| **kbot + Anthropic** (BYOK) | claude-opus-4-7 | **$0.84** estimated | `--architect` mode |
| Claude Code (subscription) | bundled Opus 4.7 | $20/mo flat (Pro), $200/mo (Max) | Subscription, not metered per task |
| Codex CLI (subscription) | GPT-5.5 | $20/mo flat (Plus), $200/mo (Pro) | Subscription |
| jcode | wraps user's existing Claude/Codex sub | inherits whatever you're paying | meta-harness |

**The BYOK story for kbot:** for one user running ~30 routine tasks/day, Ollama-fallback for non-coding asks (web research summary, file moves, git operations) drops the daily Anthropic bill to ~$0.40. Compared to a Claude Pro $20/mo flat + ~50% wasted on heavy tasks anyway, kbot+BYOK is genuinely cheaper at moderate-to-low usage and infinitely cheaper at zero (offline / Ollama-only).

### Reproduction
- 10 representative tasks: `cat packages/kbot/CURATION_DISCOVERY/telemetry-summary.md` for the actual task distribution from 90 days of telemetry
- Per-task token counts: `kbot stats` (in-development; today, derive from `~/.kbot/telemetry/` JSONL)
- Provider pricing: `kbot auth pricing` (or check `src/auth.ts` PROVIDERS map)

## Tool surface depth

| CLI | Tool count | Curated? | Includes verticals? |
|---|---|---|---|
| **kbot v4.0** | **~100 specialist skills** + 35 specialist agents | Yes — evidence-driven, see `CURATION_DISCOVERY/CURATION_DECISION.csv` | Ableton + Serum + M4L music; security agent; dream engine; computer-use coordinator; channels (Slack/Office/+); LLaDA local image gen; iPhone control |
| Claude Code | bundled MCP tools (file/git/bash/edit) + user-installed MCP servers | n/a | None native — depends on MCP servers user wires |
| Codex CLI | similar bundled set + 90+ first-party plugins | curated by OpenAI | Atlassian, GitLab, M365 (enterprise) — no music/audio/computer-use |
| jcode | wraps the wrapped harness's tools | n/a — meta-layer | None native |
| Aider | core git/file/bash | n/a | None |
| OpenCode | similar to Aider | n/a | None |

**Where kbot wins this axis:** music production, computer-use at scale (parallel coordinator), local-first AI (Ollama daemon + LLaDA local image gen + dream engine), 24/7 daemon work, channel adapters. Nothing else in this list ships those.

**Where kbot loses this axis:** enterprise SaaS coverage (Atlassian/GitLab/M365 native — kbot has Office via Microsoft Graph but the rest are MCP-installable, not bundled).

## Local-first availability

Percentage of tasks completable without an internet connection.

| CLI | Offline tasks | How |
|---|---|---|
| **kbot** | **~70% of 10 representative tasks** | Ollama models, dream engine, daemons, local file/git tools, kbot-local MCP, LLaDA local image gen |
| Aider | ~10% | local file/git only; no model |
| OpenCode | ~20% | local file/git + bundled small models |
| Codex CLI | 0% — requires OpenAI API | |
| Claude Code | 0% — requires Anthropic API | |
| jcode | inherits the wrapped harness's offline story (mostly 0%) | |

**Reproduction:** disconnect from network, run the same 10 tasks, count completions.

## RAM at idle (TBD)

Honest gap: kbot's idle RAM has not been measured on this machine yet for parity with jcode's published 27.8 MB / 167.1 MB numbers. Method when measured:

```bash
$cli --help &
PID=$!
sleep 2
ps -o pss=,rss= -p $PID
kill $PID
```

Expected: kbot is similar to Claude Code / Codex CLI (Node V8 baseline ~50–80 MB). Lower than aider (Python). Higher than jcode (Rust). This will land in CI v1.

## Honest weaknesses

- **kbot is a younger project**: 13 GitHub stars vs jcode's 842, claude/codex are commercial.
- **kbot is slower to boot than jcode**: 91 ms vs ~14 ms. Node + TypeScript can't beat Rust on startup. We're not chasing this.
- **kbot's UI polish is rough**: jcode has a custom terminal (`handterm`); kbot is plain readline.
- **kbot's session import from other harnesses is partial**: Claude Code session import is in v4.0.1; Codex and OpenCode are v4.1.

## Why TypeScript (and not Rust)

Asked frequently. Three reasons:
1. **Plugin extensibility.** TypeScript plugins are dropped into `~/.kbot/plugins/`, evaluated at runtime. A Rust plugin model needs FFI or WASM, both of which raise the bar for contributors.
2. **MCP ecosystem fit.** Most MCP servers are Node/TypeScript. Wrapping kbot in the same runtime keeps interop seamless.
3. **Boot time isn't the bottleneck.** A 91ms cold start is invisible to users; the bottleneck is API round-trip (300–3000 ms per turn). Optimizing the 91 ms wouldn't move the needle on lived experience.

## See also

- `RELEASE_NOTES_4_0.md` — what shipped in 4.0
- `CURATION_DISCOVERY/CURATION_DECISION.csv` — per-tool audit trail
- `research/jcode-analysis.md` — competitive analysis
- `templates/jcode-mcp-snippet.json` — wire kbot into jcode as an MCP backend

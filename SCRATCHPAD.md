# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-11)

### Accomplished This Session

#### Repo Cleanup — Refocused on K:BOT

- Deleted 229 root-level QA screenshots (.png)
- Deleted random scripts (calculator.js, auto_trader.py, nim_script.py, create_dolphin_pdf.py, trade.sh, etc.)
- Deleted root PDFs (Unified_Pricing_Infrastructure_Theory_Whitepaper.pdf, _Intelligence_Thesis_MortgagePrice_Pro.pdf)
- Deleted stale directories: `agent/` (Python), `memory/`, `specs/`, `test-results/`, `playwright-report/`, `cloudflare/`, `android/`, `ios/`
- Deleted 14 web-platform-only markdown docs (INVESTOR_SUMMARY.md, THESIS.md, WHITEPAPER.md, etc.)
- Deleted `legacy/` (8.5GB of untracked archived code)
- Rewrote root README.md — now K:BOT-focused with full feature docs
- Rewrote CLAUDE.md — K:BOT is primary product, web companion is secondary
- Repo went from ~9.5GB → ~1GB (mostly node_modules)

#### OpenClaw Daemon Status (from earlier session)

- 24/7 background daemon running 7 tasks via launchd (every 15 min)
- 311 files embedded via nomic-embed-text
- 3 test scaffolds generated, 3 JSDoc specs, daily digests
- i18n sync pipeline incomplete (no output files generated)
- Code quality scans found 1 real bug (AgentPicker null cast), 4 false positives

#### Prior Session (2026-03-09): K:BOT v2.5.0

- 14 providers with full model catalogs
- Silent auto-update system
- kbot-engine edge function deployed
- Security audit passed (0 P0, 0 P1)
- Custom Ollama Modelfiles (kernel:latest, kernel-coder:latest)
- OpenClaw daemon + semantic search CLI

### Pending

- **Wire MemoryPanel into EnginePage.tsx** — component built, hook wired, needs rendering with data props
- **Build Ollama models** — run `bash tools/setup-kernel-models.sh`
- **Deploy updated frontend** — changes are local, not yet on kernel.chat
- **Activate test scaffolds** — review daemon-generated .scaffold files, rename to real tests
- **Fix i18n sync** — daemon pipeline starts but produces no output
- **Create migration 079** — morning briefings (briefing_type + sections columns)
- **Generate app icons** — scripts ready, need source 1024x1024 PNG

## Key Decisions

- **Repo identity**: K:BOT is the primary product. kernel.chat web app is the "companion."
- **Free tier**: 10 msgs/day, no subscription push. UPGRADES_ENABLED = false in useBilling.ts.
- **8th-grade copy**: All user-facing text written simply, no jargon.
- **Zero Tailwind**: All vanilla CSS with `ka-` prefix.
- **Edge function deploys**: ALWAYS use `--no-verify-jwt` flag.

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`

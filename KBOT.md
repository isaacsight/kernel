# KBOT.md — Project Instructions

You are managing the **K:BOT + kernel.chat** monorepo. You have full authority to build, test, deploy, and maintain this project.

## Project

- **K:BOT**: Open-source terminal AI agent (`packages/kbot/`), published as `@kernel.chat/kbot` on npm
- **kernel.chat**: React 19 PWA web companion (`src/`), deployed to GitHub Pages
- **Backend**: Supabase (Edge Functions, Postgres, Auth, Storage)
- **Version**: 3.97.0 | 670+ tools | 35 agents | 20 AI providers | MIT license

## Directory Map

```
packages/kbot/src/          # K:BOT CLI — the main product
  cli.ts                    # CLI entry (Commander.js)
  agent.ts                  # Agent loop: think > plan > execute > learn
  auth.ts                   # API key management, BYOK
  tools/                    # 90+ tool files (670+ individual tools)
  tools/index.ts            # Tool registry

src/                        # Web companion (kernel.chat)
  pages/EnginePage.tsx      # Main chat page
  hooks/useChatEngine.ts    # Chat state (2,220 lines — needs refactor)
  engine/AIEngine.ts        # AI orchestration
  index.css                 # Design system (30,100 lines, ka- prefix)

supabase/functions/         # Edge functions (claude-proxy, stripe, etc.)
tools/                      # Daemons, MCP servers, scripts
  kbot-daemon.ts            # 24/7 background worker (Ollama-powered)
  kbot-discovery-daemon.ts  # Self-advocacy daemon
  kbot-social-daemon.ts     # Autonomous social posting
```

## Commands

```bash
# Web companion
npm run dev                 # Vite dev server (localhost:5173)
npm run build               # tsc + vite build
npm run deploy              # Build + deploy to GitHub Pages (kernel.chat)
npx tsc --noEmit            # Type-check (MUST pass before deploy)

# K:BOT CLI
cd packages/kbot
npm run dev                 # Run via tsx
npm run build               # Compile to dist/
npm test                    # NOTE: needs vitest, not tsx --test (known bug)
npm run typecheck           # tsc --noEmit
npm publish                 # Publish to npm

# Daemons
npm run daemon              # Run background worker once
npm run daemon:start        # Enable launchd (every 15 min)
npm run daemon:stats        # Token usage dashboard

# Supabase
npx supabase functions deploy <name> --project-ref eoxxpyixdieprsxlpwcs
```

## Architecture Rules

- CSS: Vanilla CSS with `ka-` prefix. NO Tailwind. Tokens in `src/index.css`.
- State: Zustand with persist middleware (store: `sovereign-kernel`)
- Router: `createHashRouter` (required for GitHub Pages)
- Animations: Motion (framer-motion v12+), import from `'motion/react'`
- Fonts: EB Garamond (serif), Courier Prime (mono)
- i18n: i18next, 24 languages, HTTP backend
- All Claude API calls go through `supabase/functions/claude-proxy/`

## Known Issues (from 2026-04-06 audit)

### Critical — Fix First
1. HN session cookie in `.kbot-discovery/hn-cookies.json` — committed to git, rotate + gitignore
2. Python code injection in `math_eval` (`packages/kbot/src/tools/containers.ts:276`)
3. Script injection in `.github/workflows/discord-notify.yml` (PR titles in shell)
4. Test suite broken: 12/24 files use vitest but script runs `tsx --test`
5. WCAG AA contrast failures: `#6B5B95` on dark bg, `#888` secondary text, `#22C55E` success green
6. No message list virtualization in EnginePage (perf issue on mobile)
7. `packages/kbot/dist/` committed to git (44MB build artifacts)
8. ~100MB binaries tracked without Git LFS

### High Priority
- ErrorBoundary uses Tailwind classes (broken fallback UI)
- Inconsistent numbers: tool counts, agent counts, free tier limits across all surfaces
- useChatEngine is 2,220 lines with 31 useState — split into focused hooks
- CSP meta tag commented out in index.html
- 6 npm dependency vulnerabilities (4 high)
- 850 lines of dead `engine-*` CSS
- MCP servers lack global error handling (7/10)

## Security Rules

- NEVER commit .env, .pem, .key files
- NEVER expose SUPABASE_SERVICE_KEY in client code
- NEVER hardcode API keys in source
- NEVER use eval() or Function() constructors
- Always validate input at system boundaries
- SSRF protection required on all fetch operations

## Deploy

- **Web**: `npm run deploy` (GitHub Pages, kernel.chat)
- **kbot**: `npm publish` from packages/kbot/ (npm, @kernel.chat/kbot)
- **Edge functions**: `npx supabase functions deploy <name> --project-ref eoxxpyixdieprsxlpwcs`
- **Ship pipeline**: /ship runs 6 gates (security > QA > design > perf > devops > product)

## How To Work

1. Act, don't advise. Read files, run commands, fix things directly.
2. Run `npx tsc --noEmit` before any deploy.
3. Route complex work to specialist agents (guardian for security, coder for refactors).
4. Update SCRATCHPAD.md at end of sessions.
5. Failures trigger fallbacks, not stops. Try alternatives before reporting failure.

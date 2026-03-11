# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-10)

### Accomplished This Session

#### New Specialist Agents: Hacker + Operator + Dreamer

Added three new specialist agents to the Kernel platform:

**Hacker** (`⚡` · `#00FF41` matrix green)
- Offensive security, exploit analysis, CTFs, reverse engineering
- Creative system manipulation — finding loopholes, unconventional paths

**Operator** (`⬡` · `#FF6B35` burnt orange)
- Full delegation — acts AS the user with complete autonomy
- Writes communications in user's voice, makes decisions on their behalf
- Multi-step workflow execution without hand-holding

**Dreamer** (`☾` · `#7B68EE` medium slate blue-violet)
- Dream interpretation — sleep dreams as data (Jungian, emotional processing, personal symbolism)
- Vision engineering — gap analysis between current reality and aspirational futures
- Creative worldbuilding — co-architect impossible things
- 3am conversation energy — wonder, possibility, the irrational honored

**Changes made:**
1. `src/agents/specialists.ts` — Added all three specialist definitions with system prompts
2. `src/engine/AgentRouter.ts` — Added to type union, classification system prompt, KEYWORD_MAP, HIGH_SIGNAL_KEYWORDS, validAgents
3. `src/pages/EnginePage.tsx` — Added AGENT_PALETTES entries for ParticleGrid theming

**No changes needed (auto-wired):**
- SwarmOrchestrator — uses `Object.values(SPECIALISTS)`, so new agents are automatically in the swarm pool
- MemoryAgent — global context, applies to all agents automatically
- Admin panel — reads agentId from messages, works automatically
- Agent override selector in Controls — uses `getAllSpecialists()`

### Architecture Reference (for next session)

**Full agent flow:**
```
User Message → AgentRouter.classifyIntent()
  ├→ classifyLocal() [keyword fast-path, <1ms]
  ├→ Background provider API [ambiguous fallback, ~1s]
  └→ Returns ClassificationResult {agentId, confidence, complexity, ...}
       ↓
AgentSelection.selectAgent()
  ├→ Check manual agentOverride
  ├→ specialistToAgent() — wraps Specialist → Agent type
  └→ Returns selected Agent with systemPrompt
       ↓
AIEngine.act()
  ├→ Build context from perception + attention + user memory
  ├→ Inject system prompt + artifact rules
  └→ Stream response via provider
       ↓
EnginePage renders:
  ├→ ParticleGrid avatar (AGENT_PALETTES color)
  ├→ Agent badge (name + color)
  └→ Message content
```

**Key files to touch when adding agents:**
| File | What to change |
|------|----------------|
| `src/agents/specialists.ts` | Add to SPECIALISTS object |
| `src/engine/AgentRouter.ts` | Type union + CLASSIFICATION_SYSTEM + KEYWORD_MAP + HIGH_SIGNAL_KEYWORDS + validAgents |
| `src/pages/EnginePage.tsx` | Add to AGENT_PALETTES |

### Research: Pushing Hacker Agent Further (Deep Dive)

#### Competitive Landscape
- **HackerGPT**: Fine-tuned on security data, integrates with pentesting tools (Nmap, subfinder, Katana), semantic search on hacking data
- **PentestGPT**: Multi-step pentesting with context retention across attack phases (recon → exploit → post-exploit)
- **BurpGPT**: Burp Suite extension, finds "bespoke vulnerabilities" via NLP context understanding (not just pattern matching)
- **Guardian AI**: 19 integrated security tools with async parallel execution
- **HexStrike AI**: 150+ tools via MCP — AI autonomously selects and runs them
- **Kali Linux + Claude**: MCP integration — "port scan scanme.nmap.org" returns real results

#### CTF AI Performance (State of the Art)
- Hack The Box AI vs. Human CTF: 5/8 AI teams solved 19/20 challenges (95% solve rate) vs 403 human teams
- CAI framework: Top-10 ranking in Dragos OT CTF 2025 (32/34 challenges)
- CTFAgent two-stage RAG: 80%+ improvement, top 23.6% of ~7,000 teams in picoCTF 2024
- **Key limitation**: AI struggles with binary artifacts (ELF, PCAPs, PNGs) — 95/120 picoCTF challenges embed auxiliary files

#### AI Suitability by CTF Category
| Category | AI Strength | Notes |
|----------|-------------|-------|
| Web Exploitation | Excellent | Pattern matching, automated payload gen, fingerprinting |
| Cryptography | Excellent | Cipher identification, known attacks, math analysis |
| OSINT | Excellent | Data correlation, search automation, pattern recognition |
| Forensics | Good (with tooling) | PCAP analysis, file carving, stego — needs binary handling |
| Reverse Engineering | Good | Decompilation analysis, pattern recognition in assembly |
| Binary Exploitation | Moderate | Known vuln classes work, novel heap exploits struggle |

#### High-Value Capabilities to Add
1. **Tool Execution Layer**: Generate ready-to-run command sequences (nmap, gobuster, sqlmap, nuclei, subfinder) with proper flags and chaining — not just generic advice
2. **Recon Methodology Engine**: target → subdomain enum → port scan → service fingerprint → vuln scan → exploit suggestion → report. Each step feeds the next.
3. **CTF Solver Mode**: Specialized reasoning per category with RAG over common techniques/writeups
4. **Vulnerability Chain Builder**: Given system description → enumerate attack surfaces → chain exploits (input validation → SQLi → privesc → exfil)
5. **CVE Research Integration**: Web search for latest CVEs, CVSS scores, PoC availability for any software/version
6. **Hacker Lens for Non-Security Domains**:
   - Growth hacking: viral loops, referral exploits, conversion optimization
   - Process hacking: bureaucracy shortcuts, workflow optimization
   - System gaming: algorithm manipulation, SEO, platform arbitrage, loyalty program optimization
   - Information arbitrage: connecting disparate public data sources
7. **OSINT Pipeline**: Structured intelligence gathering for people, companies, domains, infrastructure

#### What Makes It Real vs. Gimmick
- **Tool execution, not just advice** — Stanford's ARTEMIS found 9 real vulns across 8,000 devices, 82% valid findings
- **Pattern matching is the killer feature** — AI solved CTF challenges in 6 steps by recognizing response fingerprints
- **Human-AI hybrid model** — HackerOne Hai cut validation from 20 min to 5 min by pre-processing
- **Automate drudgery first** — recon, scanning, report gen, triage deliver immediate value
- **"Hunger" gap** — AI executes logic but doesn't pursue outcomes obsessively like human hackers

#### Prompt Engineering Insights
- Ethical framing WITH capability preservation (HackerGPT model)
- Logic-first prompts: "Determine safety context → then provide technical analysis"
- Spotlighting for untrusted data: separate analyzed content from agent instructions (prevent prompt injection through analyzed payloads)
- Tool-use decision trees as state machines, not free-form reasoning
- Intent-based defense reduces misuse by 74%+

### Research: Pushing Operator Agent Further (Deep Dive)

#### Competitive Landscape (2025-2026)
- **OpenAI Operator → ChatGPT Agent**: CUA model (GPT-4o vision + RL for GUI interaction), deprecated standalone Aug 2025, folded into unified ChatGPT Agent running on virtual computer. Key insight: merging "deep research" (info gathering) + "operator" (action taking) into one agent > keeping separate.
- **Anthropic Computer Use → Claude Cowork**: Screenshot + mouse/keyboard control. Cowork (Jan 2026) extends to autonomous file management in designated local dirs. Opus 4.6 has 14.5-hour autonomy horizon per METR benchmarks.
- **Google Project Mariner**: Chrome extension for web task automation
- **Architecture convergence**: Both leaders give AI a virtual computer (browser/desktop) to use standard GUIs vs. requiring custom APIs. More flexible but slower.

#### 5-Level Autonomy Model (Industry Standard)
| Level | User Role | Agent Behavior |
|-------|-----------|----------------|
| 1 | Operator | User drives; agent suggests |
| 2 | Collaborator | Agent drafts; user edits |
| 3 | Consultant | Agent acts; user spot-checks |
| 4 | Approver | Agent acts autonomously; user approves high-stakes |
| 5 | Observer | Full autonomy; user monitors dashboards |

**Progressive trust**: Anthropic data from Claude Code shows auto-approve usage rises from ~20% (<50 sessions) to 40%+ (750+ sessions). Trust is built gradually.

#### Delegation Patterns That Work
1. **Risk-tiered actions**: Autonomous for low-risk (read/draft), checkpoint for medium (send), approval gate for high (financial/irreversible)
2. **Sandbox-then-promote**: Agent works in draft/staging; human reviews before anything goes live
3. **Reversibility as design principle**: Prefer reversible actions; require approval for irreversible
4. **Implicit approval**: "If I don't respond in 10 min, send it" — time-gated delegation

#### Communication Automation (Ranked by Value)
1. **Inbox triage & prioritization** — 25% reduction in email processing time (Worklytics data)
2. **Draft replies in user's voice** — Lindy.ai, Shortwave already do this
3. **Meeting scheduling** — Calendar-aware, handles back-and-forth until confirmed
4. **Follow-up automation** — Auto-nudge after N days with no reply
5. **Thread summarization** — Condensing long threads into actionable summaries

**Critical gap**: 87% of marketing teams use AI for email, but only 6% qualify as high performers. Bottleneck = effective implementation (voice matching + context awareness), not tool availability.

#### Workflow Architecture Patterns
| Pattern | Best For |
|---------|----------|
| **Orchestrator-Worker** | Complex tasks — Operator decomposes, delegates to specialists |
| **Prompt Chaining** | Well-defined linear tasks |
| **ReAct** | Exploratory tasks requiring adaptation |
| **Parallelization** | Multi-source research, code review |
| **Evaluator-Optimizer** | Quality-critical outputs |

**Key insight**: 80% of agent workflow work is data engineering, governance, and integration — not prompt engineering. Orchestrator-worker with sub-agents is the winning architecture.

#### Voice/Style Matching Techniques
1. **Corpus ingestion** — Feed emails, Slack, blog posts → build personal language model (Personal.ai, Lindy.ai)
2. **Style vector extraction** — Extract formality, sentence length distribution, vocabulary, greeting/closing patterns, emoji usage, response latency
3. **Contextual adaptation** — Adjust tone per recipient and relationship (boss vs. colleague vs. friend)
4. **Continuous learning** — MindBank AI, Viven.ai ingest every digital interaction to build evolving persona model

#### Safety Guardrails (Field-Proven)
- **39% of companies** reported agents accessing unintended systems (2025)
- **32%** saw agents allowing inappropriate data downloads
- **Action cascades**: small reasoning errors trigger expensive loops or catastrophic irreversible actions

**Proven patterns:**
1. **Safety Agent** — Dedicated policy-enforcement agent evaluates every action before execution
2. **Layered defense**: Input validation → action-level permissions → output filtering → runtime anomaly detection
3. **Risk-tiered oversight**: Low=auto, Medium=async approval, High=sync dual-approval, Prohibited=hardcoded deny
4. **Blast radius containment**: Sandbox execution, rate limiting, auto-rollback, budget/spending caps
5. **Confidence-based escalation**: Low confidence → ask human. High confidence → execute.
6. **Audit trail**: Full log of every action with timestamps + undo capability

**Critical principle**: Guardrails must be living systems, not static rules. Evolve alongside agent capabilities.

#### Digital Twin Ethics
- Distinguish **delegation** (agent acts on your behalf, clear attribution) from **impersonation** (pretends to be you, no disclosure)
- MIT Media Lab: use OAuth 2.0 On-Behalf-Of tokens so downstream systems know it's an agent
- Every action traceable to original user
- Voice/style cloning without consent has emerging legal implications

### Pending / Next Steps

#### Hacker — Priority Enhancements
- [ ] **Recon methodology engine** — structured workflow: target → subdomain → port scan → fingerprint → vuln scan → exploit → report
- [ ] **CTF solver mode** — specialized reasoning per category (web, crypto, forensics, RE, binary), RAG over common techniques
- [ ] **Tool command generation** — ready-to-run sequences for nmap, gobuster, sqlmap, nuclei, subfinder (not generic advice)
- [ ] **CVE web search integration** — auto-search when software versions mentioned
- [ ] **Hacker lens for non-security** — growth hacking, process hacking, system gaming prompts
- [ ] **OSINT pipeline** — structured intelligence gathering workflows

#### Operator — Priority Enhancements
- [ ] **Tiered autonomy system** — low/medium/high risk classification for actions
- [ ] **Style matching from memory** — pull user's writing patterns from MemoryAgent
- [ ] **Delegation confidence scoring** — internal threshold for ask vs. execute
- [ ] **Workflow templates** — repeatable multi-step processes triggered by phrases
- [ ] **Post-action reports** — structured "here's what I did" with undo options
- [ ] **Safety guardrails** — financial/destructive actions always confirm, 30s undo window

#### Dreamer — Priority Enhancements
- [ ] **Dream journal integration** — persistent dream log that builds patterns over time
- [ ] **Symbol database** — common dream symbols with personal override layer from user history
- [ ] **Vision-to-plan pipeline** — convert aspirational visions into TaskPlanner-compatible step sequences
- [ ] **Worldbuilding toolkit** — structured templates for fiction universes, game worlds, speculative scenarios
- [ ] **Dream-to-image bridge** — auto-trigger image gen from vivid dream descriptions

#### Housekeeping
- [ ] **All three: Add emblem SVGs** — `concepts/emblem-hacker.svg`, `concepts/emblem-operator.svg`, `concepts/emblem-dreamer.svg`
- [ ] **All three: Add to useColorCycle.ts** — light/dark palette entries for background cycling
- [ ] **Test: Add keyword classification tests** — verify routing for all three new agents

---

## Previous Session (2026-03-03, continued)

### Accomplished This Session

#### 6-Phase Platform Expansion — ALL PHASES COMPLETE

Implemented, tested, and deployed all 6 phases from the platform expansion plan:

**Phase 1: Conversation Folders** (completed in prior session)
- DB migration `058_conversation_folders.sql`, `useFolders.ts` hook, ConversationDrawer accordion UI
- Move-to-folder submenu in header ⋮ menu, custom folder icons

**Phase 2: Voice Input/Output**
- `useVoiceInput.ts`: Web Speech API primary + MediaRecorder/Whisper fallback
- `useVoiceOutput.ts`: OpenAI TTS (Pro) + browser speechSynthesis (free)
- `useVoiceLoop.ts`: continuous voice conversation mode (Pro only)
- `VoiceLoopOverlay.tsx`: full-screen animated overlay (listening/thinking/speaking)
- Mic button in input bar, TTS speaker button on messages

**Phase 3A: SW Cache Versioning**
- `lazyRetry.ts`: SKIP_WAITING instead of unregistering SW, only clear app-code cache
- `sw.ts`: navigation preload in activate handler

**Phase 3B: Bundle Splitting**
- Converted `manualChunks` from object to function form
- Extracted `vendor-i18n` (22KB gzip) and `vendor-zustand` chunks
- **Main `index.js`: 106KB gzip → 17KB gzip (84% reduction)**

**Phase 3C: E2E Test Suite**
- 15 tests across auth, chat, conversations, dark-mode, pro-gating, mobile
- Playwright fixtures with mock claude-proxy, auth state persistence
- Visual regression tests (light/dark mode screenshots)
- `.github/workflows/e2e.yml` CI workflow
- Total: 28 E2E tests passing

**Phase 4: Collaborative Live Share**
- Migration `059_live_shares.sql`: live_shares + live_share_participants tables
- Edge function `live-share`: create/join/kick/revoke/status
- `useLiveShare.ts`: Supabase Realtime channels + presence tracking
- `LiveShareBadge.tsx`, `ShareModal.tsx` live share tab, `LiveSharePage.tsx`
- Route: `/#/live/:code`

**Phase 5: Team/Workspace Tier**
- Migration `060_teams_workspaces.sql`: workspaces, workspace_members, workspace_invitations
- Edge function `workspace-invite`: invite/accept/revoke/list
- `useWorkspace.ts`, `WorkspaceSwitcher.tsx`, `WorkspaceAdminPage.tsx`
- Route: `/#/workspace/:id`

**Phase 6: Mobile App Wrapper (Capacitor)**
- `capacitor.config.ts`: appId `chat.kernel.app`, push notification config
- `src/utils/platform.ts`: isNativePlatform, getPlatform, isIOS, isAndroid
- `src/hooks/useNativePush.ts`: dynamic import, registration, listeners
- npm scripts: cap:sync, cap:ios, cap:android

#### Deployment Summary
- All commits pushed to `origin/main`
- Frontend deployed to kernel.chat (GitHub Pages)
- DB migrations 059 + 060 applied to Supabase
- Edge functions deployed: `live-share`, `workspace-invite`, `project-files`

#### Test Results
- 420/420 unit tests pass (Vitest)
- 28/28 E2E tests pass (Playwright)
- Zero TypeScript errors
- Clean build

#### Bugs Fixed During Testing
- `gen_random_bytes` → `md5(random())` for Supabase compatibility
- Migration 060 forward reference: reordered tables before policies
- Playwright config: switched to preview server (legacy dir broke dev server)
- `test.use(devices[...])` moved to top level in mobile.spec.ts
- `SpeechRecognition` class declaration added to vite-env.d.ts
- Voice hook ordering: split hooks to avoid block-scoped variable error

---

## Previous Session (2026-03-03)

### Accomplished
- Dark mode tokens (warm brown), removed VITE_GEMINI env vars
- framer-motion → motion upgrade (51 files)
- Server-side project persistence (Pro feature)
- Image gen continuity, lightbox mobile dismiss
- Mobile auth redirect fix (3 root causes)
- PWA cache staleness fixes

---

## Previous Sessions (2026-02-26 to 2026-02-28)

### Accomplished
- Image gen reference images, backlog cleanup, ship pipeline
- Image credit packs, auto-expire comped subscriptions
- Data export, API key rotation, notification UX, landing page redesign

---

## Previous Sessions (2026-02-17 to 2026-02-25)

### Accomplished
- Pro features E2E testing & 3 critical bug fixes
- Web search for free users, i18n cache busting
- Full system debug audit — 27 bugs fixed
- Privacy Policy, Terms of Service, convergence, free-tier limits
- Account settings, onboarding, conversation search, backend hardening
- Entity system, ChatGPT import, Stripe, Discord bot
- P1-P14: Dark mode, test suite, panels, i18n, artifacts, agent audit, design overhaul, mobile audit

---

## Ongoing Backlog

- **Comped Pro — siijoseph333@gmail.com**: Active until 2026-03-27. Auto-expiration handles it.
- **P1 test fixes** (non-blocking): MoreMenu.test.tsx and BottomTabBar.test.tsx have pre-existing failures (component changed, tests not updated) — actually these now pass after recent changes
- **Capacitor native shells**: Need `npx cap add ios && npx cap add android` to generate native projects (requires Xcode/Android Studio)
- **Capacitor advanced**: Biometric auth, deep linking, App Store submission not yet implemented

## Key Decisions Made

- Rate limits: Postgres fixed-window counters with atomic upsert, fail-open semantics
- SSRF blocklist: 10 regex patterns covering all private/reserved ranges
- All RPCs: SECURITY DEFINER with privileges revoked from public/authenticated/anon
- Entity: 32-bit aesthetic with outline ring, gradient fills, cursor-tracking eyes
- Bottom-sheet pattern for all panels
- Dark mode: warm brown undertones, never cool gray — "lamplight reading" principle
- Zero Tailwind — all vanilla CSS with `ka-` prefix and Rubin design tokens
- Edge function deploys: ALWAYS use `--no-verify-jwt` flag
- Onboarding: single screen; sessionStorage bridge pattern
- Account settings: bottom-sheet panel, OAuth localStorage flag for redirect reopen
- Upload limits: flat 50MB per file everywhere — no free/pro tier split
- Claude proxy payload limits: 50MB (was 32KB/256KB — broke file uploads)
- Free-tier messaging: 20 messages per 24h rolling window, RPC returns JSONB `{daily_count, resets_at}`
- Convergence: 6 facet agents, Haiku extraction every 3 msgs, Sonnet convergence every ~5 msgs
- Legal pages: Plain-language React components at `/#/privacy` and `/#/terms`
- File routing: When `ContentBlock[]` (images/PDFs) attached, always use direct Claude call — never route through swarm/workflow/research (they only accept strings)
- Web search: uses Claude's built-in `web_search_20250305` tool (NOT Perplexity), available to ALL users
- i18n cache busting: `__BUILD_TIME__` define + `queryStringParams` in i18next-http-backend
- Thinking toggle: Concentric-ring icon (`IconThinking`), circular 40px button, pulse animation when active
- Animation tokens: `src/constants/motion.ts` (JS) synced with CSS custom properties in `:root`
- Share link previews: Cloudflare Workers as crawler-aware proxy (GH Pages + hash routing)
- Legal compliance: California law, LA County, AAA arbitration. GDPR legal bases mapped per activity.
- Multi-provider LLM: claude-proxy supports Anthropic (default), OpenAI, Google Gemini, NVIDIA Llama
- Image generation: Credit-gated (not subscription-included), Gemini 2.5 Flash Image. Rate limit 10/min.
- Subscription expiration: task-scheduler checks every 5 min, deactivates expired subs
- Landing page: ParticleGrid visual identity. Canvas can't read CSS vars — hex values hardcoded in JS.
- **OAuth: implicit flow** (`flowType: 'implicit'`), `detectSessionInUrl: false`. Manual token handling in `main.tsx` before React renders. No hardcoded API key fallbacks.
- **SW caching**: `fetchOptions: { cache: 'reload' }` on HTML route bypasses browser HTTP cache. 30-min periodic update check for SPAs.
- **framer-motion → motion**: Rebranded in v12. Import path `'motion/react'`. Drop-in replacement.
- **Project file persistence**: Pro feature. Edge function `project-files` saves to Supabase Storage.
- **Bundle splitting**: Function-form manualChunks. vendor-i18n + vendor-zustand extracted. Main index.js 106KB → 17KB gzip.
- **Live Share**: Supabase Realtime channels for presence + postgres_changes for message sync. Access codes via md5(random()).
- **Workspaces**: 3-role system (owner/admin/member). Invite by email with 7-day expiry. workspace_id on conversations + folders.
- **Voice I/O**: Web Speech API primary, Whisper fallback. Pro TTS via OpenAI edge function, free via speechSynthesis. Voice loop = continuous listen→submit→TTS cycle.
- **Capacitor**: appId `chat.kernel.app`. Dynamic imports for native plugins (avoids bundling for web). ios/ and android/ gitignored.
- **E2E tests**: Playwright with preview server (not dev server — legacy dir breaks Vite scan). Mock claude-proxy via page.route(). Visual regression snapshots.
- **Supabase gen_random_bytes**: Not in default search path. Use `md5(random()::text || clock_timestamp()::text)` instead.

## Test Accounts

- **Free**: `kernel-test-bot@antigravitygroup.co` — password in .env
- **Pro**: `kernel-pro-test@antigravitygroup.co` — password in .env

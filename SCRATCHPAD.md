# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.

## Current Session (2026-03-24)

### kbot v3.26.0 — Published to npm + GitHub

#### The Big Build: Finance Stack + Introspection Engine
- **Trader Agent** (`kbot --agent trader`) — 26th specialist, auto-routed for finance/crypto/stock queries
  - 4 strategy templates: DCA, momentum, mean-reversion, portfolio rebalance
  - Daily briefing protocol: market overview → sentiment → social pulse → TA → indices → portfolio
- **Finance Tools (11)**: market_data, market_overview, price_history, technical_analysis, paper_trade, market_sentiment, defi_yields, backtest_strategy, portfolio_rebalance, price_alert, trade_reasoning
- **Wallet & Swaps (9)**: wallet_setup, wallet_list, wallet_switch, wallet_send, wallet_tokens, wallet_history, swap_quote, swap_execute, token_search — AES-256-CBC encrypted, multi-wallet, Jupiter DEX
- **Stock Market (6)**: stock_quote, stock_history, stock_compare, stock_search, stock_screener, market_indices — Yahoo Finance free API
- **Social Sentiment (5)**: reddit_sentiment, crypto_news, github_activity, whale_tracker, social_pulse
- **Introspection Engine**: `kbot insights` (raw data viz), `kbot reflect` (narrative portrait), `kbot compare` (vs collective)
- **trade_reasoning** — full reasoning chain explaining WHY each signal is bullish/bearish
- **`kbot help`** CLI subcommand
- **CHANGELOG.md** created
- **51 tests** passing (finance TA math, wallet encryption, portfolio logic, risk limits)
- **~4,500 lines** of new code, 10 new source files

#### Ship Pipeline Results
- Gate 1 Security: 3 P0s on edge functions (agent-reply, game-brain, receive-email — no auth). Does NOT block npm publish.
- Gate 2 QA: Type-check PASS, build PASS, bundles within budget
- Published: npm `@kernel.chat/kbot@3.26.0` + GitHub `isaacsight/kernel@08fb1aa2`
- Discord announcement sent
- Twitter/X API auth expired — post content drafted, needs manual post or API key fix

#### Download Stats (organic, $0 marketing)
- 10,192 downloads in March 2026 (first real month)
- Growth: 0 → 761 → 1,245 → 6,700 → 1,486 per week
- Source: discovery daemon + npm SEO + word of mouth
- npm automation token configured (no more OTP needed for publish)

#### Security Findings (Not Yet Fixed)
- `supabase/functions/agent-reply/index.ts` — no auth (P0)
- `supabase/functions/game-brain/index.ts` — no auth, open proxy to Anthropic key (P0)
- `supabase/functions/receive-email/index.ts` — webhook signature validation is a no-op (P0)
- `supabase/functions/setup-billing-meter/index.ts` — unauthenticated admin endpoint still deployed (P1)

#### Web (Not Deployed This Session)
- Security page built at `/#/security` (SecurityPage.tsx + CSS + route)
- Web build passes but was not deployed — user wanted focus on kbot tools only

### Next Session Priorities
- Fix 3 P0 security issues on edge functions (agent-reply, game-brain, receive-email)
- Fix Twitter/X API auth for automated social posting
- Deploy web (security page goes live)
- SYNTH game: check overnight agents from Mar 22 (floor modifiers, meta-progression, mobile touch)
- Performance profiling on SYNTH (45K lines needs testing)
- Consider: kbot Pro tier gating for advanced finance tools (backtest, real swaps)
- Consider: Solana @solana/web3.js integration for raw SOL transfers (wallet_send currently limited)

## Previous Sessions

### 2026-03-22 → 2026-03-23: SYNTH Game Build
- 60+ source files, 45K+ lines of game code at kernel.chat/#/play
- Latent Dissolution art style, operative camera, weapon mods, 8 enemy types
- 5 client-side AI systems, BSP dungeons, procedural systems
- See git history for details

### Prior
See git history for earlier session context.

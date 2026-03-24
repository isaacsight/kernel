# Changelog

## 3.26.0 (2026-03-24)

### New: Trader Agent
- `kbot --agent trader` — crypto market analysis, paper trading, DeFi yield scanning
- Auto-routed via Bayesian skill ratings when user mentions trading, crypto, prices, portfolios
- Trading framework: Signal → Risk Assessment → Execution Plan
- Paper trading first by default — real trades require wallet setup + confirmation

### New: Finance Tools (7)
- `market_data` — real-time price, market cap, volume, 24h/7d/30d change (CoinGecko, 10K+ tokens)
- `market_overview` — full market snapshot: BTC dominance, top coins, macro view
- `price_history` — historical OHLCV data for any timeframe (1d–365d)
- `technical_analysis` — RSI, SMA/EMA, MACD, Bollinger Bands with actionable signals
- `paper_trade` — virtual $100K portfolio with risk limits (25% max position, 15% stop loss)
- `market_sentiment` — Fear & Greed Index, trending coins, social signals
- `defi_yields` — top DeFi yield opportunities across all chains (DeFiLlama)

### New: Solana Wallet & Jupiter Swaps (6 tools)
- `wallet_setup` — create or import Solana wallet, AES-256-CBC encrypted at rest
- `wallet_tokens` — all SPL token balances with USD values (Jupiter Price API)
- `wallet_history` — recent transaction history from on-chain
- `swap_quote` — Jupiter DEX quote (read-only, no wallet needed)
- `swap_execute` — execute swap with safety gates (confirmed: "yes", max tx limit, SOL-equivalent check)
- `token_search` — find Solana tokens by name/symbol with mint addresses

### New: `kbot help` CLI command
- Quick reference for commands, agents, and support channels
- Available from the shell (not just REPL `/help`)

### Security
- Wallet private keys encrypted at rest (AES-256-CBC, machine-derived key)
- Wallet files chmod 600 (owner read/write only)
- Max transaction limit per wallet (default: 1 SOL)
- `confirmed: "yes"` required for every real swap
- SOL-equivalent price check for non-SOL token transactions

### Fixes
- Updated REPL `/help` agent/tool counts (25→26 agents, 223→300+ tools)

## 3.25.2 (2026-03-22)

- Machine awareness: `probeMachine()` system profiler (CPU, GPU, RAM, display, battery, dev tools)
- Synthesis Engine: closed-loop intelligence compounding (8 operations)
- Privacy Router: local-first routing decisions
- Sandbox Policy: configurable tool execution boundaries
- Discovery daemon: autonomous outreach (HN, GitHub, Reddit)

## 3.25.0 (2026-03-18)

- Machine tools: `machine_profile`, `machine_capabilities`, `machine_benchmark`
- Provider fallback hardening: graceful cascade with retry budgets
- Context window improvements: priority-based compaction

## Previous versions

See git history.

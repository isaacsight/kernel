// kbot Finance Tools — Market data, technical analysis, paper trading, wallet queries
// All market data uses free APIs (CoinGecko, Yahoo). No auth required for read-only.
// Paper trading is local-only (~/.kbot/paper-portfolio.json).
// Real trading requires explicit wallet config + user confirmation.
import { registerTool } from './index.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const PORTFOLIO_DIR = join(homedir(), '.kbot');
const PORTFOLIO_PATH = join(PORTFOLIO_DIR, 'paper-portfolio.json');
function loadPortfolio() {
    if (existsSync(PORTFOLIO_PATH)) {
        return JSON.parse(readFileSync(PORTFOLIO_PATH, 'utf-8'));
    }
    const fresh = {
        cash: 100_000,
        positions: [],
        trades: [],
        createdAt: new Date().toISOString(),
        limits: {
            maxPositionPct: 25,
            maxDailyLossPct: 5,
            stopLossPct: 15,
        },
    };
    savePortfolio(fresh);
    return fresh;
}
function savePortfolio(p) {
    if (!existsSync(PORTFOLIO_DIR))
        mkdirSync(PORTFOLIO_DIR, { recursive: true });
    writeFileSync(PORTFOLIO_PATH, JSON.stringify(p, null, 2));
}
// ── Helpers ──
async function fetchJSON(url, timeout = 10_000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'KBot/3.0 (Finance Tools)', Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
}
function fmt(n, decimals = 2) {
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
// ── Technical Analysis Helpers ──
function sma(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
}
function ema(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
}
function rsi(closes, period = 14) {
    const gains = [];
    const losses = [];
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    const result = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
    }
    return result;
}
function bollingerBands(closes, period = 20, stdDevMult = 2) {
    const middle = sma(closes, period);
    const upper = [];
    const lower = [];
    for (let i = 0; i < middle.length; i++) {
        const slice = closes.slice(i, i + period);
        const mean = middle[i];
        const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
        const stdDev = Math.sqrt(variance);
        upper.push(mean + stdDevMult * stdDev);
        lower.push(mean - stdDevMult * stdDev);
    }
    return { upper, middle, lower };
}
// ── Register Tools ──
export function registerFinanceTools() {
    // ─── Market Data ───
    registerTool({
        name: 'market_data',
        description: 'Get current price, market cap, volume, and 24h change for any cryptocurrency or token. Uses CoinGecko (free, no API key). Supports 10,000+ tokens.',
        parameters: {
            symbol: { type: 'string', description: 'Token symbol or CoinGecko ID (e.g. "bitcoin", "ethereum", "solana", "BTC", "ETH")', required: true },
            currency: { type: 'string', description: 'Fiat currency for prices (default: usd)', default: 'usd' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const symbol = String(args.symbol).toLowerCase();
            const currency = String(args.currency || 'usd').toLowerCase();
            // Map common ticker symbols to CoinGecko IDs
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', dot: 'polkadot', avax: 'avalanche-2', matic: 'matic-network',
                link: 'chainlink', uni: 'uniswap', aave: 'aave', doge: 'dogecoin',
                shib: 'shiba-inu', xrp: 'ripple', ltc: 'litecoin', atom: 'cosmos',
                near: 'near', apt: 'aptos', arb: 'arbitrum', op: 'optimism',
                sui: 'sui', sei: 'sei-network', jup: 'jupiter-exchange-solana',
            };
            const id = symbolMap[symbol] || symbol;
            const data = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
            const market = data.market_data;
            if (!market)
                return `Could not find data for "${symbol}". Try the full CoinGecko ID (e.g. "bitcoin" not "btc").`;
            const price = market.current_price?.[currency] ?? 0;
            const change24h = market.price_change_percentage_24h ?? 0;
            const change7d = market.price_change_percentage_7d ?? 0;
            const change30d = market.price_change_percentage_30d ?? 0;
            const marketCap = market.market_cap?.[currency] ?? 0;
            const volume = market.total_volume?.[currency] ?? 0;
            const high24h = market.high_24h?.[currency] ?? 0;
            const low24h = market.low_24h?.[currency] ?? 0;
            const ath = market.ath?.[currency] ?? 0;
            const athDate = market.ath_date?.[currency] ?? '';
            const athChange = market.ath_change_percentage?.[currency] ?? 0;
            return [
                `## ${data.name} (${data.symbol.toUpperCase()})`,
                '',
                `**Price**: $${fmt(price, price < 1 ? 6 : 2)}`,
                `**24h**: ${change24h >= 0 ? '+' : ''}${fmt(change24h)}%  |  **7d**: ${change7d >= 0 ? '+' : ''}${fmt(change7d)}%  |  **30d**: ${change30d >= 0 ? '+' : ''}${fmt(change30d)}%`,
                `**24h Range**: $${fmt(low24h, price < 1 ? 6 : 2)} — $${fmt(high24h, price < 1 ? 6 : 2)}`,
                `**Market Cap**: $${fmt(marketCap, 0)}`,
                `**24h Volume**: $${fmt(volume, 0)}`,
                `**ATH**: $${fmt(ath, price < 1 ? 6 : 2)} (${athDate.split('T')[0]}) — ${fmt(athChange)}% from ATH`,
                '',
                `*Data from CoinGecko — ${new Date().toISOString().split('T')[0]}*`,
            ].join('\n');
        },
    });
    registerTool({
        name: 'market_overview',
        description: 'Get a snapshot of the entire crypto market — total market cap, BTC dominance, top gainers/losers, trending coins. Good for daily briefings.',
        parameters: {
            limit: { type: 'number', description: 'Number of top coins to show (default: 10, max: 50)', default: 10 },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const limit = Math.min(Number(args.limit) || 10, 50);
            const [globalData, marketsData] = await Promise.all([
                fetchJSON('https://api.coingecko.com/api/v3/global'),
                fetchJSON(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d`),
            ]);
            const g = globalData.data;
            const lines = [
                '## Crypto Market Overview',
                '',
                `**Total Market Cap**: $${fmt(g.total_market_cap?.usd ?? 0, 0)}`,
                `**24h Volume**: $${fmt(g.total_volume?.usd ?? 0, 0)}`,
                `**BTC Dominance**: ${fmt(g.market_cap_percentage?.btc ?? 0)}%`,
                `**ETH Dominance**: ${fmt(g.market_cap_percentage?.eth ?? 0)}%`,
                `**Active Coins**: ${g.active_cryptocurrencies?.toLocaleString() ?? '?'}`,
                '',
                `### Top ${limit} by Market Cap`,
                '',
                '| # | Coin | Price | 24h | 7d | Market Cap |',
                '|---|------|-------|-----|-----|------------|',
            ];
            for (let i = 0; i < marketsData.length; i++) {
                const c = marketsData[i];
                const p = c.current_price;
                const ch24 = c.price_change_percentage_24h_in_currency ?? 0;
                const ch7d = c.price_change_percentage_7d_in_currency ?? 0;
                lines.push(`| ${i + 1} | ${c.symbol.toUpperCase()} | $${fmt(p, p < 1 ? 4 : 2)} | ${ch24 >= 0 ? '+' : ''}${fmt(ch24)}% | ${ch7d >= 0 ? '+' : ''}${fmt(ch7d)}% | $${fmt(c.market_cap, 0)} |`);
            }
            lines.push('', `*${new Date().toISOString().split('T')[0]}*`);
            return lines.join('\n');
        },
    });
    // ─── Price History & Charts ───
    registerTool({
        name: 'price_history',
        description: 'Get historical price data (OHLCV) for a cryptocurrency. Returns daily candles. Useful for charting, backtesting, and trend analysis.',
        parameters: {
            symbol: { type: 'string', description: 'Token symbol or CoinGecko ID', required: true },
            days: { type: 'number', description: 'Number of days of history (1, 7, 14, 30, 90, 180, 365, max)', default: 30 },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const symbol = String(args.symbol).toLowerCase();
            const days = Number(args.days) || 30;
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', dot: 'polkadot', doge: 'dogecoin', xrp: 'ripple',
            };
            const id = symbolMap[symbol] || symbol;
            const data = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
            if (!data?.length)
                return `No price history for "${symbol}".`;
            const lines = [
                `## ${id.toUpperCase()} — ${days}d OHLCV`,
                '',
                '| Date | Open | High | Low | Close |',
                '|------|------|------|-----|-------|',
            ];
            // Show at most 30 rows (sample if more data)
            const step = Math.max(1, Math.floor(data.length / 30));
            for (let i = 0; i < data.length; i += step) {
                const [ts, o, h, l, c] = data[i];
                const date = new Date(ts).toISOString().split('T')[0];
                lines.push(`| ${date} | $${fmt(o)} | $${fmt(h)} | $${fmt(l)} | $${fmt(c)} |`);
            }
            // Summary stats
            const closes = data.map(d => d[4]);
            const first = closes[0];
            const last = closes[closes.length - 1];
            const changePct = ((last - first) / first) * 100;
            const high = Math.max(...data.map(d => d[2]));
            const low = Math.min(...data.map(d => d[3]));
            lines.push('', `**Period Return**: ${changePct >= 0 ? '+' : ''}${fmt(changePct)}%`, `**Period High**: $${fmt(high)}  |  **Low**: $${fmt(low)}`, `**Volatility**: $${fmt(high - low)} range (${fmt(((high - low) / last) * 100)}% of current price)`);
            return lines.join('\n');
        },
    });
    // ─── Technical Analysis ───
    registerTool({
        name: 'technical_analysis',
        description: 'Run technical analysis on a cryptocurrency — RSI, moving averages (SMA/EMA), Bollinger Bands, MACD signal. Returns actionable signals.',
        parameters: {
            symbol: { type: 'string', description: 'Token symbol or CoinGecko ID', required: true },
            days: { type: 'number', description: 'Days of data to analyze (default: 90)', default: 90 },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const symbol = String(args.symbol).toLowerCase();
            const days = Number(args.days) || 90;
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', dot: 'polkadot', doge: 'dogecoin', xrp: 'ripple',
            };
            const id = symbolMap[symbol] || symbol;
            const data = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
            if (!data?.length || data.length < 30)
                return `Not enough data for technical analysis on "${symbol}". Need at least 30 days.`;
            const closes = data.map(d => d[4]);
            const current = closes[closes.length - 1];
            // RSI
            const rsiValues = rsi(closes, 14);
            const currentRsi = rsiValues[rsiValues.length - 1];
            const rsiSignal = currentRsi > 70 ? 'OVERBOUGHT' : currentRsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
            // Moving averages
            const sma20 = sma(closes, 20);
            const sma50 = sma(closes, Math.min(50, Math.floor(closes.length / 2)));
            const ema12 = ema(closes, 12);
            const ema26 = ema(closes, 26);
            const currentSma20 = sma20[sma20.length - 1];
            const currentSma50 = sma50[sma50.length - 1];
            // MACD
            const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
            const macdSignal = macdLine > 0 ? 'BULLISH' : 'BEARISH';
            // Bollinger Bands
            const bb = bollingerBands(closes, 20);
            const bbUpper = bb.upper[bb.upper.length - 1];
            const bbLower = bb.lower[bb.lower.length - 1];
            const bbMiddle = bb.middle[bb.middle.length - 1];
            const bbPosition = current > bbUpper ? 'ABOVE UPPER BAND' : current < bbLower ? 'BELOW LOWER BAND' : 'WITHIN BANDS';
            // Trend
            const trend = current > currentSma20 && currentSma20 > currentSma50 ? 'UPTREND'
                : current < currentSma20 && currentSma20 < currentSma50 ? 'DOWNTREND'
                    : 'SIDEWAYS';
            // Overall signal
            let bullish = 0;
            let bearish = 0;
            if (currentRsi < 30)
                bullish++;
            if (currentRsi > 70)
                bearish++;
            if (current > currentSma20)
                bullish++;
            else
                bearish++;
            if (current > currentSma50)
                bullish++;
            else
                bearish++;
            if (macdLine > 0)
                bullish++;
            else
                bearish++;
            if (current < bbLower)
                bullish++;
            if (current > bbUpper)
                bearish++;
            const overall = bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'NEUTRAL';
            return [
                `## ${id.toUpperCase()} — Technical Analysis`,
                '',
                `**Price**: $${fmt(current)} | **Trend**: ${trend}`,
                '',
                '### Indicators',
                '',
                `| Indicator | Value | Signal |`,
                `|-----------|-------|--------|`,
                `| RSI (14) | ${fmt(currentRsi)} | ${rsiSignal} |`,
                `| SMA (20) | $${fmt(currentSma20)} | Price ${current > currentSma20 ? 'above' : 'below'} |`,
                `| SMA (50) | $${fmt(currentSma50)} | Price ${current > currentSma50 ? 'above' : 'below'} |`,
                `| MACD | ${fmt(macdLine, 4)} | ${macdSignal} |`,
                `| Bollinger | $${fmt(bbLower)} — $${fmt(bbUpper)} | ${bbPosition} |`,
                '',
                `### Signal Summary: **${overall}** (${bullish} bullish / ${bearish} bearish)`,
                '',
                `*${days}d analysis — ${new Date().toISOString().split('T')[0]}. Not financial advice.*`,
            ].join('\n');
        },
    });
    // ─── Paper Trading ───
    registerTool({
        name: 'paper_trade',
        description: 'Execute a simulated trade in your paper portfolio. Starts with $100,000 virtual cash. Use this to test strategies risk-free. Enforces position limits and stop losses.',
        parameters: {
            action: { type: 'string', description: 'Action: "buy", "sell", "portfolio", "reset", "history"', required: true },
            symbol: { type: 'string', description: 'Token symbol (required for buy/sell)' },
            amount: { type: 'number', description: 'USD amount to buy, or quantity to sell' },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const portfolio = loadPortfolio();
            if (action === 'reset') {
                const fresh = {
                    cash: 100_000,
                    positions: [],
                    trades: [],
                    createdAt: new Date().toISOString(),
                    limits: portfolio.limits,
                };
                savePortfolio(fresh);
                return '**Paper portfolio reset.** Starting fresh with $100,000.';
            }
            if (action === 'history') {
                if (!portfolio.trades.length)
                    return 'No trades yet. Use `paper_trade buy <symbol> <amount>` to start.';
                const lines = ['## Trade History', '', '| Time | Action | Symbol | Qty | Price | P&L |', '|------|--------|--------|-----|-------|-----|'];
                for (const t of portfolio.trades.slice(-20)) {
                    lines.push(`| ${t.timestamp.split('T')[0]} | ${t.side.toUpperCase()} | ${t.symbol} | ${fmt(t.quantity, 4)} | $${fmt(t.price)} | ${t.pnl != null ? `$${fmt(t.pnl)}` : '—'} |`);
                }
                return lines.join('\n');
            }
            if (action === 'portfolio') {
                const lines = ['## Paper Portfolio', ''];
                lines.push(`**Cash**: $${fmt(portfolio.cash)}`);
                if (!portfolio.positions.length) {
                    lines.push('**Positions**: None');
                }
                else {
                    lines.push('', '| Symbol | Qty | Avg Cost | Side |', '|--------|-----|----------|------|');
                    for (const p of portfolio.positions) {
                        lines.push(`| ${p.symbol} | ${fmt(p.quantity, 4)} | $${fmt(p.avgCost)} | ${p.side} |`);
                    }
                }
                const totalPnl = portfolio.trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
                lines.push('', `**Realized P&L**: $${fmt(totalPnl)}`, `**Trades**: ${portfolio.trades.length}`);
                return lines.join('\n');
            }
            if (action === 'buy' || action === 'sell') {
                const symbol = String(args.symbol || '').toLowerCase();
                if (!symbol)
                    return 'Error: symbol is required for buy/sell.';
                const amount = Number(args.amount);
                if (!amount || amount <= 0)
                    return 'Error: amount must be a positive number.';
                // Fetch current price
                const symbolMap = {
                    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                    ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
                };
                const id = symbolMap[symbol] || symbol;
                const priceData = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
                const price = priceData[id]?.usd;
                if (!price)
                    return `Could not fetch price for "${symbol}".`;
                if (action === 'buy') {
                    if (amount > portfolio.cash)
                        return `Insufficient cash. Have $${fmt(portfolio.cash)}, need $${fmt(amount)}.`;
                    // Check position limit
                    const totalValue = portfolio.cash + portfolio.positions.reduce((s, p) => s + p.quantity * p.avgCost, 0);
                    if (amount / totalValue * 100 > portfolio.limits.maxPositionPct) {
                        return `**RISK LIMIT**: Position would exceed ${portfolio.limits.maxPositionPct}% of portfolio. Max buy: $${fmt(totalValue * portfolio.limits.maxPositionPct / 100)}.`;
                    }
                    const qty = amount / price;
                    const existing = portfolio.positions.find(p => p.symbol === symbol && p.side === 'long');
                    if (existing) {
                        const totalQty = existing.quantity + qty;
                        existing.avgCost = (existing.avgCost * existing.quantity + price * qty) / totalQty;
                        existing.quantity = totalQty;
                    }
                    else {
                        portfolio.positions.push({ symbol, quantity: qty, avgCost: price, side: 'long', openedAt: new Date().toISOString() });
                    }
                    portfolio.cash -= amount;
                    portfolio.trades.push({ symbol, side: 'buy', quantity: qty, price, timestamp: new Date().toISOString() });
                    savePortfolio(portfolio);
                    return `**BOUGHT** ${fmt(qty, 6)} ${symbol.toUpperCase()} @ $${fmt(price)} for $${fmt(amount)}.\nCash remaining: $${fmt(portfolio.cash)}`;
                }
                if (action === 'sell') {
                    const pos = portfolio.positions.find(p => p.symbol === symbol && p.side === 'long');
                    if (!pos)
                        return `No ${symbol.toUpperCase()} position to sell.`;
                    const qty = Math.min(amount, pos.quantity);
                    const proceeds = qty * price;
                    const costBasis = qty * pos.avgCost;
                    const pnl = proceeds - costBasis;
                    pos.quantity -= qty;
                    if (pos.quantity < 0.000001) {
                        portfolio.positions = portfolio.positions.filter(p => p !== pos);
                    }
                    portfolio.cash += proceeds;
                    portfolio.trades.push({ symbol, side: 'sell', quantity: qty, price, timestamp: new Date().toISOString(), pnl });
                    savePortfolio(portfolio);
                    return `**SOLD** ${fmt(qty, 6)} ${symbol.toUpperCase()} @ $${fmt(price)} for $${fmt(proceeds)}.\nP&L: ${pnl >= 0 ? '+' : ''}$${fmt(pnl)}\nCash: $${fmt(portfolio.cash)}`;
                }
            }
            return 'Unknown action. Use: buy, sell, portfolio, history, or reset.';
        },
    });
    // ─── Wallet Balance (Read-Only) ───
    registerTool({
        name: 'wallet_balance',
        description: 'Check the balance of any crypto wallet address (Solana or Ethereum). Read-only — does not require private keys. Uses public RPC endpoints.',
        parameters: {
            address: { type: 'string', description: 'Wallet address (Solana or Ethereum)', required: true },
            chain: { type: 'string', description: 'Blockchain: "solana" or "ethereum" (auto-detected if omitted)' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const address = String(args.address).trim();
            let chain = String(args.chain || '').toLowerCase();
            // Auto-detect chain from address format
            if (!chain) {
                if (address.startsWith('0x') && address.length === 42)
                    chain = 'ethereum';
                else if (address.length >= 32 && address.length <= 44 && !address.startsWith('0x'))
                    chain = 'solana';
                else
                    return 'Could not detect chain. Specify chain: "solana" or "ethereum".';
            }
            if (chain === 'solana') {
                const body = JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address],
                });
                const res = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
                    signal: AbortSignal.timeout(10_000),
                });
                const data = await res.json();
                if (data.error)
                    return `Error: ${data.error.message}`;
                const lamports = data.result?.value ?? 0;
                const sol = lamports / 1e9;
                // Get SOL price
                const priceData = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                const solPrice = priceData.solana?.usd ?? 0;
                return [
                    `## Solana Wallet`,
                    `**Address**: \`${address.slice(0, 6)}...${address.slice(-4)}\``,
                    `**Balance**: ${fmt(sol, 4)} SOL ($${fmt(sol * solPrice)})`,
                    `**SOL Price**: $${fmt(solPrice)}`,
                ].join('\n');
            }
            if (chain === 'ethereum') {
                const body = JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'],
                });
                const res = await fetch('https://eth.llamarpc.com', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
                    signal: AbortSignal.timeout(10_000),
                });
                const data = await res.json();
                if (data.error)
                    return `Error: ${data.error.message}`;
                const wei = parseInt(data.result, 16);
                const eth = wei / 1e18;
                const priceData = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const ethPrice = priceData.ethereum?.usd ?? 0;
                return [
                    `## Ethereum Wallet`,
                    `**Address**: \`${address.slice(0, 6)}...${address.slice(-4)}\``,
                    `**Balance**: ${fmt(eth, 6)} ETH ($${fmt(eth * ethPrice)})`,
                    `**ETH Price**: $${fmt(ethPrice)}`,
                ].join('\n');
            }
            return `Unsupported chain: ${chain}. Use "solana" or "ethereum".`;
        },
    });
    // ─── Market Sentiment ───
    registerTool({
        name: 'market_sentiment',
        description: 'Get crypto market sentiment — Fear & Greed Index, trending coins, and social signals. Useful for gauging market mood before trading.',
        parameters: {},
        tier: 'free',
        timeout: 15_000,
        async execute() {
            const lines = ['## Market Sentiment'];
            // Fear & Greed Index
            try {
                const fg = await fetchJSON('https://api.alternative.me/fng/?limit=7');
                if (fg.data?.length) {
                    const latest = fg.data[0];
                    const emoji = Number(latest.value) <= 25 ? '😱' : Number(latest.value) <= 45 ? '😟' : Number(latest.value) <= 55 ? '😐' : Number(latest.value) <= 75 ? '😊' : '🤑';
                    lines.push('', `### Fear & Greed Index: ${latest.value}/100 ${emoji} (${latest.value_classification})`, '', '| Date | Value | Classification |', '|------|-------|----------------|');
                    for (const d of fg.data) {
                        lines.push(`| ${new Date(Number(d.timestamp) * 1000).toISOString().split('T')[0]} | ${d.value} | ${d.value_classification} |`);
                    }
                }
            }
            catch {
                lines.push('', '*Fear & Greed Index unavailable*');
            }
            // Trending on CoinGecko
            try {
                const trending = await fetchJSON('https://api.coingecko.com/api/v3/search/trending');
                if (trending.coins?.length) {
                    lines.push('', '### Trending Coins (CoinGecko)', '');
                    for (const c of trending.coins.slice(0, 7)) {
                        const item = c.item;
                        lines.push(`- **${item.name}** (${item.symbol}) — #${item.market_cap_rank || '?'} market cap`);
                    }
                }
            }
            catch { /* skip */ }
            lines.push('', `*${new Date().toISOString().split('T')[0]}*`);
            return lines.join('\n');
        },
    });
    // ─── DeFi Yields ───
    registerTool({
        name: 'defi_yields',
        description: 'Show top DeFi yield opportunities across protocols (Aave, Compound, Lido, etc). Useful for finding passive income strategies.',
        parameters: {
            chain: { type: 'string', description: 'Filter by chain: ethereum, solana, arbitrum, etc. (default: all)' },
            limit: { type: 'number', description: 'Number of results (default: 15)', default: 15 },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const chain = args.chain ? String(args.chain).toLowerCase() : undefined;
            const limit = Math.min(Number(args.limit) || 15, 30);
            const data = await fetchJSON('https://yields.llama.fi/pools');
            if (!data?.data?.length)
                return 'Could not fetch DeFi yield data.';
            let pools = data.data
                .filter((p) => p.tvlUsd > 1_000_000 && p.apy > 0.1) // >$1M TVL, >0.1% APY
                .sort((a, b) => b.apy - a.apy);
            if (chain)
                pools = pools.filter((p) => p.chain?.toLowerCase() === chain);
            pools = pools.slice(0, limit);
            const lines = [
                `## Top DeFi Yields${chain ? ` (${chain})` : ''}`,
                '',
                '| Protocol | Pool | Chain | APY | TVL |',
                '|----------|------|-------|-----|-----|',
            ];
            for (const p of pools) {
                lines.push(`| ${p.project} | ${p.symbol} | ${p.chain} | ${fmt(p.apy)}% | $${fmt(p.tvlUsd, 0)} |`);
            }
            lines.push('', '*Data from DeFiLlama. APY fluctuates. DYOR.*');
            return lines.join('\n');
        },
    });
    // ─── Backtesting Engine ───
    registerTool({
        name: 'backtest_strategy',
        description: 'Backtest a trading strategy against historical crypto data. Supports: DCA (dollar-cost averaging), momentum (buy on RSI oversold, sell overbought), and mean-reversion (buy below lower Bollinger, sell above upper). Returns P&L, win rate, max drawdown.',
        parameters: {
            symbol: { type: 'string', description: 'Token symbol or CoinGecko ID', required: true },
            strategy: { type: 'string', description: 'Strategy: "dca", "momentum", or "mean-reversion"', required: true },
            days: { type: 'number', description: 'Days of historical data to test against (default: 180)', default: 180 },
            investment: { type: 'number', description: 'Total investment amount in USD (default: 10000)', default: 10000 },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const symbol = String(args.symbol).toLowerCase();
            const strategy = String(args.strategy).toLowerCase();
            const days = Number(args.days) || 180;
            const investment = Number(args.investment) || 10000;
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
            };
            const id = symbolMap[symbol] || symbol;
            const data = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
            if (!data?.length || data.length < 30)
                return `Not enough data for backtest. Need at least 30 days.`;
            const closes = data.map(d => d[4]);
            const trades = [];
            let cash = investment;
            let holdings = 0;
            let peakValue = investment;
            let maxDrawdown = 0;
            if (strategy === 'dca') {
                // Buy equal amounts at regular intervals
                const intervals = Math.min(closes.length, 30); // up to 30 buys
                const step = Math.floor(closes.length / intervals);
                const perBuy = investment / intervals;
                for (let i = 0; i < closes.length; i += step) {
                    if (cash < perBuy * 0.1)
                        break;
                    const buyAmt = Math.min(perBuy, cash);
                    const qty = buyAmt / closes[i];
                    holdings += qty;
                    cash -= buyAmt;
                    trades.push({ day: i, action: 'BUY', price: closes[i], qty });
                    const currentValue = cash + holdings * closes[i];
                    peakValue = Math.max(peakValue, currentValue);
                    const dd = (peakValue - currentValue) / peakValue * 100;
                    maxDrawdown = Math.max(maxDrawdown, dd);
                }
            }
            else if (strategy === 'momentum') {
                // RSI momentum: buy when RSI < 30, sell when RSI > 70
                const rsiValues = rsi(closes, 14);
                const rsiOffset = closes.length - rsiValues.length;
                for (let i = 0; i < rsiValues.length; i++) {
                    const priceIdx = i + rsiOffset;
                    if (rsiValues[i] < 30 && cash > 0) {
                        // Buy with 25% of remaining cash
                        const buyAmt = cash * 0.25;
                        const qty = buyAmt / closes[priceIdx];
                        holdings += qty;
                        cash -= buyAmt;
                        trades.push({ day: priceIdx, action: 'BUY', price: closes[priceIdx], qty });
                    }
                    else if (rsiValues[i] > 70 && holdings > 0) {
                        // Sell 50% of holdings
                        const sellQty = holdings * 0.5;
                        const proceeds = sellQty * closes[priceIdx];
                        holdings -= sellQty;
                        cash += proceeds;
                        trades.push({ day: priceIdx, action: 'SELL', price: closes[priceIdx], qty: sellQty });
                    }
                    const currentValue = cash + holdings * closes[priceIdx];
                    peakValue = Math.max(peakValue, currentValue);
                    const dd = (peakValue - currentValue) / peakValue * 100;
                    maxDrawdown = Math.max(maxDrawdown, dd);
                }
            }
            else if (strategy === 'mean-reversion') {
                // Bollinger Bands: buy below lower band, sell above upper band
                const bb = bollingerBands(closes, 20);
                const bbOffset = closes.length - bb.middle.length;
                for (let i = 0; i < bb.middle.length; i++) {
                    const priceIdx = i + bbOffset;
                    if (closes[priceIdx] < bb.lower[i] && cash > 0) {
                        const buyAmt = cash * 0.3;
                        const qty = buyAmt / closes[priceIdx];
                        holdings += qty;
                        cash -= buyAmt;
                        trades.push({ day: priceIdx, action: 'BUY', price: closes[priceIdx], qty });
                    }
                    else if (closes[priceIdx] > bb.upper[i] && holdings > 0) {
                        const sellQty = holdings * 0.5;
                        const proceeds = sellQty * closes[priceIdx];
                        holdings -= sellQty;
                        cash += proceeds;
                        trades.push({ day: priceIdx, action: 'SELL', price: closes[priceIdx], qty: sellQty });
                    }
                    const currentValue = cash + holdings * closes[priceIdx];
                    peakValue = Math.max(peakValue, currentValue);
                    const dd = (peakValue - currentValue) / peakValue * 100;
                    maxDrawdown = Math.max(maxDrawdown, dd);
                }
            }
            else {
                return `Unknown strategy "${strategy}". Use: dca, momentum, or mean-reversion.`;
            }
            // Final value
            const finalPrice = closes[closes.length - 1];
            const finalValue = cash + holdings * finalPrice;
            const totalReturn = ((finalValue - investment) / investment) * 100;
            const buyHoldReturn = ((finalPrice - closes[0]) / closes[0]) * 100;
            // Win rate
            const sellTrades = trades.filter(t => t.action === 'SELL');
            const buyTrades = trades.filter(t => t.action === 'BUY');
            const avgBuyPrice = buyTrades.length ? buyTrades.reduce((s, t) => s + t.price, 0) / buyTrades.length : 0;
            const wins = sellTrades.filter(t => t.price > avgBuyPrice).length;
            const winRate = sellTrades.length ? (wins / sellTrades.length) * 100 : 0;
            return [
                `## Backtest: ${strategy.toUpperCase()} on ${id.toUpperCase()}`,
                '',
                `**Period**: ${days} days | **Investment**: $${fmt(investment)}`,
                '',
                '### Results',
                '',
                `| Metric | Value |`,
                `|--------|-------|`,
                `| Final Value | $${fmt(finalValue)} |`,
                `| Return | ${totalReturn >= 0 ? '+' : ''}${fmt(totalReturn)}% |`,
                `| Buy & Hold Return | ${buyHoldReturn >= 0 ? '+' : ''}${fmt(buyHoldReturn)}% |`,
                `| Alpha vs Buy & Hold | ${fmt(totalReturn - buyHoldReturn)}% |`,
                `| Max Drawdown | -${fmt(maxDrawdown)}% |`,
                `| Total Trades | ${trades.length} |`,
                `| Win Rate | ${fmt(winRate)}% (${wins}/${sellTrades.length} sells) |`,
                `| Remaining Cash | $${fmt(cash)} |`,
                `| Holdings Value | $${fmt(holdings * finalPrice)} |`,
                '',
                `### Trade Log (last 10)`,
                '',
                '| # | Action | Price | Qty |',
                '|---|--------|-------|-----|',
                ...trades.slice(-10).map((t, i) => `| ${trades.length - 10 + i + 1} | ${t.action} | $${fmt(t.price)} | ${fmt(t.qty, 6)} |`),
                '',
                `*Backtest uses historical data. Past performance ≠ future results.*`,
            ].join('\n');
        },
    });
    // ─── Portfolio Rebalancer ───
    registerTool({
        name: 'portfolio_rebalance',
        description: 'Analyze your paper portfolio and suggest rebalancing trades to match a target allocation. Helps maintain diversification.',
        parameters: {
            targets: { type: 'string', description: 'Target allocation as comma-separated pairs, e.g. "btc:50,eth:30,sol:20" (percentages must sum to 100)', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const portfolio = loadPortfolio();
            const targetStr = String(args.targets);
            // Parse targets
            const targets = {};
            let totalPct = 0;
            for (const pair of targetStr.split(',')) {
                const [sym, pct] = pair.trim().split(':');
                if (!sym || !pct)
                    return `Invalid format. Use: "btc:50,eth:30,sol:20"`;
                targets[sym.toLowerCase()] = Number(pct);
                totalPct += Number(pct);
            }
            if (Math.abs(totalPct - 100) > 1)
                return `Target percentages sum to ${totalPct}%, must be ~100%.`;
            // Get current prices for all target tokens
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
            };
            const ids = Object.keys(targets).map(s => symbolMap[s] || s).join(',');
            const priceData = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
            // Calculate current portfolio value
            let totalValue = portfolio.cash;
            const currentHoldings = {};
            for (const pos of portfolio.positions) {
                const cgId = symbolMap[pos.symbol] || pos.symbol;
                const price = priceData[cgId]?.usd || pos.avgCost;
                const value = pos.quantity * price;
                totalValue += value;
                currentHoldings[pos.symbol] = { qty: pos.quantity, value };
            }
            // Calculate rebalancing trades
            const lines = [
                '## Portfolio Rebalance Plan',
                '',
                `**Total Value**: $${fmt(totalValue)} (Cash: $${fmt(portfolio.cash)})`,
                '',
                '| Token | Current % | Target % | Action | Amount |',
                '|-------|-----------|----------|--------|--------|',
            ];
            const trades = [];
            for (const [sym, targetPct] of Object.entries(targets)) {
                const current = currentHoldings[sym];
                const currentValue = current?.value || 0;
                const currentPct = (currentValue / totalValue) * 100;
                const targetValue = (targetPct / 100) * totalValue;
                const diff = targetValue - currentValue;
                let action = 'HOLD';
                let amount = '';
                if (Math.abs(diff) > totalValue * 0.02) { // Only suggest if >2% off
                    if (diff > 0) {
                        action = 'BUY';
                        amount = `$${fmt(diff)}`;
                        trades.push(`paper_trade buy ${sym} ${fmt(diff, 0)}`);
                    }
                    else {
                        action = 'SELL';
                        const cgId = symbolMap[sym] || sym;
                        const price = priceData[cgId]?.usd || 1;
                        const sellQty = Math.abs(diff) / price;
                        amount = `${fmt(sellQty, 4)} (≈$${fmt(Math.abs(diff))})`;
                        trades.push(`paper_trade sell ${sym} ${fmt(sellQty, 4)}`);
                    }
                }
                lines.push(`| ${sym.toUpperCase()} | ${fmt(currentPct)}% | ${fmt(targetPct)}% | ${action} | ${amount || '—'} |`);
            }
            if (trades.length) {
                lines.push('', '### Suggested Trades', '');
                for (const t of trades)
                    lines.push(`\`${t}\``);
            }
            else {
                lines.push('', '*Portfolio is within 2% of targets. No rebalancing needed.*');
            }
            return lines.join('\n');
        },
    });
    // ─── Trade Reasoning (Introspection) ───
    registerTool({
        name: 'trade_reasoning',
        description: 'Walk through the full reasoning chain for a trade decision. Pulls all available signals (price, technicals, sentiment, news) and explains WHY each signal is bullish or bearish. The "show your work" tool.',
        parameters: {
            symbol: { type: 'string', description: 'Token symbol (e.g. "BTC", "ETH", "SOL")', required: true },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const symbol = String(args.symbol).toLowerCase();
            const symbolMap = {
                btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
            };
            const id = symbolMap[symbol] || symbol;
            const signals = [];
            // 1. Price trend
            try {
                const data = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
                const market = data?.market_data;
                if (market) {
                    const change24h = market.price_change_percentage_24h ?? 0;
                    const change7d = market.price_change_percentage_7d ?? 0;
                    const change30d = market.price_change_percentage_30d ?? 0;
                    const athChangePct = market.ath_change_percentage?.usd ?? 0;
                    let verdict = 'NEUTRAL';
                    let reasoning = '';
                    if (change7d > 10 && change30d > 20) {
                        verdict = 'BULLISH';
                        reasoning = `Strong uptrend: +${fmt(change7d)}% this week, +${fmt(change30d)}% this month. Momentum is sustained, not a single-day spike.`;
                    }
                    else if (change7d < -10 && change30d < -20) {
                        verdict = 'BEARISH';
                        reasoning = `Sustained decline: ${fmt(change7d)}% this week, ${fmt(change30d)}% this month. The selling pressure isn't letting up.`;
                    }
                    else if (change24h > 5 && change7d < 0) {
                        verdict = 'NEUTRAL';
                        reasoning = `Today's +${fmt(change24h)}% looks bullish, but the weekly trend is still ${fmt(change7d)}%. This could be a dead cat bounce or a reversal — need more confirmation.`;
                    }
                    else if (Math.abs(change7d) < 3) {
                        verdict = 'NEUTRAL';
                        reasoning = `Consolidating. Only ${fmt(change7d)}% movement this week. The market is deciding. Wait for a breakout in either direction.`;
                    }
                    else {
                        verdict = change7d > 0 ? 'BULLISH' : 'BEARISH';
                        reasoning = `${change7d > 0 ? 'Up' : 'Down'} ${fmt(Math.abs(change7d))}% this week. ${Math.abs(athChangePct) < 20 ? 'Near all-time high — momentum is strong but risk of correction increases.' : `${fmt(Math.abs(athChangePct))}% from ATH — room to run or further to fall.`}`;
                    }
                    signals.push({ name: 'Price Trend', verdict, reasoning, weight: 2 });
                }
            }
            catch { /* skip */ }
            // 2. Technical indicators
            try {
                const ohlc = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=90`);
                if (ohlc?.length >= 30) {
                    const closes = ohlc.map(d => d[4]);
                    const rsiValues = rsi(closes, 14);
                    const currentRsi = rsiValues[rsiValues.length - 1];
                    const sma20vals = sma(closes, 20);
                    const sma50vals = sma(closes, Math.min(50, Math.floor(closes.length / 2)));
                    const current = closes[closes.length - 1];
                    const currentSma20 = sma20vals[sma20vals.length - 1];
                    const currentSma50 = sma50vals[sma50vals.length - 1];
                    // RSI reasoning
                    let rsiVerdict = 'NEUTRAL';
                    let rsiReasoning = '';
                    if (currentRsi > 70) {
                        rsiVerdict = 'BEARISH';
                        rsiReasoning = `RSI at ${fmt(currentRsi)} — overbought. When RSI exceeds 70, the asset has rallied hard and fast. Historically, pullbacks follow. Not a sell signal alone, but caution is warranted.`;
                    }
                    else if (currentRsi < 30) {
                        rsiVerdict = 'BULLISH';
                        rsiReasoning = `RSI at ${fmt(currentRsi)} — oversold. The selling has been extreme. Oversold RSI often precedes a bounce, especially if the 30d trend was up before this dip.`;
                    }
                    else {
                        rsiReasoning = `RSI at ${fmt(currentRsi)} — neutral zone. No extreme signals. The market isn't overheated or panicked.`;
                    }
                    signals.push({ name: 'RSI (14)', verdict: rsiVerdict, reasoning: rsiReasoning, weight: 1.5 });
                    // Moving average reasoning
                    let maVerdict = 'NEUTRAL';
                    let maReasoning = '';
                    if (current > currentSma20 && currentSma20 > currentSma50) {
                        maVerdict = 'BULLISH';
                        maReasoning = `Price ($${fmt(current)}) > SMA20 ($${fmt(currentSma20)}) > SMA50 ($${fmt(currentSma50)}). This is a textbook uptrend structure. Each moving average is stacked above the longer one — the trend is intact.`;
                    }
                    else if (current < currentSma20 && currentSma20 < currentSma50) {
                        maVerdict = 'BEARISH';
                        maReasoning = `Price ($${fmt(current)}) < SMA20 ($${fmt(currentSma20)}) < SMA50 ($${fmt(currentSma50)}). Downtrend structure. Price is below all moving averages — sellers are in control.`;
                    }
                    else {
                        maReasoning = `Mixed signals. Price is ${current > currentSma20 ? 'above' : 'below'} the 20-day MA but ${current > currentSma50 ? 'above' : 'below'} the 50-day. The trend is transitioning — could go either way.`;
                    }
                    signals.push({ name: 'Moving Averages', verdict: maVerdict, reasoning: maReasoning, weight: 1.5 });
                    // Bollinger reasoning
                    const bb = bollingerBands(closes, 20);
                    const bbUpper = bb.upper[bb.upper.length - 1];
                    const bbLower = bb.lower[bb.lower.length - 1];
                    let bbVerdict = 'NEUTRAL';
                    let bbReasoning = '';
                    if (current > bbUpper) {
                        bbVerdict = 'BEARISH';
                        bbReasoning = `Price above the upper Bollinger Band ($${fmt(bbUpper)}). The asset is trading beyond 2 standard deviations from the mean — statistically, it tends to revert. But in strong trends, prices can "ride the band" for weeks.`;
                    }
                    else if (current < bbLower) {
                        bbVerdict = 'BULLISH';
                        bbReasoning = `Price below the lower Bollinger Band ($${fmt(bbLower)}). This is a statistical extreme — price is more than 2 standard deviations below the mean. Mean reversion is likely, but confirm with volume.`;
                    }
                    else {
                        const position = ((current - bbLower) / (bbUpper - bbLower)) * 100;
                        bbReasoning = `Price at ${fmt(position)}% of the Bollinger range. ${position > 70 ? 'Approaching the upper band — watch for resistance.' : position < 30 ? 'Near the lower band — potential support.' : 'Middle of the range — no extremes.'}`;
                    }
                    signals.push({ name: 'Bollinger Bands', verdict: bbVerdict, reasoning: bbReasoning, weight: 1 });
                }
            }
            catch { /* skip */ }
            // 3. Fear & Greed
            try {
                const fg = await fetchJSON('https://api.alternative.me/fng/?limit=1');
                if (fg.data?.[0]) {
                    const value = Number(fg.data[0].value);
                    const label = fg.data[0].value_classification;
                    let verdict = 'NEUTRAL';
                    let reasoning = '';
                    if (value <= 25) {
                        verdict = 'BULLISH';
                        reasoning = `Fear & Greed at ${value} (${label}). Warren Buffett's rule: "Be greedy when others are fearful." Extreme fear often marks bottoms — but fear can persist longer than expected.`;
                    }
                    else if (value >= 75) {
                        verdict = 'BEARISH';
                        reasoning = `Fear & Greed at ${value} (${label}). "Be fearful when others are greedy." Euphoria is high — this is when smart money starts taking profits. Doesn't mean crash is imminent, but risk is elevated.`;
                    }
                    else {
                        reasoning = `Fear & Greed at ${value} (${label}). Neither extreme. The market is rational right now — decisions should be based on fundamentals and technicals, not crowd psychology.`;
                    }
                    signals.push({ name: 'Fear & Greed', verdict, reasoning, weight: 1 });
                }
            }
            catch { /* skip */ }
            if (!signals.length)
                return `Could not gather signals for "${symbol}". Check the symbol and try again.`;
            // Synthesize
            let weightedBullish = 0;
            let weightedBearish = 0;
            let totalWeight = 0;
            for (const s of signals) {
                totalWeight += s.weight;
                if (s.verdict === 'BULLISH')
                    weightedBullish += s.weight;
                if (s.verdict === 'BEARISH')
                    weightedBearish += s.weight;
            }
            const bullishPct = Math.round((weightedBullish / totalWeight) * 100);
            const bearishPct = Math.round((weightedBearish / totalWeight) * 100);
            const neutralPct = 100 - bullishPct - bearishPct;
            const overall = bullishPct > bearishPct + 15 ? 'BULLISH'
                : bearishPct > bullishPct + 15 ? 'BEARISH'
                    : 'NEUTRAL';
            const lines = [
                `## Trade Reasoning: ${symbol.toUpperCase()}`,
                '',
                `### Verdict: **${overall}** (${bullishPct}% bullish / ${bearishPct}% bearish / ${neutralPct}% neutral)`,
                '',
            ];
            for (const s of signals) {
                const icon = s.verdict === 'BULLISH' ? '🟢' : s.verdict === 'BEARISH' ? '🔴' : '⚪';
                lines.push(`### ${icon} ${s.name}: ${s.verdict}`);
                lines.push('');
                lines.push(s.reasoning);
                lines.push('');
            }
            lines.push('---');
            lines.push('');
            if (overall === 'BULLISH') {
                lines.push(`**What this means**: The majority of signals point up. If you\'re looking to enter, this is a favorable setup — but always use a stop loss. Consider a staged entry (buy 50% now, 50% on a dip).`);
            }
            else if (overall === 'BEARISH') {
                lines.push(`**What this means**: More signals point down than up. If you\'re holding, consider tightening your stop loss. If you\'re looking to enter, wait for a clearer signal — catching a falling knife is expensive.`);
            }
            else {
                lines.push(`**What this means**: Signals are mixed. The market hasn\'t decided yet. This is a wait-and-see moment. Set price alerts at key levels and let the market come to you.`);
            }
            lines.push('');
            lines.push(`*${signals.length} signals analyzed. Weighted by reliability. Not financial advice.*`);
            return lines.join('\n');
        },
    });
    // ─── Price Alerts ───
    registerTool({
        name: 'price_alert',
        description: 'Set, check, or clear price alerts for crypto tokens. Alerts are stored locally and checked whenever you run this tool.',
        parameters: {
            action: { type: 'string', description: '"set", "check", "list", or "clear"', required: true },
            symbol: { type: 'string', description: 'Token symbol (for set/clear)' },
            above: { type: 'number', description: 'Alert when price goes above this (for set)' },
            below: { type: 'number', description: 'Alert when price goes below this (for set)' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const alertPath = join(homedir(), '.kbot', 'price-alerts.json');
            const loadAlerts = () => {
                if (!existsSync(alertPath))
                    return [];
                try {
                    return JSON.parse(readFileSync(alertPath, 'utf-8'));
                }
                catch {
                    return [];
                }
            };
            const saveAlerts = (a) => {
                if (!existsSync(join(homedir(), '.kbot')))
                    mkdirSync(join(homedir(), '.kbot'), { recursive: true });
                writeFileSync(alertPath, JSON.stringify(a, null, 2));
            };
            if (action === 'set') {
                const symbol = String(args.symbol || '').toLowerCase();
                if (!symbol)
                    return 'Error: symbol required.';
                const above = args.above ? Number(args.above) : undefined;
                const below = args.below ? Number(args.below) : undefined;
                if (!above && !below)
                    return 'Error: set at least one of "above" or "below".';
                const alerts = loadAlerts();
                alerts.push({ symbol, above, below, createdAt: new Date().toISOString() });
                saveAlerts(alerts);
                const parts = [];
                if (above)
                    parts.push(`above $${fmt(above)}`);
                if (below)
                    parts.push(`below $${fmt(below)}`);
                return `**Alert set**: ${symbol.toUpperCase()} — trigger when price goes ${parts.join(' or ')}.`;
            }
            if (action === 'list') {
                const alerts = loadAlerts();
                if (!alerts.length)
                    return 'No active alerts. Use `price_alert set` to create one.';
                const lines = ['## Active Price Alerts', '', '| # | Token | Above | Below | Set |', '|---|-------|-------|-------|-----|'];
                alerts.forEach((a, i) => {
                    lines.push(`| ${i + 1} | ${a.symbol.toUpperCase()} | ${a.above ? `$${fmt(a.above)}` : '—'} | ${a.below ? `$${fmt(a.below)}` : '—'} | ${a.createdAt.split('T')[0]} |`);
                });
                return lines.join('\n');
            }
            if (action === 'clear') {
                const symbol = String(args.symbol || '').toLowerCase();
                const alerts = loadAlerts();
                if (symbol) {
                    const filtered = alerts.filter(a => a.symbol !== symbol);
                    saveAlerts(filtered);
                    return `Cleared ${alerts.length - filtered.length} alert(s) for ${symbol.toUpperCase()}.`;
                }
                saveAlerts([]);
                return `Cleared all ${alerts.length} alert(s).`;
            }
            if (action === 'check') {
                const alerts = loadAlerts();
                if (!alerts.length)
                    return 'No alerts to check.';
                // Get all unique symbols
                const symbols = [...new Set(alerts.map(a => a.symbol))];
                const symbolMap = {
                    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
                    ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
                };
                const ids = symbols.map(s => symbolMap[s] || s).join(',');
                const priceData = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
                const triggered = [];
                const remaining = [];
                for (const alert of alerts) {
                    const cgId = symbolMap[alert.symbol] || alert.symbol;
                    const price = priceData[cgId]?.usd;
                    if (!price) {
                        remaining.push(alert);
                        continue;
                    }
                    let fired = false;
                    if (alert.above && price >= alert.above) {
                        triggered.push(`**${alert.symbol.toUpperCase()}** hit $${fmt(price)} (above $${fmt(alert.above)})`);
                        fired = true;
                    }
                    if (alert.below && price <= alert.below) {
                        triggered.push(`**${alert.symbol.toUpperCase()}** hit $${fmt(price)} (below $${fmt(alert.below)})`);
                        fired = true;
                    }
                    if (!fired)
                        remaining.push(alert);
                }
                saveAlerts(remaining); // Remove triggered alerts
                if (triggered.length) {
                    return ['## 🔔 Triggered Alerts', '', ...triggered, '', `${remaining.length} alert(s) still active.`].join('\n');
                }
                return `No alerts triggered. ${remaining.length} alert(s) still active. All prices within thresholds.`;
            }
            return 'Unknown action. Use: set, check, list, or clear.';
        },
    });
}
//# sourceMappingURL=finance.js.map
// kbot Financial Analysis Pipeline — Multi-agent coordinated market intelligence
// Inspired by TradingAgents (multi-perspective analysis with specialist roles).
// Uses free APIs: Yahoo Finance, CoinGecko, DuckDuckGo, Google News RSS.
// No premium data feeds required — all real-time data via web search + public APIs.
//
// Three tools:
//   1. market_analysis  — Deep multi-perspective analysis of a single ticker/topic
//   2. portfolio_review — Portfolio-wide risk, allocation, and rebalancing analysis
//   3. market_briefing  — Quick morning market summary with index moves + news
import { registerTool } from './index.js';
// ── Shared Helpers ──
async function fetchJSON(url, timeout = 12_000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'KBot/3.61 (Financial Analysis)' },
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
}
async function fetchText(url, timeout = 10_000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'KBot/3.61 (Financial Analysis)' },
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.text();
}
function fmt(n, decimals = 2) {
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function pct(n) {
    return `${n >= 0 ? '+' : ''}${fmt(n)}%`;
}
// ── Technical Analysis Primitives ──
function sma(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
}
function ema(data, period) {
    if (!data.length)
        return [];
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
function standardDeviation(data) {
    if (data.length < 2)
        return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (data.length - 1);
    return Math.sqrt(variance);
}
function dailyReturns(closes) {
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return returns;
}
function annualizedVolatility(closes) {
    const returns = dailyReturns(closes);
    if (returns.length < 2)
        return 0;
    return standardDeviation(returns) * Math.sqrt(252) * 100; // annualized, as %
}
function maxDrawdown(closes) {
    let peak = closes[0];
    let maxDd = 0;
    for (const price of closes) {
        if (price > peak)
            peak = price;
        const dd = (peak - price) / peak;
        if (dd > maxDd)
            maxDd = dd;
    }
    return maxDd * 100; // as %
}
function sharpeProxy(closes, riskFreeRate = 0.05) {
    const returns = dailyReturns(closes);
    if (returns.length < 10)
        return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const annualReturn = avgReturn * 252;
    const vol = standardDeviation(returns) * Math.sqrt(252);
    if (vol === 0)
        return 0;
    return (annualReturn - riskFreeRate) / vol;
}
// ── Yahoo Finance Helpers ──
async function yahooQuote(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const data = await fetchJSON(url);
        const result = data.chart?.result?.[0];
        return result || null;
    }
    catch {
        return null;
    }
}
async function yahooHistory(symbol, range, interval) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
        const data = await fetchJSON(url);
        return data.chart?.result?.[0] || null;
    }
    catch {
        return null;
    }
}
function extractCloses(result) {
    const quotes = result.indicators?.quote?.[0];
    if (!quotes?.close)
        return [];
    return quotes.close.filter((c) => c != null);
}
function extractVolumes(result) {
    const quotes = result.indicators?.quote?.[0];
    if (!quotes?.volume)
        return [];
    return quotes.volume.filter((v) => v != null);
}
// ── News Search Helper ──
async function searchNews(query, maxResults = 5) {
    const results = [];
    // DuckDuckGo instant answers
    try {
        const encoded = encodeURIComponent(query);
        const data = await fetchJSON(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, 8_000);
        if (data.AbstractText) {
            results.push(String(data.AbstractText).slice(0, 300));
        }
        const topics = data.RelatedTopics;
        if (topics?.length) {
            for (const topic of topics.slice(0, 3)) {
                if (topic.Text)
                    results.push(topic.Text.slice(0, 200));
            }
        }
    }
    catch { /* continue */ }
    // Google News RSS feed for financial news
    try {
        const encoded = encodeURIComponent(query);
        const xml = await fetchText(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`, 8_000);
        const titleMatches = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g) || [];
        for (const match of titleMatches.slice(1, maxResults + 1)) { // skip feed title
            const headline = match.replace(/<title><!\[CDATA\[/, '').replace(/\]\]><\/title>/, '');
            if (headline)
                results.push(headline);
        }
    }
    catch { /* continue */ }
    return results.slice(0, maxResults);
}
// ── Reddit Sentiment Helper ──
async function redditSentiment(query) {
    const BULLISH = new Set([
        'bullish', 'moon', 'pump', 'buy', 'long', 'breakout', 'rally', 'surge',
        'gains', 'undervalued', 'uptrend', 'bounce', 'recovery', 'soaring',
        'fomo', 'accumulate', 'hodl', 'diamond',
    ]);
    const BEARISH = new Set([
        'bearish', 'crash', 'dump', 'sell', 'short', 'breakdown', 'plunge', 'tank',
        'overvalued', 'bubble', 'correction', 'decline', 'fear', 'panic',
        'liquidation', 'scam', 'fraud',
    ]);
    let allText = '';
    let postCount = 0;
    const subreddits = ['wallstreetbets', 'stocks', 'investing'];
    for (const sub of subreddits) {
        try {
            const data = await fetchJSON(`https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=10&t=week`, 8_000);
            const posts = data.data?.children || [];
            for (const post of posts) {
                const title = post.data?.title || '';
                const selftext = post.data?.selftext || '';
                allText += ` ${title} ${selftext}`;
                postCount++;
            }
        }
        catch { /* continue */ }
    }
    const words = allText.toLowerCase().split(/\W+/);
    let bullish = 0;
    let bearish = 0;
    for (const w of words) {
        if (BULLISH.has(w))
            bullish++;
        if (BEARISH.has(w))
            bearish++;
    }
    const total = bullish + bearish;
    const score = total === 0 ? 0 : (bullish - bearish) / total;
    const label = score > 0.2 ? 'BULLISH' : score < -0.2 ? 'BEARISH' : 'NEUTRAL';
    const summary = total === 0
        ? 'No significant sentiment signals found'
        : `${bullish} bullish vs ${bearish} bearish signals across ${postCount} posts`;
    return { score, label, posts: postCount, summary };
}
// ── Sector Classification ──
const SECTOR_MAP = {
    // Tech
    AAPL: { sector: 'Technology', geography: 'US', divYield: 0.5 },
    MSFT: { sector: 'Technology', geography: 'US', divYield: 0.7 },
    GOOGL: { sector: 'Technology', geography: 'US' },
    GOOG: { sector: 'Technology', geography: 'US' },
    META: { sector: 'Technology', geography: 'US', divYield: 0.4 },
    AMZN: { sector: 'Technology', geography: 'US' },
    NVDA: { sector: 'Technology', geography: 'US', divYield: 0.03 },
    TSM: { sector: 'Technology', geography: 'Taiwan', divYield: 1.5 },
    AVGO: { sector: 'Technology', geography: 'US', divYield: 1.3 },
    AMD: { sector: 'Technology', geography: 'US' },
    CRM: { sector: 'Technology', geography: 'US' },
    ORCL: { sector: 'Technology', geography: 'US', divYield: 1.2 },
    INTC: { sector: 'Technology', geography: 'US', divYield: 1.5 },
    // Finance
    JPM: { sector: 'Finance', geography: 'US', divYield: 2.3 },
    BAC: { sector: 'Finance', geography: 'US', divYield: 2.5 },
    WFC: { sector: 'Finance', geography: 'US', divYield: 2.8 },
    GS: { sector: 'Finance', geography: 'US', divYield: 2.5 },
    V: { sector: 'Finance', geography: 'US', divYield: 0.7 },
    MA: { sector: 'Finance', geography: 'US', divYield: 0.5 },
    BLK: { sector: 'Finance', geography: 'US', divYield: 2.2 },
    // Healthcare
    UNH: { sector: 'Healthcare', geography: 'US', divYield: 1.4 },
    JNJ: { sector: 'Healthcare', geography: 'US', divYield: 3.0 },
    LLY: { sector: 'Healthcare', geography: 'US', divYield: 0.7 },
    PFE: { sector: 'Healthcare', geography: 'US', divYield: 5.5 },
    ABBV: { sector: 'Healthcare', geography: 'US', divYield: 3.5 },
    MRK: { sector: 'Healthcare', geography: 'US', divYield: 2.5 },
    // Energy
    XOM: { sector: 'Energy', geography: 'US', divYield: 3.3 },
    CVX: { sector: 'Energy', geography: 'US', divYield: 4.0 },
    COP: { sector: 'Energy', geography: 'US', divYield: 2.8 },
    // Consumer
    PG: { sector: 'Consumer Staples', geography: 'US', divYield: 2.4 },
    KO: { sector: 'Consumer Staples', geography: 'US', divYield: 3.0 },
    PEP: { sector: 'Consumer Staples', geography: 'US', divYield: 2.7 },
    MCD: { sector: 'Consumer Staples', geography: 'US', divYield: 2.2 },
    WMT: { sector: 'Consumer Staples', geography: 'US', divYield: 1.4 },
    COST: { sector: 'Consumer Staples', geography: 'US', divYield: 0.6 },
    TSLA: { sector: 'Consumer Discretionary', geography: 'US' },
    // Industrial
    BA: { sector: 'Industrials', geography: 'US' },
    CAT: { sector: 'Industrials', geography: 'US', divYield: 1.6 },
    LMT: { sector: 'Industrials', geography: 'US', divYield: 2.7 },
    GE: { sector: 'Industrials', geography: 'US', divYield: 0.6 },
    // Real Estate / REITs
    O: { sector: 'Real Estate', geography: 'US', divYield: 5.5 },
    AMT: { sector: 'Real Estate', geography: 'US', divYield: 3.0 },
    // Utilities
    NEE: { sector: 'Utilities', geography: 'US', divYield: 2.8 },
    DUK: { sector: 'Utilities', geography: 'US', divYield: 3.8 },
    // Telecom
    VZ: { sector: 'Telecom', geography: 'US', divYield: 6.5 },
    T: { sector: 'Telecom', geography: 'US', divYield: 6.0 },
    // Materials
    LIN: { sector: 'Materials', geography: 'US', divYield: 1.2 },
    // ETFs — broad
    SPY: { sector: 'ETF - US Equity', geography: 'US', divYield: 1.3 },
    QQQ: { sector: 'ETF - Tech', geography: 'US', divYield: 0.6 },
    IWM: { sector: 'ETF - Small Cap', geography: 'US', divYield: 1.2 },
    DIA: { sector: 'ETF - Dow Jones', geography: 'US', divYield: 1.6 },
    VTI: { sector: 'ETF - Total Market', geography: 'US', divYield: 1.3 },
    VOO: { sector: 'ETF - S&P 500', geography: 'US', divYield: 1.3 },
    VEA: { sector: 'ETF - Intl Developed', geography: 'International', divYield: 3.1 },
    VWO: { sector: 'ETF - Emerging Markets', geography: 'Emerging Markets', divYield: 3.4 },
    BND: { sector: 'ETF - Bonds', geography: 'US', divYield: 3.5 },
    AGG: { sector: 'ETF - Bonds', geography: 'US', divYield: 3.4 },
    GLD: { sector: 'ETF - Gold', geography: 'Global' },
    TLT: { sector: 'ETF - Long Treasuries', geography: 'US', divYield: 3.8 },
    ARKK: { sector: 'ETF - Innovation', geography: 'US' },
    XLE: { sector: 'ETF - Energy', geography: 'US', divYield: 3.5 },
    XLF: { sector: 'ETF - Financials', geography: 'US', divYield: 1.7 },
    XLK: { sector: 'ETF - Technology', geography: 'US', divYield: 0.7 },
    XLV: { sector: 'ETF - Healthcare', geography: 'US', divYield: 1.5 },
    SCHD: { sector: 'ETF - Dividend Growth', geography: 'US', divYield: 3.5 },
};
function lookupSector(ticker) {
    const info = SECTOR_MAP[ticker.toUpperCase()];
    if (info)
        return { sector: info.sector, geography: info.geography, divYield: info.divYield ?? 0 };
    // Fallback heuristic
    if (ticker.startsWith('^'))
        return { sector: 'Index', geography: 'US', divYield: 0 };
    return { sector: 'Unknown', geography: 'Unknown', divYield: 0 };
}
// ── MAGI (Modified Adjusted Gross Income) Estimator ──
// Important for ACA (Affordable Care Act) subsidy calculations.
// MAGI includes: wages, interest, dividends, capital gains, rental income, etc.
function estimateMAGIImpact(holdings) {
    let totalDividends = 0;
    const notes = [];
    for (const h of holdings) {
        const info = lookupSector(h.ticker);
        const divIncome = h.totalValue * (info.divYield / 100);
        totalDividends += divIncome;
        if (info.divYield > 3) {
            notes.push(`${h.ticker}: High dividend yield (${fmt(info.divYield)}%) adds ~$${fmt(divIncome, 0)} to MAGI`);
        }
    }
    if (totalDividends > 0) {
        notes.push(`Total estimated dividend income: $${fmt(totalDividends, 0)}/year`);
        notes.push('Note: Qualified dividends are taxed at capital gains rates, but ALL dividends count toward MAGI');
        notes.push('ACA subsidy cliff: MAGI > 400% FPL eliminates premium tax credits');
    }
    return { estimatedDividends: totalDividends, notes };
}
// ════════════════════════════════════════
// TOOL 1: market_analysis
// ════════════════════════════════════════
async function runMarketAnalysis(ticker) {
    const symbol = ticker.toUpperCase();
    const lines = [`# Market Analysis: ${symbol}`, '', `*Generated ${new Date().toISOString().split('T')[0]} by kbot Financial Analysis Pipeline*`, ''];
    // ── Agent 1: Fundamentals ──
    lines.push('## 1. Fundamentals');
    const quoteData = await yahooQuote(symbol);
    if (quoteData) {
        const meta = quoteData.meta || {};
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePct = prevClose ? (change / prevClose) * 100 : 0;
        lines.push(`- **Price**: $${fmt(price)}`, `- **Change**: ${pct(changePct)} ($${fmt(Math.abs(change))})`, `- **Exchange**: ${meta.exchangeName || 'N/A'}`, `- **Currency**: ${meta.currency || 'USD'}`);
        const sectorInfo = lookupSector(symbol);
        if (sectorInfo.sector !== 'Unknown') {
            lines.push(`- **Sector**: ${sectorInfo.sector}`);
            if (sectorInfo.divYield > 0)
                lines.push(`- **Est. Dividend Yield**: ${fmt(sectorInfo.divYield)}%`);
        }
    }
    else {
        lines.push('*Could not fetch fundamental data. Ticker may be invalid or API unavailable.*');
    }
    lines.push('');
    // ── Agent 2: Technical Analysis ──
    lines.push('## 2. Technical Analysis');
    const histData = await yahooHistory(symbol, '6mo', '1d');
    const closes = histData ? extractCloses(histData) : [];
    const volumes = histData ? extractVolumes(histData) : [];
    if (closes.length >= 30) {
        const current = closes[closes.length - 1];
        // Moving averages
        const sma20vals = sma(closes, 20);
        const sma50vals = sma(closes, Math.min(50, Math.floor(closes.length * 0.8)));
        const currentSma20 = sma20vals[sma20vals.length - 1];
        const currentSma50 = sma50vals[sma50vals.length - 1];
        // RSI
        const rsiVals = rsi(closes, 14);
        const currentRsi = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1] : 50;
        const rsiSignal = currentRsi > 70 ? 'OVERBOUGHT' : currentRsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
        // MACD
        const ema12vals = ema(closes, 12);
        const ema26vals = ema(closes, 26);
        const macdLine = ema12vals[ema12vals.length - 1] - ema26vals[ema26vals.length - 1];
        const macdSignal = macdLine > 0 ? 'BULLISH' : 'BEARISH';
        // Trend
        const trend = current > currentSma20 && currentSma20 > currentSma50 ? 'UPTREND'
            : current < currentSma20 && currentSma20 < currentSma50 ? 'DOWNTREND'
                : 'SIDEWAYS';
        // Volatility
        const vol = annualizedVolatility(closes);
        const mdd = maxDrawdown(closes);
        const sharpe = sharpeProxy(closes);
        // Volume trend
        const recentVol = volumes.slice(-5);
        const olderVol = volumes.slice(-20, -5);
        const avgRecent = recentVol.length ? recentVol.reduce((a, b) => a + b, 0) / recentVol.length : 0;
        const avgOlder = olderVol.length ? olderVol.reduce((a, b) => a + b, 0) / olderVol.length : 0;
        const volTrend = avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder * 100) : 0;
        lines.push(`| Indicator | Value | Signal |`, `|-----------|-------|--------|`, `| Trend | — | **${trend}** |`, `| RSI (14) | ${fmt(currentRsi)} | ${rsiSignal} |`, `| SMA (20) | $${fmt(currentSma20)} | Price ${current > currentSma20 ? 'above' : 'below'} |`, `| SMA (50) | $${fmt(currentSma50)} | Price ${current > currentSma50 ? 'above' : 'below'} |`, `| MACD | ${fmt(macdLine, 4)} | ${macdSignal} |`, `| Volatility (ann.) | ${fmt(vol)}% | ${vol > 40 ? 'HIGH' : vol > 20 ? 'MODERATE' : 'LOW'} |`, `| Max Drawdown (6mo) | ${fmt(mdd)}% | ${mdd > 20 ? 'SEVERE' : mdd > 10 ? 'NOTABLE' : 'MILD'} |`, `| Sharpe Ratio (est.) | ${fmt(sharpe)} | ${sharpe > 1 ? 'GOOD' : sharpe > 0 ? 'FAIR' : 'POOR'} |`, `| Volume Trend (5d vs 20d) | ${pct(volTrend)} | ${volTrend > 20 ? 'RISING' : volTrend < -20 ? 'FALLING' : 'STABLE'} |`);
        // Signal tally
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
        if (trend === 'UPTREND')
            bullish++;
        if (trend === 'DOWNTREND')
            bearish++;
        lines.push('', `**Technical Signal**: ${bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'NEUTRAL'} (${bullish} bull / ${bearish} bear)`);
    }
    else {
        lines.push('*Insufficient price history for technical analysis (need >= 30 data points).*');
    }
    lines.push('');
    // ── Agent 3: Sentiment ──
    lines.push('## 3. Social Sentiment');
    const sentiment = await redditSentiment(symbol);
    lines.push(`- **Reddit Signal**: **${sentiment.label}** (score: ${fmt(sentiment.score)})`, `- **Posts Scanned**: ${sentiment.posts}`, `- **Summary**: ${sentiment.summary}`);
    lines.push('');
    // ── Agent 4: News ──
    lines.push('## 4. Recent News');
    const newsItems = await searchNews(`${symbol} stock market news`, 6);
    if (newsItems.length > 0) {
        for (const item of newsItems) {
            lines.push(`- ${item}`);
        }
    }
    else {
        lines.push('*No recent news found via free sources.*');
    }
    lines.push('');
    // ── Agent 5: Risk Assessment ──
    lines.push('## 5. Risk Assessment');
    if (closes.length >= 20) {
        const vol = annualizedVolatility(closes);
        const mdd = maxDrawdown(closes);
        const beta = vol / 16; // rough approximation (S&P ~16% vol)
        // Risk score 1-10 based on volatility + drawdown
        const volScore = Math.min(5, vol / 10); // 0-5 from vol
        const ddScore = Math.min(5, mdd / 10); // 0-5 from drawdown
        const riskScore = Math.min(10, Math.round(volScore + ddScore));
        lines.push(`| Risk Factor | Value | Rating |`, `|-------------|-------|--------|`, `| Annualized Volatility | ${fmt(vol)}% | ${vol > 40 ? 'HIGH' : vol > 20 ? 'MODERATE' : 'LOW'} |`, `| Max Drawdown (6mo) | ${fmt(mdd)}% | ${mdd > 20 ? 'HIGH' : mdd > 10 ? 'MODERATE' : 'LOW'} |`, `| Beta (est.) | ${fmt(beta)} | ${beta > 1.5 ? 'HIGH' : beta > 0.8 ? 'MARKET' : 'LOW'} |`, '', `**Overall Risk Score**: ${riskScore}/10 (${riskScore >= 7 ? 'High Risk' : riskScore >= 4 ? 'Moderate Risk' : 'Low Risk'})`);
    }
    else {
        lines.push('*Insufficient data for risk assessment.*');
    }
    lines.push('');
    // ── Agent 6: Synthesis — Bull/Bear Case + Confidence ──
    lines.push('## 6. Synthesis');
    // Compute confidence from signal agreement
    let bullSignals = 0;
    let bearSignals = 0;
    let totalSignals = 0;
    // Technical signals
    if (closes.length >= 30) {
        const current = closes[closes.length - 1];
        const sma20v = sma(closes, 20);
        const sma50v = sma(closes, Math.min(50, Math.floor(closes.length * 0.8)));
        if (current > sma20v[sma20v.length - 1])
            bullSignals++;
        else
            bearSignals++;
        if (current > sma50v[sma50v.length - 1])
            bullSignals++;
        else
            bearSignals++;
        totalSignals += 2;
        const rsiV = rsi(closes, 14);
        const lastRsi = rsiV[rsiV.length - 1] ?? 50;
        if (lastRsi < 40)
            bullSignals++;
        if (lastRsi > 60)
            bearSignals++;
        totalSignals++;
        const ema12v = ema(closes, 12);
        const ema26v = ema(closes, 26);
        if (ema12v[ema12v.length - 1] > ema26v[ema26v.length - 1])
            bullSignals++;
        else
            bearSignals++;
        totalSignals++;
    }
    // Sentiment signal
    if (sentiment.score > 0.15)
        bullSignals++;
    if (sentiment.score < -0.15)
        bearSignals++;
    totalSignals++;
    const dominant = bullSignals > bearSignals ? 'BULLISH' : bearSignals > bullSignals ? 'BEARISH' : 'NEUTRAL';
    const agreement = totalSignals > 0 ? Math.max(bullSignals, bearSignals) / totalSignals : 0;
    const confidence = Math.round(agreement * 100);
    lines.push(`**Overall Signal**: **${dominant}** (${confidence}% confidence)`, '');
    // Bull case
    const bullPoints = [];
    if (closes.length >= 30) {
        const current = closes[closes.length - 1];
        const sma20v = sma(closes, 20);
        if (current > sma20v[sma20v.length - 1])
            bullPoints.push('Trading above 20-day SMA');
        const rsiV = rsi(closes, 14);
        const lastRsi = rsiV[rsiV.length - 1] ?? 50;
        if (lastRsi < 40)
            bullPoints.push('RSI in oversold territory — potential bounce');
        if (annualizedVolatility(closes) < 25)
            bullPoints.push('Low volatility suggests stability');
    }
    if (sentiment.label === 'BULLISH')
        bullPoints.push('Positive social sentiment on Reddit');
    if (bullPoints.length === 0)
        bullPoints.push('Limited bullish signals at this time');
    lines.push('### Bull Case');
    for (const p of bullPoints)
        lines.push(`- ${p}`);
    lines.push('');
    // Bear case
    const bearPoints = [];
    if (closes.length >= 30) {
        const current = closes[closes.length - 1];
        const sma50v = sma(closes, Math.min(50, Math.floor(closes.length * 0.8)));
        if (current < sma50v[sma50v.length - 1])
            bearPoints.push('Trading below 50-day SMA');
        const rsiV = rsi(closes, 14);
        const lastRsi = rsiV[rsiV.length - 1] ?? 50;
        if (lastRsi > 60)
            bearPoints.push('RSI trending toward overbought');
        if (maxDrawdown(closes) > 15)
            bearPoints.push(`Recent drawdown of ${fmt(maxDrawdown(closes))}%`);
        if (annualizedVolatility(closes) > 35)
            bearPoints.push('Elevated volatility increases downside risk');
    }
    if (sentiment.label === 'BEARISH')
        bearPoints.push('Negative social sentiment on Reddit');
    if (bearPoints.length === 0)
        bearPoints.push('Limited bearish signals at this time');
    lines.push('### Bear Case');
    for (const p of bearPoints)
        lines.push(`- ${p}`);
    lines.push('');
    lines.push('---', '*This analysis aggregates 5 specialist perspectives (fundamentals, technical, sentiment, news, risk) into a unified view. Not financial advice.*');
    return lines.join('\n');
}
async function runPortfolioReview(holdings, totalValue) {
    const portfolioValue = totalValue || 100_000; // default to $100K for calculations
    const lines = [
        '# Portfolio Review',
        '',
        `*Generated ${new Date().toISOString().split('T')[0]} by kbot Financial Analysis Pipeline*`,
        `*Portfolio Value: $${fmt(portfolioValue, 0)}*`,
        '',
    ];
    // Normalize weights
    const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
    const normalized = holdings.map(h => ({
        ...h,
        weight: (h.weight / totalWeight) * 100,
        targetWeight: h.targetWeight != null ? h.targetWeight : undefined,
        value: (h.weight / totalWeight) * portfolioValue,
    }));
    // ── Section 1: Holdings Overview ──
    lines.push('## 1. Holdings Overview');
    lines.push('', '| Ticker | Weight | Value | Sector | Geography |', '|--------|--------|-------|--------|-----------|');
    for (const h of normalized.sort((a, b) => b.weight - a.weight)) {
        const info = lookupSector(h.ticker);
        lines.push(`| ${h.ticker} | ${fmt(h.weight)}% | $${fmt(h.value, 0)} | ${info.sector} | ${info.geography} |`);
    }
    lines.push('');
    // ── Section 2: Sector Allocation ──
    lines.push('## 2. Sector Allocation');
    const sectorWeights = new Map();
    const geoWeights = new Map();
    for (const h of normalized) {
        const info = lookupSector(h.ticker);
        sectorWeights.set(info.sector, (sectorWeights.get(info.sector) || 0) + h.weight);
        geoWeights.set(info.geography, (geoWeights.get(info.geography) || 0) + h.weight);
    }
    lines.push('', '### By Sector', '');
    const sortedSectors = Array.from(sectorWeights.entries()).sort((a, b) => b[1] - a[1]);
    for (const [sector, weight] of sortedSectors) {
        const bar = '█'.repeat(Math.round(weight / 2));
        lines.push(`- **${sector}**: ${fmt(weight)}% ${bar}`);
    }
    lines.push('', '### By Geography', '');
    const sortedGeo = Array.from(geoWeights.entries()).sort((a, b) => b[1] - a[1]);
    for (const [geo, weight] of sortedGeo) {
        const bar = '█'.repeat(Math.round(weight / 2));
        lines.push(`- **${geo}**: ${fmt(weight)}% ${bar}`);
    }
    lines.push('');
    // ── Section 3: Concentration Risk ──
    lines.push('## 3. Concentration Risk');
    const sortedByWeight = [...normalized].sort((a, b) => b.weight - a.weight);
    const top1 = sortedByWeight[0]?.weight ?? 0;
    const top3 = sortedByWeight.slice(0, 3).reduce((s, h) => s + h.weight, 0);
    const top5 = sortedByWeight.slice(0, 5).reduce((s, h) => s + h.weight, 0);
    // Herfindahl-Hirschman Index
    const hhi = normalized.reduce((sum, h) => sum + (h.weight / 100) ** 2, 0);
    const effectivePositions = hhi > 0 ? 1 / hhi : normalized.length;
    // Concentration score: 1 (diversified) to 10 (concentrated)
    const concScore = Math.min(10, Math.round(hhi * 100));
    lines.push(`| Metric | Value |`, `|--------|-------|`, `| Top 1 holding | ${sortedByWeight[0]?.ticker ?? '?'} at ${fmt(top1)}% |`, `| Top 3 holdings | ${fmt(top3)}% of portfolio |`, `| Top 5 holdings | ${fmt(top5)}% of portfolio |`, `| HHI (Herfindahl) | ${fmt(hhi, 4)} |`, `| Effective # of positions | ${fmt(effectivePositions, 1)} |`, `| **Concentration Score** | **${concScore}/10** (${concScore >= 7 ? 'High' : concScore >= 4 ? 'Moderate' : 'Low'}) |`);
    lines.push('');
    if (top1 > 25)
        lines.push(`> **Warning**: ${sortedByWeight[0]?.ticker} at ${fmt(top1)}% exceeds 25% single-position limit.`, '');
    if (sortedSectors.length > 0 && sortedSectors[0][1] > 50) {
        lines.push(`> **Warning**: ${sortedSectors[0][0]} sector at ${fmt(sortedSectors[0][1])}% — consider diversification.`, '');
    }
    // ── Section 4: Dividend & Income Estimate ──
    lines.push('## 4. Estimated Dividend Income');
    const holdingsForMagi = normalized.map(h => ({
        ticker: h.ticker,
        weight: h.weight,
        totalValue: h.value,
    }));
    let totalDivYield = 0;
    lines.push('', '| Ticker | Weight | Est. Yield | Annual Income |', '|--------|--------|-----------|---------------|');
    for (const h of normalized.sort((a, b) => b.weight - a.weight)) {
        const info = lookupSector(h.ticker);
        const income = h.value * (info.divYield / 100);
        totalDivYield += info.divYield * (h.weight / 100);
        if (info.divYield > 0) {
            lines.push(`| ${h.ticker} | ${fmt(h.weight)}% | ${fmt(info.divYield)}% | $${fmt(income, 0)} |`);
        }
    }
    const totalDivIncome = normalized.reduce((sum, h) => {
        const info = lookupSector(h.ticker);
        return sum + h.value * (info.divYield / 100);
    }, 0);
    lines.push('', `**Portfolio Dividend Yield**: ${fmt(totalDivYield)}%`, `**Estimated Annual Income**: $${fmt(totalDivIncome, 0)}`, `**Estimated Monthly Income**: $${fmt(totalDivIncome / 12, 0)}`);
    lines.push('');
    // ── Section 5: MAGI Impact ──
    lines.push('## 5. MAGI Impact Estimate (ACA-Aware)');
    const magi = estimateMAGIImpact(holdingsForMagi);
    if (magi.notes.length > 0) {
        for (const note of magi.notes) {
            lines.push(`- ${note}`);
        }
        lines.push('', '> **ACA Consideration**: Dividend income adds directly to MAGI. For ACA subsidy', '> optimization, consider holding high-dividend assets in tax-advantaged accounts', '> (IRA, 401k) and using growth stocks in taxable accounts.');
    }
    else {
        lines.push('*No significant dividend income affecting MAGI.*');
    }
    lines.push('');
    // ── Section 6: Rebalancing ──
    lines.push('## 6. Rebalancing Suggestions');
    const hasTargets = normalized.some(h => h.targetWeight != null);
    if (hasTargets) {
        lines.push('', '| Ticker | Current | Target | Drift | Action |', '|--------|---------|--------|-------|--------|');
        for (const h of normalized) {
            if (h.targetWeight == null)
                continue;
            const drift = h.weight - h.targetWeight;
            const action = Math.abs(drift) < 1 ? 'OK'
                : drift > 0 ? `Sell $${fmt(Math.abs(drift / 100) * portfolioValue, 0)}`
                    : `Buy $${fmt(Math.abs(drift / 100) * portfolioValue, 0)}`;
            const flag = Math.abs(drift) > 5 ? ' ⚠' : '';
            lines.push(`| ${h.ticker} | ${fmt(h.weight)}% | ${fmt(h.targetWeight)}% | ${pct(drift)} | ${action}${flag} |`);
        }
    }
    else {
        lines.push('*No target weights specified. General suggestions:*', '');
        if (top1 > 30)
            lines.push(`- **Trim ${sortedByWeight[0]?.ticker}** — ${fmt(top1)}% is heavily concentrated`);
        if (sortedSectors.length > 0 && sortedSectors[0][1] > 50) {
            lines.push(`- **Diversify away from ${sortedSectors[0][0]}** — ${fmt(sortedSectors[0][1])}% sector concentration`);
        }
        if (normalized.length < 10)
            lines.push('- **Add positions** — fewer than 10 holdings increases idiosyncratic risk');
        if (!sortedGeo.some(([geo]) => geo !== 'US' && geo !== 'Unknown')) {
            lines.push('- **Add international exposure** — 100% US concentration adds geographic risk (consider VEA, VWO)');
        }
        const bondWeight = sortedSectors.find(([s]) => s.includes('Bond'))?.[1] ?? 0;
        if (bondWeight === 0) {
            lines.push('- **Consider bonds** — 0% fixed income allocation (BND, AGG, TLT for diversification)');
        }
    }
    lines.push('');
    // ── Section 7: Overall Risk Score ──
    lines.push('## 7. Overall Portfolio Risk Score');
    // Composite risk: concentration + sector risk + no bonds penalty + no intl penalty
    let riskScore = concScore * 0.4; // 40% from concentration
    if (sortedSectors.length > 0 && sortedSectors[0][1] > 50)
        riskScore += 2;
    if (!sortedGeo.some(([geo]) => geo !== 'US' && geo !== 'Unknown'))
        riskScore += 1;
    const bondAlloc = sortedSectors.find(([s]) => s.includes('Bond'))?.[1] ?? 0;
    if (bondAlloc === 0)
        riskScore += 1;
    if (normalized.length < 5)
        riskScore += 2;
    riskScore = Math.min(10, Math.max(1, Math.round(riskScore)));
    const riskLabel = riskScore >= 8 ? 'High Risk — significant concentration/diversification issues'
        : riskScore >= 5 ? 'Moderate Risk — some diversification improvements recommended'
            : 'Low Risk — well-diversified portfolio';
    lines.push(`**Risk Score**: ${riskScore}/10 — ${riskLabel}`, '');
    lines.push('---', '*Portfolio analysis uses reference data for sector classification and dividend yields. Actual yields vary. Not financial advice.*');
    return lines.join('\n');
}
// ════════════════════════════════════════
// TOOL 3: market_briefing
// ════════════════════════════════════════
async function runMarketBriefing() {
    const today = new Date().toISOString().split('T')[0];
    const lines = [
        `# Market Briefing — ${today}`,
        '',
        '*Generated by kbot Financial Analysis Pipeline*',
        '',
    ];
    // ── Major Indices ──
    lines.push('## Major Indices');
    const indices = [
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^IXIC', name: 'NASDAQ Composite' },
        { symbol: '^DJI', name: 'Dow Jones' },
        { symbol: '^RUT', name: 'Russell 2000' },
        { symbol: '^VIX', name: 'VIX (Fear Index)' },
    ];
    lines.push('', '| Index | Price | Change | Signal |', '|-------|-------|--------|--------|');
    for (const idx of indices) {
        try {
            const data = await yahooQuote(idx.symbol);
            if (data) {
                const meta = data.meta || {};
                const price = meta.regularMarketPrice ?? 0;
                const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
                const change = price - prev;
                const changePct = prev ? (change / prev) * 100 : 0;
                const signal = idx.symbol === '^VIX'
                    ? (price > 30 ? 'FEAR' : price > 20 ? 'CAUTION' : 'CALM')
                    : (changePct > 0.5 ? 'BULLISH' : changePct < -0.5 ? 'BEARISH' : 'FLAT');
                lines.push(`| ${idx.name} | ${fmt(price, 0)} | ${pct(changePct)} | ${signal} |`);
            }
        }
        catch {
            lines.push(`| ${idx.name} | — | — | DATA N/A |`);
        }
    }
    lines.push('');
    // ── Notable Movers ──
    lines.push('## Notable Movers');
    // Check a basket of popular stocks for big movers
    const watchlist = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
        'JPM', 'V', 'UNH', 'XOM', 'LLY', 'AVGO', 'AMD', 'CRM',
        'COIN', 'MSTR', 'PLTR', 'RIVN', 'SMCI',
    ];
    const movers = [];
    const batchSize = 5;
    for (let i = 0; i < watchlist.length; i += batchSize) {
        const batch = watchlist.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (sym) => {
            try {
                const data = await yahooQuote(sym);
                if (!data)
                    return null;
                const meta = data.meta || {};
                const price = meta.regularMarketPrice ?? 0;
                const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
                const changePct = prev ? ((price - prev) / prev) * 100 : 0;
                return { symbol: sym, price, changePct };
            }
            catch {
                return null;
            }
        }));
        movers.push(...results.filter((r) => r !== null));
    }
    // Sort by absolute change to find notable movers
    const sorted = movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    const notable = sorted.filter(m => Math.abs(m.changePct) > 1).slice(0, 8);
    if (notable.length > 0) {
        lines.push('', '| Stock | Price | Change | Direction |', '|-------|-------|--------|-----------|');
        for (const m of notable) {
            lines.push(`| ${m.symbol} | $${fmt(m.price)} | ${pct(m.changePct)} | ${m.changePct > 0 ? 'UP' : 'DOWN'} |`);
        }
    }
    else {
        lines.push('*No stocks moved more than 1% today in the watchlist.*');
    }
    lines.push('');
    // ── Crypto Snapshot ──
    lines.push('## Crypto Snapshot');
    try {
        const cryptoData = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', 10_000);
        lines.push('', '| Coin | Price | 24h Change |', '|------|-------|------------|');
        const cryptoMap = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
        for (const [id, data] of Object.entries(cryptoData)) {
            const change = data.usd_24h_change ?? 0;
            lines.push(`| ${cryptoMap[id] || id} | $${fmt(data.usd, data.usd < 10 ? 4 : 0)} | ${pct(change)} |`);
        }
    }
    catch {
        lines.push('*Crypto data unavailable.*');
    }
    lines.push('');
    // ── Market News ──
    lines.push('## Market News');
    const newsItems = await searchNews('stock market economy today', 6);
    if (newsItems.length > 0) {
        for (const item of newsItems) {
            lines.push(`- ${item}`);
        }
    }
    else {
        lines.push('*No market news available via free sources.*');
    }
    lines.push('');
    // ── Market Mood ──
    lines.push('## Market Mood');
    // Derive mood from VIX + index performance
    const sp500 = movers.find(m => false); // indices are separate
    let mood = 'NEUTRAL';
    let moodExplain = 'Mixed signals';
    // Fetch VIX for mood
    try {
        const vixData = await yahooQuote('^VIX');
        if (vixData) {
            const vix = vixData.meta?.regularMarketPrice ?? 20;
            if (vix > 30) {
                mood = 'FEARFUL';
                moodExplain = `VIX at ${fmt(vix)} — elevated fear. Historically a contrarian buy signal.`;
            }
            else if (vix > 20) {
                mood = 'CAUTIOUS';
                moodExplain = `VIX at ${fmt(vix)} — above-average uncertainty.`;
            }
            else if (vix < 13) {
                mood = 'COMPLACENT';
                moodExplain = `VIX at ${fmt(vix)} — low fear. Be alert for surprises.`;
            }
            else {
                mood = 'CALM';
                moodExplain = `VIX at ${fmt(vix)} — normal range.`;
            }
        }
    }
    catch { /* keep default */ }
    lines.push(`**Mood**: ${mood}`, `**Why**: ${moodExplain}`, '');
    lines.push('---', `*Data from Yahoo Finance and CoinGecko. Prices may be delayed ~15 min. ${today}*`);
    return lines.join('\n');
}
// ════════════════════════════════════════
// Registration
// ════════════════════════════════════════
export function registerFinancialAnalysisTools() {
    registerTool({
        name: 'market_analysis',
        description: 'Run a coordinated multi-perspective financial analysis on a stock or crypto ticker. Combines 5 specialist perspectives — fundamentals, technical analysis (RSI, SMA, MACD, volatility), social sentiment (Reddit), recent news, and risk assessment — into a unified report with bull/bear case and confidence score. Inspired by TradingAgents multi-agent architecture.',
        parameters: {
            ticker: {
                type: 'string',
                description: 'Stock ticker (e.g. "AAPL", "NVDA", "SPY") or crypto symbol (will use Yahoo Finance)',
                required: true,
            },
        },
        tier: 'free',
        timeout: 60_000, // up to 60s — fetches from multiple sources
        async execute(args) {
            const ticker = String(args.ticker).toUpperCase().trim();
            if (!ticker)
                return 'Error: ticker is required.';
            try {
                return await runMarketAnalysis(ticker);
            }
            catch (err) {
                return `Error running market analysis for ${ticker}: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'portfolio_review',
        description: 'Analyze a portfolio of holdings for risk, diversification, income, and rebalancing opportunities. Provides sector/geography breakdown, concentration risk (HHI), dividend yield estimate, MAGI impact for ACA-conscious investors, rebalancing suggestions, and an overall risk score (1-10). Pass holdings as a JSON array of {ticker, weight} objects.',
        parameters: {
            holdings: {
                type: 'string',
                description: 'JSON array of holdings, e.g. [{"ticker":"AAPL","weight":30},{"ticker":"MSFT","weight":20},{"ticker":"VOO","weight":50}]. Weight can be percentage or dollar amount — it will be normalized.',
                required: true,
            },
            total_value: {
                type: 'number',
                description: 'Total portfolio value in USD (default: 100000). Used for dollar-amount calculations.',
                default: 100_000,
            },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            let holdings;
            try {
                const raw = typeof args.holdings === 'string' ? JSON.parse(args.holdings) : args.holdings;
                if (!Array.isArray(raw) || raw.length === 0) {
                    return 'Error: holdings must be a non-empty JSON array of {ticker, weight} objects.';
                }
                holdings = raw.map((h) => ({
                    ticker: String(h.ticker || '').toUpperCase(),
                    weight: Number(h.weight) || 0,
                    targetWeight: h.targetWeight != null ? Number(h.targetWeight) : undefined,
                })).filter(h => h.ticker && h.weight > 0);
                if (holdings.length === 0)
                    return 'Error: no valid holdings found. Each needs a ticker and positive weight.';
            }
            catch (err) {
                return `Error parsing holdings JSON: ${err instanceof Error ? err.message : String(err)}. Expected format: [{"ticker":"AAPL","weight":30}]`;
            }
            const totalValue = Number(args.total_value) || 100_000;
            try {
                return await runPortfolioReview(holdings, totalValue);
            }
            catch (err) {
                return `Error running portfolio review: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'market_briefing',
        description: 'Generate a quick morning market briefing. Covers major index performance (S&P 500, NASDAQ, Dow, Russell 2000, VIX), notable stock movers, crypto snapshot (BTC/ETH/SOL), market news headlines, and overall market mood assessment. No parameters needed — just run it for a daily market overview.',
        parameters: {},
        tier: 'free',
        timeout: 90_000, // fetches many quotes
        async execute() {
            try {
                return await runMarketBriefing();
            }
            catch (err) {
                return `Error generating market briefing: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=financial-analysis.js.map
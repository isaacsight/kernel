// kbot Social Sentiment Tools — Monitor crypto/stock social signals
// All sources are free, no auth required:
//   - Reddit: public JSON API (append .json to any subreddit URL)
//   - GitHub: public API for repo activity
//   - CryptoPanic: free news aggregator API
//   - Whale alerts: on-chain large transaction monitoring
//   - Google News: RSS feed parsing
//
// Sentiment scoring: simple keyword-based polarity (no LLM needed for basic signals).
import { registerTool } from './index.js';
// ── Helpers ──
async function fetchJSON(url, timeout = 12_000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'KBot/3.0 (Sentiment Monitor)' },
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function fetchText(url, timeout = 10_000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'KBot/3.0 (Sentiment Monitor)' },
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.text();
}
function fmt(n, d = 2) {
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
// ── Sentiment Scoring ──
const BULLISH_WORDS = new Set([
    'bullish', 'moon', 'pump', 'buy', 'long', 'breakout', 'rally', 'surge',
    'rocket', 'gains', 'ath', 'accumulate', 'hodl', 'diamond', 'undervalued',
    'uptrend', 'support', 'bounce', 'recovery', 'green', 'soaring', 'skyrocket',
    'parabolic', 'fomo', 'adoption', 'institutional', 'etf', 'halving',
]);
const BEARISH_WORDS = new Set([
    'bearish', 'crash', 'dump', 'sell', 'short', 'breakdown', 'plunge', 'tank',
    'rug', 'scam', 'overvalued', 'bubble', 'correction', 'resistance', 'decline',
    'red', 'fear', 'panic', 'liquidation', 'bankrupt', 'hack', 'exploit',
    'regulation', 'ban', 'sec', 'lawsuit', 'fraud', 'ponzi',
]);
function scoreSentiment(text) {
    const words = text.toLowerCase().split(/\W+/);
    let bullish = 0;
    let bearish = 0;
    for (const w of words) {
        if (BULLISH_WORDS.has(w))
            bullish++;
        if (BEARISH_WORDS.has(w))
            bearish++;
    }
    const total = bullish + bearish;
    if (total === 0)
        return { score: 0, label: 'NEUTRAL' };
    const score = (bullish - bearish) / total; // -1 to +1
    const label = score > 0.2 ? 'BULLISH' : score < -0.2 ? 'BEARISH' : 'NEUTRAL';
    return { score, label };
}
// ── Register Tools ──
export function registerSentimentTools() {
    // ─── Reddit Sentiment ───
    registerTool({
        name: 'reddit_sentiment',
        description: 'Scan Reddit for sentiment about a crypto token or stock. Checks r/cryptocurrency, r/wallstreetbets, r/stocks, and token-specific subreddits. Returns top posts with sentiment scores.',
        parameters: {
            query: { type: 'string', description: 'Token or stock name to search for (e.g. "bitcoin", "AAPL", "solana")', required: true },
            subreddit: { type: 'string', description: 'Specific subreddit to search (default: auto-detect based on query)' },
            limit: { type: 'number', description: 'Number of posts to analyze (default: 15)', default: 15 },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const query = String(args.query).toLowerCase();
            const limit = Math.min(Number(args.limit) || 15, 25);
            // Pick subreddits based on query
            let subreddits;
            if (args.subreddit) {
                subreddits = [String(args.subreddit)];
            }
            else if (/btc|bitcoin|eth|ethereum|sol|solana|crypto|defi|nft/i.test(query)) {
                subreddits = ['cryptocurrency', 'CryptoMarkets', 'bitcoin', 'ethtrader'];
            }
            else {
                subreddits = ['wallstreetbets', 'stocks', 'investing', 'StockMarket'];
            }
            const allPosts = [];
            for (const sub of subreddits) {
                try {
                    const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=new&t=week&limit=${limit}&restrict_sr=on`;
                    const data = await fetchJSON(url);
                    const posts = data?.data?.children || [];
                    for (const post of posts) {
                        const d = post.data;
                        if (!d?.title)
                            continue;
                        const text = `${d.title} ${d.selftext || ''}`;
                        const sentiment = scoreSentiment(text);
                        allPosts.push({
                            title: d.title.slice(0, 80),
                            score: d.score || 0,
                            comments: d.num_comments || 0,
                            sentiment,
                            sub,
                            url: `https://reddit.com${d.permalink}`,
                        });
                    }
                }
                catch { /* skip failed subreddit */ }
            }
            if (!allPosts.length)
                return `No Reddit posts found for "${query}" this week.`;
            // Sort by upvotes
            allPosts.sort((a, b) => b.score - a.score);
            const top = allPosts.slice(0, limit);
            // Aggregate sentiment
            const avgSentiment = top.reduce((s, p) => s + p.sentiment.score, 0) / top.length;
            const overallLabel = avgSentiment > 0.15 ? 'BULLISH' : avgSentiment < -0.15 ? 'BEARISH' : 'MIXED';
            const bullishCount = top.filter(p => p.sentiment.label === 'BULLISH').length;
            const bearishCount = top.filter(p => p.sentiment.label === 'BEARISH').length;
            const lines = [
                `## Reddit Sentiment: "${args.query}"`,
                '',
                `**Overall**: ${overallLabel} (${bullishCount} bullish / ${bearishCount} bearish / ${top.length - bullishCount - bearishCount} neutral)`,
                `**Score**: ${fmt(avgSentiment, 3)} (-1 bearish ↔ +1 bullish)`,
                `**Sources**: ${subreddits.map(s => `r/${s}`).join(', ')}`,
                '',
                '| Post | Upvotes | Comments | Sentiment |',
                '|------|---------|----------|-----------|',
            ];
            for (const p of top.slice(0, 12)) {
                lines.push(`| ${p.title} | ${p.score} | ${p.comments} | ${p.sentiment.label} |`);
            }
            lines.push('', `*${top.length} posts analyzed from the past week*`);
            return lines.join('\n');
        },
    });
    // ─── Crypto News Aggregator ───
    registerTool({
        name: 'crypto_news',
        description: 'Get the latest crypto news from multiple sources with sentiment analysis. Covers major outlets, project announcements, and regulatory news.',
        parameters: {
            filter: { type: 'string', description: 'Filter: "all", "bullish", "bearish", "important" (default: all)' },
            token: { type: 'string', description: 'Filter by specific token (e.g. "BTC", "ETH", "SOL")' },
            limit: { type: 'number', description: 'Number of articles (default: 15)', default: 15 },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const filter = String(args.filter || 'all').toLowerCase();
            const token = args.token ? String(args.token).toUpperCase() : undefined;
            const limit = Math.min(Number(args.limit) || 15, 25);
            // CryptoPanic free API (no auth for public posts)
            let url = `https://cryptopanic.com/api/free/v1/posts/?auth_token=0000000000000000000000000000000000000000&public=true&kind=news`;
            if (token)
                url += `&currencies=${token}`;
            if (filter === 'bullish')
                url += '&filter=bullish';
            else if (filter === 'bearish')
                url += '&filter=bearish';
            else if (filter === 'important')
                url += '&filter=important';
            let articles = [];
            try {
                const data = await fetchJSON(url);
                const results = data?.results || [];
                for (const r of results.slice(0, limit)) {
                    const sentiment = scoreSentiment(r.title || '');
                    articles.push({
                        title: (r.title || '').slice(0, 100),
                        source: r.source?.title || r.domain || '?',
                        url: r.url || '',
                        sentiment,
                        published: r.published_at?.split('T')[0] || '?',
                    });
                }
            }
            catch {
                // Fallback: Google News RSS for crypto
                try {
                    const query = token ? `${token} cryptocurrency` : 'cryptocurrency market';
                    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
                    const xml = await fetchText(rssUrl);
                    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
                    for (const item of items.slice(0, limit)) {
                        const titleMatch = item.match(/<title>(.*?)<\/title>/);
                        const linkMatch = item.match(/<link>(.*?)<\/link>/);
                        const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/);
                        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
                        const title = titleMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1') || '?';
                        const sentiment = scoreSentiment(title);
                        articles.push({
                            title: title.slice(0, 100),
                            source: sourceMatch?.[1] || '?',
                            url: linkMatch?.[1] || '',
                            sentiment,
                            published: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString().split('T')[0] : '?',
                        });
                    }
                }
                catch { /* both failed */ }
            }
            if (!articles.length)
                return 'Could not fetch crypto news. Try again later.';
            const bullish = articles.filter(a => a.sentiment.label === 'BULLISH').length;
            const bearish = articles.filter(a => a.sentiment.label === 'BEARISH').length;
            const overallScore = articles.reduce((s, a) => s + a.sentiment.score, 0) / articles.length;
            const overall = overallScore > 0.15 ? 'BULLISH' : overallScore < -0.15 ? 'BEARISH' : 'MIXED';
            const lines = [
                `## Crypto News${token ? ` — ${token}` : ''}`,
                '',
                `**Sentiment**: ${overall} (${bullish} bullish / ${bearish} bearish / ${articles.length - bullish - bearish} neutral)`,
                '',
                '| Date | Headline | Source | Sentiment |',
                '|------|----------|--------|-----------|',
            ];
            for (const a of articles) {
                lines.push(`| ${a.published} | ${a.title} | ${a.source} | ${a.sentiment.label} |`);
            }
            return lines.join('\n');
        },
    });
    // ─── GitHub Project Activity ───
    registerTool({
        name: 'github_activity',
        description: 'Monitor GitHub development activity for crypto projects. High commit velocity and contributor growth are bullish signals for token fundamentals.',
        parameters: {
            repo: { type: 'string', description: 'GitHub repo (e.g. "solana-labs/solana", "ethereum/go-ethereum")', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const repo = String(args.repo);
            const [repoData, commitsData, contributorsData] = await Promise.all([
                fetchJSON(`https://api.github.com/repos/${repo}`),
                fetchJSON(`https://api.github.com/repos/${repo}/commits?per_page=20`),
                fetchJSON(`https://api.github.com/repos/${repo}/contributors?per_page=10`),
            ]).catch(() => [null, null, null]);
            if (!repoData)
                return `Could not fetch data for "${repo}". Check the repo path.`;
            // Commit frequency
            const recentCommits = (commitsData || []).slice(0, 20);
            const commitDates = recentCommits
                .map((c) => c.commit?.author?.date)
                .filter(Boolean)
                .map((d) => new Date(d));
            let commitsThisWeek = 0;
            let commitsThisMonth = 0;
            const now = Date.now();
            for (const d of commitDates) {
                const age = now - d.getTime();
                if (age < 7 * 24 * 60 * 60 * 1000)
                    commitsThisWeek++;
                if (age < 30 * 24 * 60 * 60 * 1000)
                    commitsThisMonth++;
            }
            // Activity signal
            const signal = commitsThisWeek >= 10 ? 'VERY ACTIVE'
                : commitsThisWeek >= 5 ? 'ACTIVE'
                    : commitsThisWeek >= 1 ? 'MODERATE'
                        : 'SLOW';
            const lines = [
                `## GitHub Activity: ${repo}`,
                '',
                `**Stars**: ${(repoData.stargazers_count || 0).toLocaleString()} | **Forks**: ${(repoData.forks_count || 0).toLocaleString()} | **Open Issues**: ${(repoData.open_issues_count || 0).toLocaleString()}`,
                `**Language**: ${repoData.language || '?'} | **License**: ${repoData.license?.spdx_id || '?'}`,
                `**Last Push**: ${repoData.pushed_at?.split('T')[0] || '?'}`,
                '',
                `### Development Velocity: **${signal}**`,
                `- Commits this week: ${commitsThisWeek}`,
                `- Commits this month: ${commitsThisMonth}`,
                '',
            ];
            if (recentCommits.length) {
                lines.push('### Recent Commits', '', '| Date | Author | Message |', '|------|--------|---------|');
                for (const c of recentCommits.slice(0, 8)) {
                    const date = c.commit?.author?.date?.split('T')[0] || '?';
                    const author = c.commit?.author?.name || c.author?.login || '?';
                    const msg = (c.commit?.message || '').split('\n')[0].slice(0, 60);
                    lines.push(`| ${date} | ${author} | ${msg} |`);
                }
            }
            if (contributorsData?.length) {
                lines.push('', '### Top Contributors', '');
                for (const c of (contributorsData || []).slice(0, 5)) {
                    lines.push(`- **${c.login}**: ${c.contributions} commits`);
                }
            }
            return lines.join('\n');
        },
    });
    // ─── Whale Tracker ───
    registerTool({
        name: 'whale_tracker',
        description: 'Monitor large Solana transactions (whale movements). Large transfers to/from exchanges often signal upcoming price action. Checks recent large SOL transfers.',
        parameters: {
            minSol: { type: 'number', description: 'Minimum transaction size in SOL to track (default: 10000)', default: 10000 },
        },
        tier: 'free',
        timeout: 20_000,
        async execute(args) {
            const minSol = Number(args.minSol) || 10000;
            const minLamports = minSol * 1e9;
            // Query recent large Solana transfers via public RPC
            // We check recent signatures on the System Program for large amounts
            try {
                const body = JSON.stringify({
                    jsonrpc: '2.0', id: 1,
                    method: 'getSignaturesForAddress',
                    params: ['11111111111111111111111111111111', { limit: 50 }], // System Program
                });
                const res = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    signal: AbortSignal.timeout(15_000),
                });
                const data = await res.json();
                const sigs = data.result || [];
                if (!sigs.length)
                    return 'No recent large transactions found. The Solana RPC may be rate-limiting.';
                // Get transaction details for the most recent ones
                const largeTxs = [];
                for (const sig of sigs.slice(0, 20)) {
                    try {
                        const txBody = JSON.stringify({
                            jsonrpc: '2.0', id: 1,
                            method: 'getTransaction',
                            params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
                        });
                        const txRes = await fetch('https://api.mainnet-beta.solana.com', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: txBody,
                            signal: AbortSignal.timeout(5_000),
                        });
                        const txData = await txRes.json();
                        const meta = txData.result?.meta;
                        if (!meta)
                            continue;
                        // Calculate net SOL movement
                        const preBalances = meta.preBalances || [];
                        const postBalances = meta.postBalances || [];
                        let maxTransfer = 0;
                        for (let i = 0; i < preBalances.length; i++) {
                            const diff = Math.abs((postBalances[i] || 0) - (preBalances[i] || 0));
                            maxTransfer = Math.max(maxTransfer, diff);
                        }
                        if (maxTransfer >= minLamports) {
                            const solAmount = maxTransfer / 1e9;
                            const time = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString().replace('T', ' ').slice(0, 16) : '?';
                            largeTxs.push({
                                sig: sig.signature,
                                time,
                                amount: fmt(solAmount, 0),
                            });
                        }
                    }
                    catch { /* skip individual tx fetch errors */ }
                    if (largeTxs.length >= 10)
                        break;
                }
                if (!largeTxs.length)
                    return `No transactions >= ${minSol.toLocaleString()} SOL found in recent blocks.`;
                // Get SOL price for USD values
                let solPrice = 0;
                try {
                    const priceData = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
                        signal: AbortSignal.timeout(5_000),
                    }).then(r => r.json());
                    solPrice = priceData.solana?.usd || 0;
                }
                catch { /* ok */ }
                const lines = [
                    `## Whale Tracker (>= ${minSol.toLocaleString()} SOL)`,
                    '',
                    '| Time | Amount | USD Value | Tx |',
                    '|------|--------|-----------|-----|',
                ];
                for (const tx of largeTxs) {
                    const usd = solPrice ? `$${fmt(Number(tx.amount.replace(/,/g, '')) * solPrice, 0)}` : '?';
                    const shortSig = `${tx.sig.slice(0, 8)}...`;
                    lines.push(`| ${tx.time} | ${tx.amount} SOL | ${usd} | [\`${shortSig}\`](https://solscan.io/tx/${tx.sig}) |`);
                }
                lines.push('', `*SOL Price: $${fmt(solPrice)} — ${new Date().toISOString().split('T')[0]}*`);
                return lines.join('\n');
            }
            catch (err) {
                return `Whale tracker error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ─── Social Pulse (Combined) ───
    registerTool({
        name: 'social_pulse',
        description: 'Comprehensive social media pulse check for any crypto token or stock. Combines Reddit sentiment, news headlines, and market data into one actionable signal. The "morning briefing" tool.',
        parameters: {
            symbol: { type: 'string', description: 'Token or stock symbol (e.g. "BTC", "SOL", "AAPL")', required: true },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const symbol = String(args.symbol).toUpperCase();
            const isCrypto = /^(BTC|ETH|SOL|BNB|ADA|DOT|DOGE|XRP|AVAX|MATIC|LINK|UNI|AAVE|ARB|OP|SUI|APT|JUP|BONK|WIF|JTO|RENDER|PYTH)$/.test(symbol);
            const lines = [
                `## Social Pulse: ${symbol}`,
                `*${new Date().toISOString().split('T')[0]}*`,
                '',
            ];
            // 1. Reddit sentiment
            const subreddits = isCrypto
                ? ['cryptocurrency', 'CryptoMarkets']
                : ['wallstreetbets', 'stocks'];
            let redditBullish = 0;
            let redditBearish = 0;
            let redditTotal = 0;
            let topPost = '';
            for (const sub of subreddits) {
                try {
                    const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=new&t=week&limit=10&restrict_sr=on`;
                    const data = await fetchJSON(url);
                    const posts = data?.data?.children || [];
                    for (const post of posts) {
                        const d = post.data;
                        if (!d?.title)
                            continue;
                        const s = scoreSentiment(`${d.title} ${d.selftext || ''}`);
                        if (s.label === 'BULLISH')
                            redditBullish++;
                        else if (s.label === 'BEARISH')
                            redditBearish++;
                        redditTotal++;
                        if (!topPost && d.score > 10)
                            topPost = d.title.slice(0, 80);
                    }
                }
                catch { /* skip */ }
            }
            const redditSentiment = redditTotal
                ? (redditBullish > redditBearish ? 'BULLISH' : redditBearish > redditBullish ? 'BEARISH' : 'MIXED')
                : 'N/A';
            lines.push('### Reddit');
            lines.push(`**Sentiment**: ${redditSentiment} (${redditBullish}↑ / ${redditBearish}↓ / ${redditTotal - redditBullish - redditBearish}— from ${redditTotal} posts)`);
            if (topPost)
                lines.push(`**Top Post**: "${topPost}"`);
            lines.push('');
            // 2. News sentiment
            let newsBullish = 0;
            let newsBearish = 0;
            let newsTotal = 0;
            let topHeadline = '';
            try {
                const query = isCrypto ? `${symbol} cryptocurrency` : `${symbol} stock`;
                const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
                const xml = await fetchText(rssUrl);
                const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
                for (const item of items.slice(0, 10)) {
                    const titleMatch = item.match(/<title>(.*?)<\/title>/);
                    const title = titleMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1') || '';
                    if (!title)
                        continue;
                    const s = scoreSentiment(title);
                    if (s.label === 'BULLISH')
                        newsBullish++;
                    else if (s.label === 'BEARISH')
                        newsBearish++;
                    newsTotal++;
                    if (!topHeadline)
                        topHeadline = title.slice(0, 80);
                }
            }
            catch { /* skip */ }
            const newsSentiment = newsTotal
                ? (newsBullish > newsBearish ? 'BULLISH' : newsBearish > newsBullish ? 'BEARISH' : 'MIXED')
                : 'N/A';
            lines.push('### News');
            lines.push(`**Sentiment**: ${newsSentiment} (${newsBullish}↑ / ${newsBearish}↓ from ${newsTotal} headlines)`);
            if (topHeadline)
                lines.push(`**Top Headline**: "${topHeadline}"`);
            lines.push('');
            // 3. Fear & Greed (crypto only)
            if (isCrypto) {
                try {
                    const fg = await fetchJSON('https://api.alternative.me/fng/?limit=1');
                    if (fg.data?.[0]) {
                        const d = fg.data[0];
                        lines.push(`### Market Mood`);
                        lines.push(`**Fear & Greed**: ${d.value}/100 (${d.value_classification})`);
                        lines.push('');
                    }
                }
                catch { /* skip */ }
            }
            // 4. Overall signal
            const signals = [redditSentiment, newsSentiment].filter(s => s !== 'N/A');
            const bullishSignals = signals.filter(s => s === 'BULLISH').length;
            const bearishSignals = signals.filter(s => s === 'BEARISH').length;
            const overall = bullishSignals > bearishSignals ? 'BULLISH'
                : bearishSignals > bullishSignals ? 'BEARISH'
                    : 'MIXED';
            lines.push('---');
            lines.push(`### Overall Social Signal: **${overall}**`);
            lines.push(`Reddit ${redditSentiment} + News ${newsSentiment} = **${overall}**`);
            lines.push('');
            lines.push('*Keyword-based sentiment. Use with technical analysis for better decisions. Not financial advice.*');
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=sentiment.js.map
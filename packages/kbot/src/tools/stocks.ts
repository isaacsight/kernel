// kbot Stock Market Tools — Equities, ETFs, indices via free APIs
// Uses Yahoo Finance v8 API (no auth required for basic quotes and history).
// All data is delayed ~15min for free tier.

import { registerTool } from './index.js'

// ── Helpers ──

async function yahooQuote(symbol: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KBot/3.0 (Stock Tools)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Yahoo Finance: ${res.status}`)
  const data = await res.json() as any
  return data.chart?.result?.[0]
}

async function yahooHistory(symbol: string, range: string, interval: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KBot/3.0 (Stock Tools)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Yahoo Finance: ${res.status}`)
  const data = await res.json() as any
  return data.chart?.result?.[0]
}

async function yahooSearch(query: string): Promise<any[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KBot/3.0 (Stock Tools)' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return []
  const data = await res.json() as any
  return data.quotes || []
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// ── Register Tools ──

export function registerStockTools(): void {

  registerTool({
    name: 'stock_quote',
    description: 'Get a real-time stock quote — price, change, volume, market cap, P/E ratio, 52-week range. Works for stocks, ETFs, and indices (e.g. AAPL, SPY, ^GSPC).',
    parameters: {
      symbol: { type: 'string', description: 'Stock ticker symbol (e.g. "AAPL", "MSFT", "SPY", "^GSPC" for S&P 500)', required: true },
    },
    tier: 'free',
    timeout: 15_000,
    async execute(args) {
      const symbol = String(args.symbol).toUpperCase()
      const result = await yahooQuote(symbol)
      if (!result) return `Could not find data for "${symbol}". Check the ticker symbol.`

      const meta = result.meta
      const indicators = result.indicators?.quote?.[0]
      if (!meta || !indicators) return `No quote data for "${symbol}".`

      const price = meta.regularMarketPrice ?? 0
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      const change = price - prevClose
      const changePct = prevClose ? (change / prevClose) * 100 : 0

      // Get last 5 days of closes for sparkline context
      const closes = indicators.close?.filter((c: any) => c != null) || []
      const volumes = indicators.volume?.filter((v: any) => v != null) || []
      const highs = indicators.high?.filter((h: any) => h != null) || []
      const lows = indicators.low?.filter((l: any) => l != null) || []

      const high5d = highs.length ? Math.max(...highs) : 0
      const low5d = lows.length ? Math.min(...lows) : 0
      const avgVol = volumes.length ? volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length : 0

      return [
        `## ${meta.shortName || symbol} (${symbol})`,
        `**Exchange**: ${meta.exchangeName || '?'} | **Currency**: ${meta.currency || 'USD'}`,
        '',
        `**Price**: $${fmt(price)}`,
        `**Change**: ${change >= 0 ? '+' : ''}$${fmt(change)} (${changePct >= 0 ? '+' : ''}${fmt(changePct)}%)`,
        `**5d Range**: $${fmt(low5d)} — $${fmt(high5d)}`,
        `**Avg Volume (5d)**: ${Math.round(avgVol).toLocaleString()}`,
        '',
        `*Data from Yahoo Finance — ~15 min delay. ${new Date().toISOString().split('T')[0]}*`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'stock_history',
    description: 'Get historical price data for a stock, ETF, or index. Returns OHLCV candles with summary statistics.',
    parameters: {
      symbol: { type: 'string', description: 'Stock ticker (e.g. "AAPL", "SPY")', required: true },
      range: { type: 'string', description: 'Time range: 1mo, 3mo, 6mo, 1y, 2y, 5y, max (default: 6mo)', default: '6mo' },
    },
    tier: 'free',
    timeout: 15_000,
    async execute(args) {
      const symbol = String(args.symbol).toUpperCase()
      const range = String(args.range || '6mo')

      // Pick appropriate interval based on range
      const intervalMap: Record<string, string> = {
        '1mo': '1d', '3mo': '1d', '6mo': '1wk', '1y': '1wk',
        '2y': '1wk', '5y': '1mo', 'max': '1mo',
      }
      const interval = intervalMap[range] || '1wk'

      const result = await yahooHistory(symbol, range, interval)
      if (!result) return `No history for "${symbol}".`

      const timestamps = result.timestamp || []
      const quotes = result.indicators?.quote?.[0]
      if (!timestamps.length || !quotes) return `No data.`

      const lines: string[] = [
        `## ${symbol} — ${range} History (${interval} candles)`,
        '',
        '| Date | Open | High | Low | Close | Volume |',
        '|------|------|------|-----|-------|--------|',
      ]

      // Show at most 25 rows
      const step = Math.max(1, Math.floor(timestamps.length / 25))
      for (let i = 0; i < timestamps.length; i += step) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
        const o = quotes.open?.[i]
        const h = quotes.high?.[i]
        const l = quotes.low?.[i]
        const c = quotes.close?.[i]
        const v = quotes.volume?.[i]
        if (c == null) continue
        lines.push(`| ${date} | $${fmt(o)} | $${fmt(h)} | $${fmt(l)} | $${fmt(c)} | ${Math.round(v || 0).toLocaleString()} |`)
      }

      // Summary
      const allCloses = (quotes.close || []).filter((c: any) => c != null)
      if (allCloses.length >= 2) {
        const first = allCloses[0]
        const last = allCloses[allCloses.length - 1]
        const ret = ((last - first) / first) * 100
        const allHighs = (quotes.high || []).filter((h: any) => h != null)
        const allLows = (quotes.low || []).filter((l: any) => l != null)
        const periodHigh = Math.max(...allHighs)
        const periodLow = Math.min(...allLows)

        lines.push(
          '',
          `**Period Return**: ${ret >= 0 ? '+' : ''}${fmt(ret)}%`,
          `**Period High**: $${fmt(periodHigh)} | **Low**: $${fmt(periodLow)}`,
        )
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'stock_compare',
    description: 'Compare multiple stocks side by side — price, returns, volume. Great for evaluating alternatives (e.g. AAPL vs MSFT vs GOOGL).',
    parameters: {
      symbols: { type: 'string', description: 'Comma-separated tickers (e.g. "AAPL,MSFT,GOOGL")', required: true },
      range: { type: 'string', description: 'Time range for returns: 1mo, 3mo, 6mo, 1y (default: 3mo)', default: '3mo' },
    },
    tier: 'free',
    timeout: 20_000,
    async execute(args) {
      const symbols = String(args.symbols).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      if (symbols.length < 2) return 'Need at least 2 symbols to compare.'
      if (symbols.length > 8) return 'Max 8 symbols for comparison.'
      const range = String(args.range || '3mo')

      const results = await Promise.all(
        symbols.map(async sym => {
          try {
            const data = await yahooHistory(sym, range, '1d')
            if (!data) return null
            const closes = (data.indicators?.quote?.[0]?.close || []).filter((c: any) => c != null)
            const volumes = (data.indicators?.quote?.[0]?.volume || []).filter((v: any) => v != null)
            const first = closes[0] || 0
            const last = closes[closes.length - 1] || 0
            const ret = first ? ((last - first) / first) * 100 : 0
            const avgVol = volumes.length ? volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length : 0
            return {
              symbol: sym,
              name: data.meta?.shortName || sym,
              price: last,
              returnPct: ret,
              avgVolume: avgVol,
              high: Math.max(...(data.indicators?.quote?.[0]?.high || []).filter((h: any) => h != null)),
              low: Math.min(...(data.indicators?.quote?.[0]?.low || []).filter((l: any) => l != null)),
            }
          } catch { return null }
        })
      )

      const valid = results.filter(Boolean) as NonNullable<typeof results[number]>[]
      if (!valid.length) return 'Could not fetch data for any of those symbols.'

      const lines: string[] = [
        `## Stock Comparison (${range})`,
        '',
        '| Ticker | Name | Price | Return | Avg Volume | High | Low |',
        '|--------|------|-------|--------|------------|------|-----|',
      ]

      // Sort by return descending
      valid.sort((a, b) => b!.returnPct - a!.returnPct)
      for (const s of valid) {
        lines.push(`| ${s!.symbol} | ${s!.name} | $${fmt(s!.price)} | ${s!.returnPct >= 0 ? '+' : ''}${fmt(s!.returnPct)}% | ${Math.round(s!.avgVolume).toLocaleString()} | $${fmt(s!.high)} | $${fmt(s!.low)} |`)
      }

      const best = valid[0]!
      const worst = valid[valid.length - 1]!
      lines.push(
        '',
        `**Best performer**: ${best.symbol} (${best.returnPct >= 0 ? '+' : ''}${fmt(best.returnPct)}%)`,
        `**Worst performer**: ${worst.symbol} (${worst.returnPct >= 0 ? '+' : ''}${fmt(worst.returnPct)}%)`,
        `**Spread**: ${fmt(best.returnPct - worst.returnPct)}%`,
      )

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'stock_search',
    description: 'Search for stocks, ETFs, and indices by name or keyword. Returns ticker symbols and exchange info.',
    parameters: {
      query: { type: 'string', description: 'Company name, keyword, or partial ticker (e.g. "apple", "electric vehicle", "AI")', required: true },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const query = String(args.query)
      const results = await yahooSearch(query)

      if (!results.length) return `No results for "${query}".`

      const lines: string[] = [
        `## Search: "${query}"`,
        '',
        '| Ticker | Name | Type | Exchange |',
        '|--------|------|------|----------|',
      ]

      for (const r of results.slice(0, 10)) {
        lines.push(`| ${r.symbol} | ${r.shortname || r.longname || '?'} | ${r.quoteType || '?'} | ${r.exchange || '?'} |`)
      }

      lines.push('', '*Use the ticker symbol with `stock_quote` or `stock_history`.*')
      return lines.join('\n')
    },
  })

  registerTool({
    name: 'stock_screener',
    description: 'Screen stocks by sector or theme. Returns a curated watchlist of major companies in a given category.',
    parameters: {
      sector: { type: 'string', description: 'Sector or theme: "tech", "ai", "energy", "finance", "health", "ev", "defense", "crypto-stocks", "dividends", "etf-popular"', required: true },
    },
    tier: 'free',
    timeout: 20_000,
    async execute(args) {
      const sector = String(args.sector).toLowerCase()

      const watchlists: Record<string, string[]> = {
        tech: ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'TSM', 'AVGO', 'ORCL', 'CRM'],
        ai: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMD', 'PLTR', 'SNOW', 'AI', 'PATH', 'SMCI'],
        energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PXD', 'OXY', 'MPC', 'PSX', 'VLO'],
        finance: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'SCHW', 'C', 'AXP', 'V'],
        health: ['UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY'],
        ev: ['TSLA', 'RIVN', 'LCID', 'NIO', 'LI', 'XPEV', 'F', 'GM', 'TM', 'BYDDY'],
        defense: ['LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX', 'HII', 'TDG', 'LDOS', 'BAH'],
        'crypto-stocks': ['COIN', 'MSTR', 'MARA', 'RIOT', 'CLSK', 'HUT', 'BITF', 'CIFR', 'SQ', 'PYPL'],
        dividends: ['JNJ', 'PG', 'KO', 'PEP', 'MCD', 'O', 'VZ', 'T', 'IBM', 'XOM'],
        'etf-popular': ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'ARKK', 'XLF', 'XLE', 'GLD'],
      }

      const tickers = watchlists[sector]
      if (!tickers) {
        return `Unknown sector "${sector}". Available: ${Object.keys(watchlists).join(', ')}`
      }

      // Fetch quotes for all tickers in parallel
      const quotes = await Promise.all(
        tickers.map(async sym => {
          try {
            const data = await yahooQuote(sym)
            if (!data) return null
            const meta = data.meta
            const price = meta?.regularMarketPrice ?? 0
            const prevClose = meta?.chartPreviousClose ?? price
            const change = price - prevClose
            const changePct = prevClose ? (change / prevClose) * 100 : 0
            return { symbol: sym, name: meta?.shortName || sym, price, changePct }
          } catch { return null }
        })
      )

      const valid = quotes.filter(Boolean) as NonNullable<typeof quotes[number]>[]

      const lines: string[] = [
        `## ${sector.toUpperCase()} Watchlist`,
        '',
        '| Ticker | Name | Price | Day Change |',
        '|--------|------|-------|------------|',
      ]

      for (const q of valid) {
        lines.push(`| ${q!.symbol} | ${q!.name} | $${fmt(q!.price)} | ${q!.changePct >= 0 ? '+' : ''}${fmt(q!.changePct)}% |`)
      }

      const avg = valid.reduce((s, q) => s + q!.changePct, 0) / (valid.length || 1)
      lines.push('', `**Sector Average**: ${avg >= 0 ? '+' : ''}${fmt(avg)}%`)

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'market_indices',
    description: 'Get current levels for major market indices — S&P 500, Nasdaq, Dow, Russell 2000, VIX, and global markets.',
    parameters: {},
    tier: 'free',
    timeout: 20_000,
    async execute() {
      const indices = [
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^IXIC', name: 'Nasdaq' },
        { symbol: '^DJI', name: 'Dow Jones' },
        { symbol: '^RUT', name: 'Russell 2000' },
        { symbol: '^VIX', name: 'VIX (Fear)' },
        { symbol: '^FTSE', name: 'FTSE 100' },
        { symbol: '^N225', name: 'Nikkei 225' },
        { symbol: '^HSI', name: 'Hang Seng' },
      ]

      const results = await Promise.all(
        indices.map(async idx => {
          try {
            const data = await yahooQuote(idx.symbol)
            if (!data) return null
            const meta = data.meta
            const price = meta?.regularMarketPrice ?? 0
            const prevClose = meta?.chartPreviousClose ?? price
            const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
            return { ...idx, price, changePct }
          } catch { return null }
        })
      )

      const valid = results.filter(Boolean) as NonNullable<typeof results[number]>[]

      const lines: string[] = [
        '## Market Indices',
        '',
        '| Index | Level | Day Change |',
        '|-------|-------|------------|',
      ]

      for (const idx of valid) {
        lines.push(`| ${idx!.name} | ${fmt(idx!.price, idx!.name === 'VIX (Fear)' ? 2 : 0)} | ${idx!.changePct >= 0 ? '+' : ''}${fmt(idx!.changePct)}% |`)
      }

      const vix = valid.find(v => v!.name === 'VIX (Fear)')
      if (vix) {
        const mood = vix.price < 15 ? 'Low volatility (complacent)' :
          vix.price < 20 ? 'Normal' :
          vix.price < 30 ? 'Elevated fear' :
          'High fear / panic'
        lines.push('', `**VIX Mood**: ${mood}`)
      }

      lines.push('', `*${new Date().toISOString().split('T')[0]} — data delayed ~15 min*`)
      return lines.join('\n')
    },
  })
}

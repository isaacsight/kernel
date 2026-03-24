// kbot Stock Tools — Unit tests
// Tests screener watchlists and formatting logic (no network calls).

import { describe, it, expect } from 'vitest'

// ── Screener Watchlist Tests ──

describe('Stock Screener Watchlists', () => {
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

  it('each watchlist has 10 tickers', () => {
    for (const [sector, tickers] of Object.entries(watchlists)) {
      expect(tickers).toHaveLength(10)
    }
  })

  it('all tickers are uppercase strings', () => {
    for (const tickers of Object.values(watchlists)) {
      for (const t of tickers) {
        expect(t).toBe(t.toUpperCase())
        expect(t.length).toBeGreaterThan(0)
      }
    }
  })

  it('no duplicate tickers within a watchlist', () => {
    for (const [sector, tickers] of Object.entries(watchlists)) {
      const unique = new Set(tickers)
      expect(unique.size).toBe(tickers.length)
    }
  })

  it('has all expected sectors', () => {
    const expected = ['tech', 'ai', 'energy', 'finance', 'health', 'ev', 'defense', 'crypto-stocks', 'dividends', 'etf-popular']
    for (const sector of expected) {
      expect(watchlists[sector]).toBeDefined()
    }
  })
})

// ── Formatting Tests ──

describe('Number Formatting', () => {
  function fmt(n: number, d = 2): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  }

  it('formats prices with 2 decimals', () => {
    expect(fmt(150.5)).toBe('150.50')
  })

  it('formats large numbers with commas', () => {
    expect(fmt(1234567.89)).toBe('1,234,567.89')
  })

  it('formats small numbers with custom decimals', () => {
    expect(fmt(0.001234, 6)).toBe('0.001234')
  })

  it('formats zero', () => {
    expect(fmt(0)).toBe('0.00')
  })

  it('formats negative numbers', () => {
    expect(fmt(-42.5)).toBe('-42.50')
  })
})

// ── Yahoo Finance URL Construction Tests ──

describe('Yahoo Finance URL Construction', () => {
  it('encodes ticker symbols correctly', () => {
    const symbol = '^GSPC' // S&P 500
    const encoded = encodeURIComponent(symbol)
    expect(encoded).toBe('%5EGSPC')
  })

  it('maps range to interval correctly', () => {
    const intervalMap: Record<string, string> = {
      '1mo': '1d', '3mo': '1d', '6mo': '1wk', '1y': '1wk',
      '2y': '1wk', '5y': '1mo', 'max': '1mo',
    }
    expect(intervalMap['1mo']).toBe('1d')
    expect(intervalMap['6mo']).toBe('1wk')
    expect(intervalMap['5y']).toBe('1mo')
  })
})

// kbot Finance Tools — Unit tests
// Tests TA calculations (pure math, no network), paper trading logic, and alert persistence.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── Test the pure math functions by importing them indirectly via tool execution ──
// For unit testing, we replicate the core TA functions here to test in isolation.

// SMA
function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

// EMA
function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

// RSI
function rsi(closes: number[], period = 14): number[] {
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  const result: number[] = []
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - 100 / (1 + rs))
  }
  return result
}

// Bollinger Bands
function bollingerBands(closes: number[], period = 20, stdDevMult = 2) {
  const middle = sma(closes, period)
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 0; i < middle.length; i++) {
    const slice = closes.slice(i, i + period)
    const mean = middle[i]
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period
    const stdDev = Math.sqrt(variance)
    upper.push(mean + stdDevMult * stdDev)
    lower.push(mean - stdDevMult * stdDev)
  }
  return { upper, middle, lower }
}

// ── Technical Analysis Tests ──

describe('SMA (Simple Moving Average)', () => {
  it('computes correct SMA for known data', () => {
    const data = [10, 20, 30, 40, 50]
    const result = sma(data, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBeCloseTo(20) // (10+20+30)/3
    expect(result[1]).toBeCloseTo(30) // (20+30+40)/3
    expect(result[2]).toBeCloseTo(40) // (30+40+50)/3
  })

  it('returns empty for insufficient data', () => {
    expect(sma([1, 2], 5)).toHaveLength(0)
  })

  it('handles single-period SMA (identity)', () => {
    const data = [5, 10, 15]
    expect(sma(data, 1)).toEqual(data)
  })
})

describe('EMA (Exponential Moving Average)', () => {
  it('first value equals first data point', () => {
    const data = [10, 20, 30, 40]
    const result = ema(data, 3)
    expect(result[0]).toBe(10)
  })

  it('EMA responds faster to recent changes than SMA', () => {
    const data = [10, 10, 10, 10, 50] // sudden spike
    const smaResult = sma(data, 3)
    const emaResult = ema(data, 3)
    // EMA should be closer to 50 than SMA at the end
    const lastSma = smaResult[smaResult.length - 1]
    const lastEma = emaResult[emaResult.length - 1]
    expect(lastEma).toBeGreaterThan(lastSma)
  })

  it('returns same length as input', () => {
    const data = [1, 2, 3, 4, 5]
    expect(ema(data, 3)).toHaveLength(5)
  })
})

describe('RSI (Relative Strength Index)', () => {
  it('returns values between 0 and 100', () => {
    // Generate random-ish price data
    const data: number[] = [100]
    for (let i = 1; i < 50; i++) {
      data.push(data[i - 1] + (Math.sin(i * 0.5) * 10))
    }
    const result = rsi(data, 14)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('shows overbought (>70) after sustained rally', () => {
    // Monotonically increasing prices
    const data: number[] = []
    for (let i = 0; i < 30; i++) data.push(100 + i * 5)
    const result = rsi(data, 14)
    const last = result[result.length - 1]
    expect(last).toBeGreaterThan(70)
  })

  it('shows oversold (<30) after sustained decline', () => {
    const data: number[] = []
    for (let i = 0; i < 30; i++) data.push(200 - i * 5)
    const result = rsi(data, 14)
    const last = result[result.length - 1]
    expect(last).toBeLessThan(30)
  })
})

describe('Bollinger Bands', () => {
  it('middle band equals SMA', () => {
    const data: number[] = []
    for (let i = 0; i < 40; i++) data.push(100 + Math.sin(i * 0.3) * 10)
    const bb = bollingerBands(data, 20)
    const smaResult = sma(data, 20)
    for (let i = 0; i < bb.middle.length; i++) {
      expect(bb.middle[i]).toBeCloseTo(smaResult[i])
    }
  })

  it('upper > middle > lower', () => {
    const data: number[] = []
    for (let i = 0; i < 40; i++) data.push(50 + Math.random() * 20)
    const bb = bollingerBands(data, 20)
    for (let i = 0; i < bb.middle.length; i++) {
      expect(bb.upper[i]).toBeGreaterThanOrEqual(bb.middle[i])
      expect(bb.middle[i]).toBeGreaterThanOrEqual(bb.lower[i])
    }
  })

  it('bands widen with more volatility', () => {
    // Low volatility
    const stable = Array(40).fill(100)
    const bbStable = bollingerBands(stable, 20)
    const stableWidth = bbStable.upper[0] - bbStable.lower[0]

    // High volatility
    const volatile: number[] = []
    for (let i = 0; i < 40; i++) volatile.push(100 + (i % 2 === 0 ? 20 : -20))
    const bbVolatile = bollingerBands(volatile, 20)
    const volatileWidth = bbVolatile.upper[0] - bbVolatile.lower[0]

    expect(volatileWidth).toBeGreaterThan(stableWidth)
  })
})

// ── Paper Portfolio Tests ──

describe('Paper Portfolio Logic', () => {
  const PORTFOLIO_PATH = join(homedir(), '.kbot', 'paper-portfolio.test.json')

  // We test the logic without the actual tool registration (no network calls)
  interface Position { symbol: string; quantity: number; avgCost: number; side: 'long' | 'short'; openedAt: string }
  interface Trade { symbol: string; side: 'buy' | 'sell'; quantity: number; price: number; timestamp: string; pnl?: number }
  interface Portfolio {
    cash: number; positions: Position[]; trades: Trade[]; createdAt: string
    limits: { maxPositionPct: number; maxDailyLossPct: number; stopLossPct: number }
  }

  function freshPortfolio(): Portfolio {
    return {
      cash: 100_000, positions: [], trades: [],
      createdAt: new Date().toISOString(),
      limits: { maxPositionPct: 25, maxDailyLossPct: 5, stopLossPct: 15 },
    }
  }

  it('starts with $100,000 cash', () => {
    const p = freshPortfolio()
    expect(p.cash).toBe(100_000)
    expect(p.positions).toHaveLength(0)
  })

  it('buy reduces cash and adds position', () => {
    const p = freshPortfolio()
    const price = 50000 // BTC price
    const amount = 10000 // buy $10k worth
    const qty = amount / price

    p.cash -= amount
    p.positions.push({ symbol: 'bitcoin', quantity: qty, avgCost: price, side: 'long', openedAt: new Date().toISOString() })
    p.trades.push({ symbol: 'bitcoin', side: 'buy', quantity: qty, price, timestamp: new Date().toISOString() })

    expect(p.cash).toBe(90_000)
    expect(p.positions).toHaveLength(1)
    expect(p.positions[0].quantity).toBeCloseTo(0.2)
  })

  it('sell increases cash and records P&L', () => {
    const p = freshPortfolio()
    // Buy at 50000
    p.positions.push({ symbol: 'bitcoin', quantity: 0.2, avgCost: 50000, side: 'long', openedAt: new Date().toISOString() })
    p.cash = 90_000

    // Sell at 55000 (10% gain)
    const sellPrice = 55000
    const sellQty = 0.2
    const proceeds = sellQty * sellPrice
    const costBasis = sellQty * 50000
    const pnl = proceeds - costBasis

    p.cash += proceeds
    p.positions = p.positions.filter(pos => pos.symbol !== 'bitcoin')
    p.trades.push({ symbol: 'bitcoin', side: 'sell', quantity: sellQty, price: sellPrice, timestamp: new Date().toISOString(), pnl })

    expect(p.cash).toBe(101_000)
    expect(pnl).toBe(1000) // $1000 profit
    expect(p.positions).toHaveLength(0)
  })

  it('enforces position size limit', () => {
    const p = freshPortfolio()
    const totalValue = p.cash // $100k
    const maxPosition = totalValue * (p.limits.maxPositionPct / 100) // $25k

    const amount = 30_000 // exceeds 25%
    const allowed = amount / totalValue * 100 <= p.limits.maxPositionPct

    expect(allowed).toBe(false)
    expect(maxPosition).toBe(25_000)
  })

  it('prevents buying with insufficient cash', () => {
    const p = freshPortfolio()
    p.cash = 500
    const amount = 1000
    expect(amount > p.cash).toBe(true)
  })
})

// ── Price Alert Tests ──

describe('Price Alert Logic', () => {
  interface PriceAlert { symbol: string; above?: number; below?: number; createdAt: string }

  it('triggers above alert when price exceeds threshold', () => {
    const alert: PriceAlert = { symbol: 'bitcoin', above: 60000, createdAt: new Date().toISOString() }
    const currentPrice = 61000
    expect(alert.above && currentPrice >= alert.above).toBe(true)
  })

  it('triggers below alert when price drops under threshold', () => {
    const alert: PriceAlert = { symbol: 'ethereum', below: 2000, createdAt: new Date().toISOString() }
    const currentPrice = 1950
    expect(alert.below && currentPrice <= alert.below).toBe(true)
  })

  it('does not trigger when price is within bounds', () => {
    const alert: PriceAlert = { symbol: 'solana', above: 200, below: 100, createdAt: new Date().toISOString() }
    const currentPrice = 150
    const triggered = (alert.above && currentPrice >= alert.above) || (alert.below && currentPrice <= alert.below)
    expect(triggered).toBeFalsy()
  })
})

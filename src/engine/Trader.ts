// Trader Agent - Autonomous investing and trading
// Uses swarm revenue to grow capital through strategic investments

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface Position {
  id: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'etf';
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  entryDate: Date;
  pnl: number;
  pnlPercent: number;
}

export interface TradeSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedSize: number; // Percentage of portfolio
  timeframe: 'scalp' | 'swing' | 'position';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PortfolioState {
  cash: number;
  investedValue: number;
  totalValue: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  trades: Trade[];
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: Date;
  reason: string;
}

// Trading rules for the autonomous trader
const TRADING_RULES = {
  maxPositionSize: 0.2, // Max 20% of portfolio in single position
  maxDrawdown: 0.1, // Stop trading if down 10%
  minCashReserve: 0.2, // Always keep 20% in cash
  profitTakeThreshold: 0.15, // Take profits at 15%
  stopLossThreshold: 0.08, // Cut losses at 8%
  rebalanceThreshold: 0.25, // Rebalance if position grows to 25%
};

class TraderManager {
  private portfolio: PortfolioState = {
    cash: 0,
    investedValue: 0,
    totalValue: 0,
    positions: [],
    dailyPnL: 0,
    totalPnL: 0,
    trades: []
  };

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trader_portfolio');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.portfolio = {
          ...parsed,
          positions: parsed.positions.map((p: any) => ({
            ...p,
            entryDate: new Date(p.entryDate)
          })),
          trades: parsed.trades.map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp)
          }))
        };
      }
    }
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trader_portfolio', JSON.stringify(this.portfolio));
    }
  }

  // Deposit funds from treasury into trading account
  deposit(amount: number) {
    this.portfolio.cash += amount;
    this.portfolio.totalValue = this.portfolio.cash + this.portfolio.investedValue;
    this.saveState();
  }

  // Withdraw funds back to treasury
  withdraw(amount: number): boolean {
    if (amount > this.portfolio.cash) return false;
    this.portfolio.cash -= amount;
    this.portfolio.totalValue = this.portfolio.cash + this.portfolio.investedValue;
    this.saveState();
    return true;
  }

  getPortfolio(): PortfolioState {
    return { ...this.portfolio };
  }

  // Analyze market and generate trade signal
  async analyzeMarket(symbol: string, marketData?: string): Promise<TradeSignal> {
    const model = genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
    });

    const currentPosition = this.portfolio.positions.find(p => p.symbol === symbol);

    const prompt = `You are Trader, an AI quant analyst for an autonomous trading system.

Analyze this asset: ${symbol}

Current portfolio position: ${currentPosition ? `
- Entry: $${currentPosition.entryPrice}
- Current: $${currentPosition.currentPrice}
- P&L: ${currentPosition.pnlPercent.toFixed(2)}%
- Holding since: ${currentPosition.entryDate.toLocaleDateString()}
` : 'No position'}

Portfolio cash: $${this.portfolio.cash.toFixed(2)}
Total portfolio: $${this.portfolio.totalValue.toFixed(2)}

Trading rules:
- Max position size: ${TRADING_RULES.maxPositionSize * 100}%
- Stop loss: ${TRADING_RULES.stopLossThreshold * 100}%
- Take profit: ${TRADING_RULES.profitTakeThreshold * 100}%

${marketData ? `Market data/context: ${marketData}` : ''}

Provide a trading signal. Be conservative - the swarm's money is precious.

Respond in JSON:
{
  "symbol": "${symbol}",
  "action": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "suggestedSize": 0.0-0.2,
  "timeframe": "scalp" | "swing" | "position",
  "riskLevel": "low" | "medium" | "high"
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TradeSignal;
      }
    } catch (error) {
      console.error('Error analyzing market:', error);
    }

    return {
      symbol,
      action: 'hold',
      confidence: 0,
      reasoning: 'Analysis failed',
      suggestedSize: 0,
      timeframe: 'position',
      riskLevel: 'high'
    };
  }

  // Execute a trade (simulated for now)
  executeTrade(signal: TradeSignal, price: number): Trade | null {
    if (signal.action === 'hold') return null;
    if (signal.confidence < 60) return null; // Only trade on high confidence

    const maxSize = this.portfolio.totalValue * TRADING_RULES.maxPositionSize;
    const tradeSize = Math.min(
      this.portfolio.cash * signal.suggestedSize,
      maxSize
    );

    if (tradeSize < 10) return null; // Minimum trade size

    if (signal.action === 'buy') {
      const quantity = tradeSize / price;

      const trade: Trade = {
        id: `trade_${Date.now()}`,
        symbol: signal.symbol,
        side: 'buy',
        price,
        quantity,
        timestamp: new Date(),
        reason: signal.reasoning
      };

      // Update portfolio
      this.portfolio.cash -= tradeSize;

      const existingPosition = this.portfolio.positions.find(p => p.symbol === signal.symbol);
      if (existingPosition) {
        // Average into existing position
        const totalQuantity = existingPosition.quantity + quantity;
        const avgPrice = (existingPosition.entryPrice * existingPosition.quantity + price * quantity) / totalQuantity;
        existingPosition.quantity = totalQuantity;
        existingPosition.entryPrice = avgPrice;
      } else {
        // New position
        this.portfolio.positions.push({
          id: `pos_${Date.now()}`,
          symbol: signal.symbol,
          type: signal.symbol.includes('BTC') || signal.symbol.includes('ETH') ? 'crypto' : 'stock',
          side: 'long',
          entryPrice: price,
          currentPrice: price,
          quantity,
          entryDate: new Date(),
          pnl: 0,
          pnlPercent: 0
        });
      }

      this.portfolio.trades.push(trade);
      this.recalculatePortfolio();
      this.saveState();
      return trade;
    }

    if (signal.action === 'sell') {
      const position = this.portfolio.positions.find(p => p.symbol === signal.symbol);
      if (!position) return null;

      const sellQuantity = position.quantity * signal.suggestedSize;
      const proceeds = sellQuantity * price;

      const trade: Trade = {
        id: `trade_${Date.now()}`,
        symbol: signal.symbol,
        side: 'sell',
        price,
        quantity: sellQuantity,
        timestamp: new Date(),
        reason: signal.reasoning
      };

      // Update portfolio
      this.portfolio.cash += proceeds;
      position.quantity -= sellQuantity;

      if (position.quantity <= 0.0001) {
        // Close position
        this.portfolio.positions = this.portfolio.positions.filter(p => p.id !== position.id);
      }

      this.portfolio.trades.push(trade);
      this.recalculatePortfolio();
      this.saveState();
      return trade;
    }

    return null;
  }

  // Update position prices and calculate P&L
  updatePrice(symbol: string, newPrice: number) {
    const position = this.portfolio.positions.find(p => p.symbol === symbol);
    if (position) {
      position.currentPrice = newPrice;
      position.pnl = (newPrice - position.entryPrice) * position.quantity;
      position.pnlPercent = ((newPrice - position.entryPrice) / position.entryPrice) * 100;
    }
    this.recalculatePortfolio();
    this.saveState();
  }

  private recalculatePortfolio() {
    this.portfolio.investedValue = this.portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.quantity,
      0
    );
    this.portfolio.totalValue = this.portfolio.cash + this.portfolio.investedValue;
    this.portfolio.totalPnL = this.portfolio.positions.reduce((sum, p) => sum + p.pnl, 0);
  }

  // Check for stop-loss or take-profit triggers
  checkRiskManagement(): TradeSignal[] {
    const signals: TradeSignal[] = [];

    for (const position of this.portfolio.positions) {
      // Stop loss
      if (position.pnlPercent <= -TRADING_RULES.stopLossThreshold * 100) {
        signals.push({
          symbol: position.symbol,
          action: 'sell',
          confidence: 100,
          reasoning: `Stop loss triggered at ${position.pnlPercent.toFixed(2)}%`,
          suggestedSize: 1.0, // Sell entire position
          timeframe: 'scalp',
          riskLevel: 'high'
        });
      }

      // Take profit
      if (position.pnlPercent >= TRADING_RULES.profitTakeThreshold * 100) {
        signals.push({
          symbol: position.symbol,
          action: 'sell',
          confidence: 80,
          reasoning: `Take profit triggered at ${position.pnlPercent.toFixed(2)}%`,
          suggestedSize: 0.5, // Sell half
          timeframe: 'swing',
          riskLevel: 'low'
        });
      }
    }

    return signals;
  }

  // Get trading summary for dashboard
  getSummary(): string {
    const { cash, investedValue, totalValue, totalPnL, positions, trades } = this.portfolio;
    const pnlPercent = totalValue > 0 ? ((totalPnL / (totalValue - totalPnL)) * 100) : 0;

    return `
## Trading Portfolio

**Total Value:** $${totalValue.toFixed(2)}
**Cash:** $${cash.toFixed(2)}
**Invested:** $${investedValue.toFixed(2)}
**Total P&L:** $${totalPnL.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)

### Positions (${positions.length})
${positions.length === 0 ? '_No open positions_' : positions.map(p => `
- **${p.symbol}** | ${p.quantity.toFixed(4)} @ $${p.entryPrice.toFixed(2)}
  Current: $${p.currentPrice.toFixed(2)} | P&L: ${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%`).join('\n')}

### Recent Trades (${trades.length})
${trades.slice(-5).reverse().map(t => `
- ${t.side.toUpperCase()} ${t.symbol} | ${t.quantity.toFixed(4)} @ $${t.price.toFixed(2)}`).join('\n')}
`;
  }
}

export const trader = new TraderManager();

// Strategy: Allocate percentage of treasury profits to trading
export function calculateTradingAllocation(treasuryProfit: number): number {
  // Allocate 30% of profits to trading
  const allocationPercent = 0.3;
  // But cap at $1000 per allocation
  const maxAllocation = 1000;

  return Math.min(treasuryProfit * allocationPercent, maxAllocation);
}

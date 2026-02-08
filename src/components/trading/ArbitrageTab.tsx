import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Zap } from 'lucide-react';
import { dualCapitalEngine, type ArbitrageOpportunity } from '../../engine/DualCapitalPricing';
import type { LoopState } from '../../engine/AutonomousRevenueLoop';

interface ArbitrageTabProps {
  loopState: LoopState;
}

export function ArbitrageTab({ loopState }: ArbitrageTabProps) {
  const [arbitrageOpps, setArbitrageOpps] = useState<ArbitrageOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scanForOpportunities = async () => {
    setIsLoading(true);
    const opps = await dualCapitalEngine.findArbitrageOpportunities();
    setArbitrageOpps(opps);
    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Theory Banner */}
      <div className="p-6 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Dual-Capital Arbitrage</h2>
        <p className="opacity-80 mb-4">
          Capital is fungible, but capital markets are not. The spread between TradFi and DeFi is STRUCTURAL, not temporary.
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {((dualCapitalEngine.getMarketState().averageSpread) * 100).toFixed(1)}%
            </div>
            <div className="text-sm opacity-70">Average Spread</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">60%</div>
            <div className="text-sm opacity-70">Optimal DeFi Allocation</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">${loopState.totalArbitrageProfit.toFixed(2)}</div>
            <div className="text-sm opacity-70">Captured Profit</div>
          </div>
        </div>
      </div>

      {/* Market State */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
          <h3 className="text-xl mb-4 flex items-center gap-2">
            <DollarSign size={20} />
            TradFi Capital Sources
          </h3>
          <div className="space-y-3">
            {dualCapitalEngine.getMarketState().tradfiSources.map((source) => (
              <div key={source.id} className="p-3 bg-[--rubin-ivory] rounded flex items-center justify-between">
                <div>
                  <div className="font-semibold">{source.name}</div>
                  <div className="text-xs opacity-60">{source.settlementTime}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg">{((source.baseRate + source.riskPremium) * 100).toFixed(1)}%</div>
                  <div className="text-xs opacity-60">
                    ${source.minAmount.toLocaleString()} - ${source.maxAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
          <h3 className="text-xl mb-4 flex items-center gap-2">
            <Zap size={20} />
            DeFi Capital Sources
          </h3>
          <div className="space-y-3">
            {dualCapitalEngine.getMarketState().defiSources.map((source) => (
              <div key={source.id} className="p-3 bg-[--rubin-ivory] rounded flex items-center justify-between">
                <div>
                  <div className="font-semibold">{source.name}</div>
                  <div className="text-xs text-green-600">{source.settlementTime}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg text-green-600">{((source.baseRate + source.riskPremium) * 100).toFixed(1)}%</div>
                  <div className="text-xs opacity-60">
                    ${source.minAmount.toLocaleString()} - ${source.maxAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Arbitrage Opportunities */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl flex items-center gap-2">
            <TrendingUp size={20} />
            Live Arbitrage Opportunities
          </h3>
          <button
            onClick={scanForOpportunities}
            disabled={isLoading}
            className="px-4 py-2 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono text-sm disabled:opacity-50"
          >
            {isLoading ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>

        {arbitrageOpps.length === 0 && !isLoading && (
          <div className="text-center py-8 opacity-50">
            Click "Scan Now" to find arbitrage opportunities
          </div>
        )}

        {arbitrageOpps.length > 0 && (
          <div className="space-y-4">
            {arbitrageOpps.map((opp, i) => (
              <motion.div
                key={opp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 bg-[--rubin-ivory] rounded-lg border-l-4 border-green-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-lg">{opp.assetClass}</div>
                    <div className="text-sm opacity-70">{opp.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {(opp.spread * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm opacity-60">spread</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="opacity-50">Expected Profit</div>
                    <div className="font-semibold text-green-600">
                      ${opp.expectedProfit.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="opacity-50">Volume</div>
                    <div className="font-semibold">${opp.volume.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="opacity-50">Risk</div>
                    <div className={`font-semibold ${
                      opp.riskLevel === 'low' ? 'text-green-600' :
                      opp.riskLevel === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {opp.riskLevel.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="text-xs opacity-60">
                  <div className="mb-1"><strong>Execution:</strong> {opp.executionPath.join(' → ')}</div>
                  <div><strong>Compliance:</strong> {opp.complianceRequirements.join(', ')}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Theory Explanation */}
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-xl mb-4 text-blue-800">The Universal Financial Theory</h3>
        <div className="grid grid-cols-2 gap-6 text-sm text-blue-900">
          <div>
            <h4 className="font-bold mb-2">1. Pricing as Infrastructure</h4>
            <p className="opacity-80">NASDAQ did it for equities, Bloomberg for bonds, Stripe for payments. When pricing becomes a shared primitive, markets get more efficient.</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">2. Dual-Capital Thesis</h4>
            <p className="opacity-80">Every asset has two parallel funding sources. Optimal pricing requires simultaneous access to TradFi and DeFi pools.</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">3. AI as Market Infrastructure</h4>
            <p className="opacity-80">Autonomous agents maintain liquidity, execute arbitrage, and enforce compliance in real-time. Markets are evolving from human to agent-mediated.</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">4. Programmable Compliance</h4>
            <p className="opacity-80">Smart contract attestation makes compliance verifiable, instant, and composable—reducing cost of capital by eliminating counterparty uncertainty.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

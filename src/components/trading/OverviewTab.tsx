import { AlertTriangle } from 'lucide-react';
import { tradingBootstrap, TRADING_QUICKSTART } from '../../engine/TradingBootstrap';

export function OverviewTab() {
  const bootstrapState = tradingBootstrap.getState();
  const { ready, blockers } = tradingBootstrap.isReadyForRealTrading();

  return (
    <div className="space-y-8">
      {/* Bootstrap Status */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">PHASE</div>
          <div className="text-2xl font-semibold">{bootstrapState.phase.toUpperCase()}</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">PAPER TRADING DAYS</div>
          <div className="text-2xl font-semibold">{bootstrapState.paperTradingDays}/30</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">WIN RATE</div>
          <div className="text-2xl font-semibold">{(bootstrapState.winRate * 100).toFixed(1)}%</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">CAPITAL</div>
          <div className="text-2xl font-semibold">${bootstrapState.currentCapital.toFixed(2)}</div>
        </div>
      </div>

      {/* Blockers */}
      {!ready && blockers.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-yellow-600" size={18} />
            <div className="font-semibold text-yellow-800">Before Real Trading</div>
          </div>
          <ul className="list-disc list-inside text-sm text-yellow-700">
            {blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Quick Start Guide */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4">Quick Start</h3>
        <pre className="whitespace-pre-wrap text-sm opacity-80 font-mono">
          {TRADING_QUICKSTART}
        </pre>
      </div>
    </div>
  );
}

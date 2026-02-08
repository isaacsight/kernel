import { Zap, TrendingUp, Brain, Award } from 'lucide-react';
import { useTradingState } from '../hooks/useTradingState';
import { AutonomousTab } from './trading/AutonomousTab';
import { ArbitrageTab } from './trading/ArbitrageTab';
import { ReasoningTab } from './trading/ReasoningTab';
import { OverviewTab } from './trading/OverviewTab';
import { CryptoTab } from './trading/CryptoTab';
import { StocksTab } from './trading/StocksTab';
import { AIIncomeTab } from './trading/AIIncomeTab';
import { EvaluationTab } from './trading/EvaluationTab';

const TABS = ['autonomous', 'arbitrage', 'reasoning', 'evaluation', 'overview', 'crypto', 'stocks', 'ai-income'] as const;

export function TradingDashboard() {
  const state = useTradingState();
  const { activeTab, setActiveTab, loopState, strategistState, feedbackStats, isLoading, setIsLoading, cryptoPrices, loadCryptoPrices, targetRevenue, setTargetRevenue } = state;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl mb-2">Zero to Revenue Engine</h1>
          <p className="opacity-60 italic">AI-powered reasoning for financial decisions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="mono text-xs opacity-50">RLHF FEEDBACK</div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">+{feedbackStats.positive}</span>
              <span className="opacity-30">/</span>
              <span className="text-red-600">-{feedbackStats.negative}</span>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm ${
            strategistState.currentPhase === 'discovery' ? 'bg-blue-100 text-blue-800' :
            strategistState.currentPhase === 'first_dollar' ? 'bg-yellow-100 text-yellow-800' :
            strategistState.currentPhase === 'scaling' ? 'bg-green-100 text-green-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {strategistState.currentPhase.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">TOTAL EARNED</div>
          <div className="text-2xl font-semibold">${strategistState.totalEarned.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">ACTIVE OPPORTUNITIES</div>
          <div className="text-2xl font-semibold">{strategistState.activeOpportunities.filter(o => o.status === 'pursuing').length}</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">MILESTONES</div>
          <div className="text-2xl font-semibold">{strategistState.completedMilestones.length}</div>
        </div>
        <div className="p-4 bg-[--rubin-ivory-med] rounded-lg">
          <div className="mono text-xs opacity-50 mb-1">REASONING SESSIONS</div>
          <div className="text-2xl font-semibold">{strategistState.reasoningHistory.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-[--rubin-ivory-dark] overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 mono text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-[--rubin-slate]' : 'opacity-50'}`}
          >
            {tab === 'autonomous' && <Zap size={16} className={loopState.isRunning ? 'text-green-500 animate-pulse' : ''} />}
            {tab === 'arbitrage' && <TrendingUp size={16} />}
            {tab === 'reasoning' && <Brain size={16} />}
            {tab === 'evaluation' && <Award size={16} />}
            {tab.replace('-', ' ').toUpperCase()}
            {tab === 'autonomous' && loopState.isRunning && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'autonomous' && (
        <AutonomousTab loopState={loopState} targetRevenue={targetRevenue} setTargetRevenue={setTargetRevenue} />
      )}
      {activeTab === 'arbitrage' && (
        <ArbitrageTab loopState={loopState} />
      )}
      {activeTab === 'reasoning' && (
        <ReasoningTab state={state} />
      )}
      {activeTab === 'evaluation' && <EvaluationTab />}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'crypto' && (
        <CryptoTab cryptoPrices={cryptoPrices} isLoading={isLoading} onRefresh={loadCryptoPrices} />
      )}
      {activeTab === 'stocks' && <StocksTab />}
      {activeTab === 'ai-income' && (
        <AIIncomeTab isLoading={isLoading} setIsLoading={setIsLoading} />
      )}
    </div>
  );
}

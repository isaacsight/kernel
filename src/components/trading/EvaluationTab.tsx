import { motion } from 'framer-motion';
import { Award, BarChart3, Trophy, Clock, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useEvaluationState } from '../../hooks/useEvaluationState';
import { evaluationEngine, type EntityType, type Tier, type CategoryType } from '../../engine/EvaluationEngine';

const TIER_COLORS: Record<Tier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  project: 'Project',
  opportunity: 'Opportunity',
  agent: 'Agent',
  income_stream: 'Income Stream',
  trade: 'Trade',
};

const CATEGORY_LABELS: Record<CategoryType, string> = {
  complexity: 'Complexity',
  market_demand: 'Market Demand',
  risk: 'Risk',
  profitability: 'Profitability',
  time_efficiency: 'Time Efficiency',
  innovation: 'Innovation',
};

export function EvaluationTab() {
  const {
    evaluations,
    allEvaluations,
    selectedEvaluation,
    isLoading,
    error,
    form,
    setForm,
    filters,
    setFilters,
    runEvaluation,
    selectEvaluation,
    updateOutcome,
    loadRankings,
    getReport,
    runAIEvaluation,
  } = useEvaluationState();

  const report = getReport(filters.filterType !== 'all' ? filters.filterType : undefined);
  const rankings = loadRankings(filters.filterType !== 'all' ? filters.filterType : undefined);
  const tierConfigs = evaluationEngine.getTierConfigs();

  return (
    <div className="space-y-8">
      {/* Score Dashboard */}
      <div className="p-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1F1E1D 0%, #2a2928 100%)' }}>
        <div className="flex items-center gap-3 mb-4">
          <Award size={24} color="#FFD700" />
          <h2 className="text-xl text-[--rubin-ivory]">Evaluation Dashboard</h2>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <div className="mono text-xs text-[--rubin-ivory] opacity-50">AVG SCORE</div>
            <div className="text-2xl font-semibold text-[--rubin-ivory]">{report.averageScore.toFixed(1)}</div>
          </div>
          <div>
            <div className="mono text-xs text-[--rubin-ivory] opacity-50">TOTAL EVALUATED</div>
            <div className="text-2xl font-semibold text-[--rubin-ivory]">{report.totalEvaluations}</div>
          </div>
          <div>
            <div className="mono text-xs text-[--rubin-ivory] opacity-50">SUCCESS RATE</div>
            <div className="text-2xl font-semibold text-[--rubin-ivory]">{(report.successRate * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="mono text-xs text-[--rubin-ivory] opacity-50">TREND</div>
            <div className="text-2xl font-semibold text-[--rubin-ivory]">
              {report.recentTrend === 'improving' ? '↑' : report.recentTrend === 'declining' ? '↓' : '→'}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {tierConfigs.map(tc => (
            <div key={tc.tier} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: tc.color }}
              />
              <span className="mono text-xs text-[--rubin-ivory] opacity-70">
                {tc.badge}: {report.tierDistribution[tc.tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluate Form */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Run Evaluation
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="mono text-xs opacity-50 block mb-2">ENTITY TYPE</label>
            <select
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value as EntityType })}
              className="w-full px-4 py-2 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
            >
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map(t => (
                <option key={t} value={t}>{ENTITY_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mono text-xs opacity-50 block mb-2">BASE PRICE (optional)</label>
            <input
              type="number"
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              placeholder="$500"
              className="w-full px-4 py-2 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={runEvaluation}
                disabled={isLoading || !form.description.trim()}
                className="w-full px-6 py-2 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {isLoading ? 'Wait...' : 'Heuristic'}
              </button>
              <button
                onClick={() => runAIEvaluation()}
                disabled={isLoading || !form.description.trim()}
                className="w-full px-6 py-2 bg-[#8B5CF6] text-[--rubin-ivory] rounded-lg mono disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {isLoading ? 'Wait...' : <><Sparkles size={14} /> AI Review</>}
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="mono text-xs opacity-50 block mb-2">DESCRIPTION</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the project, opportunity, trade, or entity to evaluate..."
            rows={3}
            className="w-full px-4 py-3 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg resize-none"
          />
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        )}
      </div>

      {/* Results Display */}
      {selectedEvaluation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-[--rubin-ivory-med] rounded-lg"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl flex items-center gap-2">
              <Award size={20} />
              Evaluation Result
            </h3>
            <div
              className="px-4 py-2 rounded-full mono text-sm font-semibold"
              style={{
                backgroundColor: TIER_COLORS[selectedEvaluation.tier] + '20',
                color: selectedEvaluation.tier === 'platinum' || selectedEvaluation.tier === 'silver' ? '#1F1E1D' : TIER_COLORS[selectedEvaluation.tier],
                border: `2px solid ${TIER_COLORS[selectedEvaluation.tier]}`,
              }}
            >
              {selectedEvaluation.tier.toUpperCase()} — {selectedEvaluation.weightedScore} pts
            </div>
          </div>

          {/* Overall Score Bar */}
          <div className="mb-6">
            <div className="flex justify-between mb-1">
              <span className="mono text-xs opacity-50">WEIGHTED SCORE</span>
              <span className="mono text-sm font-semibold">{selectedEvaluation.weightedScore}/100</span>
            </div>
            <div className="w-full h-4 bg-[--rubin-ivory] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${selectedEvaluation.weightedScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: TIER_COLORS[selectedEvaluation.tier] }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3 mb-6">
            <div className="mono text-xs opacity-50">CATEGORY BREAKDOWN</div>
            {selectedEvaluation.categoryScores.map((cs, i) => (
              <div key={cs.category}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">{CATEGORY_LABELS[cs.category]}</span>
                  <span className="mono text-xs">
                    {cs.score} × {(cs.weight * 100).toFixed(0)}% = {Math.round(cs.score * cs.weight)}
                  </span>
                </div>
                <div className="w-full h-2 bg-[--rubin-ivory] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cs.score}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cs.score >= 70 ? '#22c55e' : cs.score >= 40 ? '#eab308' : '#ef4444' }}
                  />
                </div>
                <div className="text-xs opacity-50 mt-1">{cs.reasoning}</div>
              </div>
            ))}
          </div>

          {/* Pricing Impact */}
          {selectedEvaluation.basePrice != null && (
            <div className="p-4 bg-[--rubin-ivory] rounded-lg">
              <div className="mono text-xs opacity-50 mb-2">PRICING IMPACT</div>
              <div className="flex items-center gap-3 text-lg">
                <span>${selectedEvaluation.basePrice.toFixed(2)}</span>
                <span className="opacity-40">×</span>
                <span className="font-semibold" style={{ color: TIER_COLORS[selectedEvaluation.tier] }}>
                  {selectedEvaluation.pricingMultiplier}x
                </span>
                <span className="opacity-40">=</span>
                <span className="text-xl font-bold">${selectedEvaluation.finalPrice?.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Confidence */}
          <div className="mt-4 flex items-center gap-2 text-sm opacity-60">
            <span className="mono text-xs">CONFIDENCE:</span>
            <span>{(selectedEvaluation.confidence * 100).toFixed(0)}%</span>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <label className="mono text-xs opacity-50 block mb-1">FILTER BY TYPE</label>
          <select
            value={filters.filterType}
            onChange={(e) => setFilters({ ...filters, filterType: e.target.value as EntityType | 'all' })}
            className="px-3 py-1 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            {(Object.keys(ENTITY_LABELS) as EntityType[]).map(t => (
              <option key={t} value={t}>{ENTITY_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mono text-xs opacity-50 block mb-1">FILTER BY TIER</label>
          <select
            value={filters.filterTier}
            onChange={(e) => setFilters({ ...filters, filterTier: e.target.value as Tier | 'all' })}
            className="px-3 py-1 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg text-sm"
          >
            <option value="all">All Tiers</option>
            {tierConfigs.map(tc => (
              <option key={tc.tier} value={tc.tier}>{tc.badge}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard */}
      {rankings.length > 0 && (
        <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
          <h3 className="text-xl mb-4 flex items-center gap-2">
            <Trophy size={20} />
            Leaderboard
          </h3>
          <div className="space-y-2">
            {rankings.map(({ evaluation: e, rank, percentile }) => (
              <div
                key={e.id}
                onClick={() => selectEvaluation(e.id)}
                className="p-3 bg-[--rubin-ivory] rounded-lg flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="mono text-lg font-bold w-8 text-center opacity-50">#{rank}</div>
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TIER_COLORS[e.tier] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{e.entityDescription}</div>
                  <div className="mono text-xs opacity-50">{ENTITY_LABELS[e.entityType]}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="mono font-semibold">{e.weightedScore}</div>
                  <div className="mono text-xs opacity-50">P{percentile}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Timeline */}
      {evaluations.length > 0 && (
        <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
          <h3 className="text-xl mb-4 flex items-center gap-2">
            <Clock size={20} />
            History
          </h3>
          <div className="space-y-2">
            {evaluations.slice(0, 20).map(e => (
              <div
                key={e.id}
                onClick={() => selectEvaluation(e.id)}
                className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-opacity hover:opacity-80 ${selectedEvaluation?.id === e.id ? 'bg-[--rubin-ivory] ring-2 ring-[--rubin-slate]' : 'bg-[--rubin-ivory]'
                  }`}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TIER_COLORS[e.tier] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{e.entityDescription}</div>
                  <div className="mono text-xs opacity-50">
                    {ENTITY_LABELS[e.entityType]} — {e.timestamp.toLocaleDateString()} {e.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="mono text-sm font-semibold flex-shrink-0">{e.weightedScore}</div>
                {e.outcome ? (
                  e.outcome.success ? (
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-600 flex-shrink-0" />
                  )
                ) : (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      updateOutcome(e.id, true);
                    }}
                    className="text-xs mono opacity-40 hover:opacity-100 flex-shrink-0"
                    title="Mark as success"
                  >
                    outcome?
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="mono text-xs opacity-50 mb-2">RECOMMENDATIONS</div>
          <ul className="space-y-1 text-sm">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="text-blue-800">• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

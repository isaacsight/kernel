import { motion } from 'framer-motion';
import { Brain, Target, Zap } from 'lucide-react';
import { ThinkingTrace } from './ThinkingTrace';
import { FeedbackButtons } from './FeedbackButtons';
import type { UseTradingState } from '../../hooks/useTradingState';

interface ReasoningTabProps {
  state: UseTradingState;
}

export function ReasoningTab({ state }: ReasoningTabProps) {
  const {
    isLoading,
    reasoningResult,
    opportunityInput, setOpportunityInput,
    skills, setSkills,
    hoursPerDay, setHoursPerDay,
    riskTolerance, setRiskTolerance,
    strategistState,
    feedbackStats, setFeedbackStats,
    getPhaseAdvice,
    evaluateOpportunity,
    createStrategy,
    getTodaysPlan,
  } = state;

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={getPhaseAdvice}
          disabled={isLoading}
          className="p-4 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg flex items-center gap-3 hover:opacity-90 disabled:opacity-50"
        >
          <Target size={24} />
          <div className="text-left">
            <div className="font-semibold">Get Phase Advice</div>
            <div className="text-sm opacity-70">What should I focus on right now?</div>
          </div>
        </button>

        <button
          onClick={getTodaysPlan}
          disabled={isLoading}
          className="p-4 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg flex items-center gap-3 hover:opacity-90 disabled:opacity-50"
        >
          <Zap size={24} />
          <div className="text-left">
            <div className="font-semibold">Today's Plan</div>
            <div className="text-sm opacity-70">Optimal schedule for {hoursPerDay} hours</div>
          </div>
        </button>
      </div>

      {/* Evaluate Opportunity */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4 flex items-center gap-2">
          <Brain size={20} />
          Evaluate Opportunity
        </h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={opportunityInput}
            onChange={(e) => setOpportunityInput(e.target.value)}
            placeholder="Describe an opportunity to evaluate..."
            className="flex-1 px-4 py-3 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
          />
          <button
            onClick={evaluateOpportunity}
            disabled={isLoading || !opportunityInput.trim()}
            className="px-6 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono disabled:opacity-50"
          >
            Analyze
          </button>
        </div>
      </div>

      {/* Create Strategy */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4">Create Bootstrap Strategy</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="mono text-xs opacity-50 block mb-2">YOUR SKILLS</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="coding, writing, design..."
              className="w-full px-4 py-2 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
            />
          </div>
          <div>
            <label className="mono text-xs opacity-50 block mb-2">HOURS/DAY</label>
            <input
              type="number"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              min={1}
              max={16}
              className="w-full px-4 py-2 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
            />
          </div>
          <div>
            <label className="mono text-xs opacity-50 block mb-2">RISK TOLERANCE</label>
            <select
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value as 'conservative' | 'moderate' | 'aggressive')}
              className="w-full px-4 py-2 bg-[--rubin-ivory] border border-[--rubin-ivory-dark] rounded-lg"
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
        </div>
        <button
          onClick={createStrategy}
          disabled={isLoading}
          className="px-6 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono disabled:opacity-50"
        >
          Generate Strategy
        </button>
      </div>

      {/* Reasoning Result */}
      {reasoningResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-[--rubin-ivory-med] rounded-lg"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl flex items-center gap-2">
              <Brain size={20} />
              {reasoningResult.type === 'phase_advice' && 'Phase Advice'}
              {reasoningResult.type === 'opportunity' && 'Opportunity Analysis'}
              {reasoningResult.type === 'strategy' && 'Bootstrap Strategy'}
              {reasoningResult.type === 'today' && "Today's Plan"}
            </h3>
            <FeedbackButtons
              reasoningId={reasoningResult.id}
              context={reasoningResult.type}
              conclusion={reasoningResult.data.conclusion || reasoningResult.data.advice || ''}
              onFeedback={() => setFeedbackStats({ ...feedbackStats })}
            />
          </div>

          {/* Thinking Trace */}
          {reasoningResult.data.thinking && (
            <div className="mb-6">
              <ThinkingTrace steps={reasoningResult.data.thinking} />
            </div>
          )}

          {/* Phase Advice Result */}
          {reasoningResult.type === 'phase_advice' && (
            <div className="space-y-4">
              <div className="p-4 bg-[--rubin-ivory] rounded-lg">
                <div className="mono text-xs opacity-50 mb-2">RECOMMENDATION</div>
                <div className="text-lg">{reasoningResult.data.advice}</div>
              </div>
              <div>
                <div className="mono text-xs opacity-50 mb-2">NEXT ACTIONS</div>
                <ul className="list-disc list-inside space-y-1">
                  {reasoningResult.data.nextActions?.map((action: string, i: number) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 bg-green-50 rounded text-green-800 text-sm">
                {reasoningResult.data.expectedOutcome}
              </div>
            </div>
          )}

          {/* Opportunity Result */}
          {reasoningResult.type === 'opportunity' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${reasoningResult.data.shouldPursue ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="text-2xl font-bold mb-2">
                  {reasoningResult.data.shouldPursue ? 'PURSUE' : 'PASS'}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="opacity-60">Expected Value:</span>
                    <span className="font-semibold ml-2">${reasoningResult.data.expectedValue}</span>
                  </div>
                  <div>
                    <span className="opacity-60">Priority:</span>
                    <span className="font-semibold ml-2">{reasoningResult.data.priority || 'N/A'}/10</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="mono text-xs opacity-50 mb-2">NEXT STEP</div>
                <div className="p-3 bg-[--rubin-ivory] rounded">{reasoningResult.data.nextStep}</div>
              </div>
            </div>
          )}

          {/* Strategy Result */}
          {reasoningResult.type === 'strategy' && reasoningResult.data.strategy && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-semibold text-blue-800 mb-2">First Action</div>
                <div className="text-blue-900">{reasoningResult.data.immediateAction}</div>
              </div>
              <div>
                <div className="mono text-xs opacity-50 mb-2">PHASES</div>
                <div className="space-y-3">
                  {reasoningResult.data.strategy.phases?.map((phase: any, i: number) => (
                    <div key={i} className="p-3 bg-[--rubin-ivory] rounded">
                      <div className="font-semibold">{phase.name}</div>
                      <div className="text-sm opacity-70">{phase.goal}</div>
                      <div className="text-xs mono mt-1">
                        Expected: ${phase.expectedRevenue} in {phase.timeframe}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded text-center">
                  <div className="text-2xl font-bold text-green-700">
                    ${reasoningResult.data.strategy.thirtyDayTarget}
                  </div>
                  <div className="text-sm text-green-600">30-day target</div>
                </div>
                <div className="p-3 bg-green-50 rounded text-center">
                  <div className="text-2xl font-bold text-green-700">
                    ${reasoningResult.data.strategy.ninetyDayTarget}
                  </div>
                  <div className="text-sm text-green-600">90-day target</div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Plan Result */}
          {reasoningResult.type === 'today' && (
            <div className="space-y-4">
              <div>
                <div className="mono text-xs opacity-50 mb-2">PRIORITIES</div>
                <div className="space-y-2">
                  {reasoningResult.data.priorities?.map((p: any, i: number) => (
                    <div key={i} className="p-3 bg-[--rubin-ivory] rounded flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{p.task}</div>
                        <div className="text-sm opacity-70">{p.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">${p.expectedValue}</div>
                        <div className="text-xs opacity-50">{p.timeRequired}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mono text-xs opacity-50 mb-2">SCHEDULE</div>
                <div className="space-y-1">
                  {reasoningResult.data.schedule?.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 text-sm">
                      <span className="mono w-20">{s.time}</span>
                      <span className="flex-1">{s.task}</span>
                      <span className="opacity-50">{s.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Reasoning History */}
      {strategistState.reasoningHistory.length > 0 && (
        <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
          <h3 className="text-xl mb-4">Recent Reasoning Sessions</h3>
          <div className="space-y-3">
            {strategistState.reasoningHistory.slice(-5).reverse().map((r, i) => (
              <div key={i} className="p-3 bg-[--rubin-ivory] rounded flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{r.question.slice(0, 50)}...</div>
                  <div className="text-sm opacity-70 mt-1">{r.conclusion.slice(0, 100)}...</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs ${r.outcome === 'success' ? 'bg-green-100 text-green-700' :
                    r.outcome === 'failure' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                  }`}>
                  {r.outcome || 'pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { motion } from 'framer-motion';
import { Play, Pause, Activity, AlertTriangle, Zap } from 'lucide-react';
import { autonomousLoop, type LoopState } from '../../engine/AutonomousRevenueLoop';

interface AutonomousTabProps {
  loopState: LoopState;
  targetRevenue: number;
  setTargetRevenue: (v: number) => void;
}

export function AutonomousTab({ loopState, targetRevenue, setTargetRevenue }: AutonomousTabProps) {
  return (
    <div className="space-y-8">
      {/* Main Control */}
      <div className="p-6 bg-gradient-to-r from-[--rubin-slate] to-gray-800 text-[--rubin-ivory] rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Autonomous Revenue Loop</h2>
            <p className="opacity-70">AI continuously scans, evaluates, and pursues income opportunities</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${loopState.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}>
            {loopState.isRunning ? 'RUNNING' : 'STOPPED'}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">${loopState.revenue.toFixed(2)}</div>
            <div className="text-sm opacity-70">Revenue</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{loopState.cycleCount}</div>
            <div className="text-sm opacity-70">Cycles</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{loopState.totalOpportunitiesFound}</div>
            <div className="text-sm opacity-70">Opportunities</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{loopState.totalOutreachSent}</div>
            <div className="text-sm opacity-70">Outreach Sent</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress to ${targetRevenue} target</span>
            <span>{((loopState.revenue / targetRevenue) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (loopState.revenue / targetRevenue) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-70">Target $</label>
            <input
              type="number"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(Number(e.target.value))}
              className="w-24 px-3 py-2 bg-white/10 rounded text-white border border-white/20"
              min={1}
            />
          </div>
          <div className="flex-1" />
          {!loopState.isRunning ? (
            <button
              onClick={() => autonomousLoop.start({ targetRevenue, enableOutreach: true })}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              <Play size={20} />
              START LOOP
            </button>
          ) : (
            <button
              onClick={() => autonomousLoop.stop()}
              className="px-8 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              <Pause size={20} />
              STOP
            </button>
          )}
        </div>
      </div>

      {/* Current Action */}
      {loopState.isRunning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3"
        >
          <Activity className="text-blue-500 animate-spin" size={20} />
          <div>
            <div className="font-semibold text-blue-800">Current Action</div>
            <div className="text-blue-600">{loopState.currentAction}</div>
          </div>
        </motion.div>
      )}

      {/* Action Log */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4 flex items-center gap-2">
          <Activity size={20} />
          Activity Log
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loopState.actionLog.length === 0 ? (
            <div className="text-center py-8 opacity-50">
              No activity yet. Start the loop to begin generating revenue.
            </div>
          ) : (
            loopState.actionLog.slice().reverse().map((action, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 bg-[--rubin-ivory] rounded flex items-start gap-3"
              >
                <span className="mono text-xs opacity-50 w-16 flex-shrink-0">
                  {action.timestamp.toLocaleTimeString()}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  action.action === 'REVENUE!' ? 'bg-green-500 text-white' :
                  action.action === 'Error' ? 'bg-red-100 text-red-700' :
                  action.action === 'Outreach' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {action.action}
                </span>
                <span className="text-sm flex-1">{action.result}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h3 className="text-xl mb-4">How It Works</h3>
        <div className="grid grid-cols-5 gap-4">
          {[
            { step: '1', title: 'Scan', desc: 'Search Reddit, Twitter for people needing help' },
            { step: '2', title: 'Evaluate', desc: 'AI reasoning determines expected value' },
            { step: '3', title: 'Outreach', desc: 'Craft and send personalized messages' },
            { step: '4', title: 'Track', desc: 'Monitor for responses and conversions' },
            { step: '5', title: 'Learn', desc: 'Improve strategy based on results' }
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-10 h-10 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                {item.step}
              </div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-xs opacity-60">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {loopState.errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-500" size={18} />
            <div className="font-semibold text-red-800">Errors ({loopState.errors.length})</div>
          </div>
          <div className="space-y-1 text-sm text-red-700">
            {loopState.errors.slice(-5).map((err, i) => (
              <div key={i}>- {err}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

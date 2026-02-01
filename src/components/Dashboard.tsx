import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { treasury, type TreasuryState } from '../engine/Treasury';
import { formatPrice } from '../engine/StripeClient';

export function Dashboard() {
  const [state, setState] = useState<TreasuryState>(treasury.getState());

  useEffect(() => {
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      setState(treasury.getState());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const profit = state.totalRevenue - state.totalExpenses;
  const profitMargin = state.totalRevenue > 0 ? ((profit / state.totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl">Swarm Treasury</h1>
        <div className="mono text-sm opacity-50">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<DollarSign />}
          label="Balance"
          value={formatPrice(state.balance)}
          color="#2E8B57"
        />
        <MetricCard
          icon={<TrendingUp />}
          label="Revenue"
          value={formatPrice(state.totalRevenue)}
          color="#4A9B7F"
        />
        <MetricCard
          icon={<CheckCircle />}
          label="Completed"
          value={state.projectsCompleted.toString()}
          color="#7B68EE"
        />
        <MetricCard
          icon={<Clock />}
          label="In Progress"
          value={state.projectsInProgress.toString()}
          color="#E07B53"
        />
      </div>

      {/* Profit Summary */}
      <div className="bg-[--rubin-ivory-med] rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <div className="mono text-sm opacity-50">NET PROFIT</div>
            <div className="text-4xl font-medium">{formatPrice(profit)}</div>
          </div>
          <div className="text-right">
            <div className="mono text-sm opacity-50">MARGIN</div>
            <div className="text-4xl font-medium">{profitMargin}%</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <div className="bg-[--rubin-ivory-med] rounded-lg p-6">
          <h3 className="mono text-sm opacity-50 mb-4">RECENT TRANSACTIONS</h3>
          {state.transactions.length === 0 ? (
            <div className="text-center py-8 opacity-50 italic">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-3">
              {state.transactions.slice(-5).reverse().map((txn) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-between items-center py-2 border-b border-[--rubin-ivory-dark] last:border-none"
                >
                  <div className="flex items-center gap-3">
                    {txn.type === 'income' ? (
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <TrendingUp size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                        <AlertCircle size={16} />
                      </div>
                    )}
                    <div>
                      <div className="text-sm">{txn.description.slice(0, 30)}...</div>
                      <div className="mono text-xs opacity-50">
                        {txn.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className={`font-medium ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.type === 'income' ? '+' : '-'}{formatPrice(txn.amount)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="bg-[--rubin-ivory-med] rounded-lg p-6">
          <h3 className="mono text-sm opacity-50 mb-4">ACTIVE PROJECTS</h3>
          {state.projects.filter(p => p.status !== 'completed').length === 0 ? (
            <div className="text-center py-8 opacity-50 italic">
              No active projects
            </div>
          ) : (
            <div className="space-y-3">
              {state.projects
                .filter(p => p.status !== 'completed')
                .slice(-5)
                .reverse()
                .map((project) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="py-3 border-b border-[--rubin-ivory-dark] last:border-none"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm font-medium">
                        {project.quote.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="text-xs opacity-60 mb-2">
                      {project.description.slice(0, 50)}...
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="mono text-xs opacity-50">
                        {project.clientEmail}
                      </div>
                      <div className="font-medium text-sm">
                        {formatPrice(project.quote.total)}
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[--rubin-ivory-med] rounded-lg p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
        <span className="mono text-xs opacity-50">{label}</span>
      </div>
      <div className="text-2xl font-medium">{value}</div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    quoted: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    paid: { bg: 'bg-blue-100', text: 'text-blue-700' },
    in_progress: { bg: 'bg-purple-100', text: 'text-purple-700' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-700' }
  };

  const { bg, text } = colors[status] || colors.quoted;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs mono ${bg} ${text}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

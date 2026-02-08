import { useState } from 'react';
import { AI_INCOME_STREAMS } from '../../engine/AIOnlyIncome';

interface AIIncomeTabProps {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

export function AIIncomeTab({ isLoading, setIsLoading }: AIIncomeTabProps) {
  const [incomeResults, setIncomeResults] = useState<any[]>([]);

  const runIncomeStream = async (streamId: string) => {
    const stream = AI_INCOME_STREAMS.find(s => s.id === streamId);
    if (!stream) return;

    setIsLoading(true);
    try {
      const result = await stream.execute();
      setIncomeResults(prev => [...prev, { stream: stream.name, result, timestamp: new Date() }]);
    } catch (error) {
      console.error(`Error running ${stream.name}:`, error);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
        <div className="font-semibold text-blue-800 mb-2">AI-Only Income Streams</div>
        <div className="text-sm text-blue-700">
          These are income opportunities that only AI can execute profitably due to speed, scale, or 24/7 operation.
        </div>
      </div>

      <div className="grid gap-4">
        {AI_INCOME_STREAMS.map(stream => (
          <div key={stream.id} className="p-4 bg-[--rubin-ivory-med] rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{stream.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${stream.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      stream.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                    {stream.difficulty}
                  </span>
                  {stream.automated && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      automated
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-70 mb-2">{stream.description}</p>
                <div className="flex gap-4 text-xs mono">
                  <span>Startup: ${stream.startupCost}</span>
                  <span>Potential: {stream.monthlyPotential}/mo</span>
                  <span>Time to $1: {stream.timeToFirstDollar}</span>
                </div>
                <div className="text-xs opacity-50 mt-2 italic">
                  Why AI: {stream.whyAIOnly}
                </div>
              </div>
              <button
                onClick={() => runIncomeStream(stream.id)}
                disabled={isLoading}
                className="px-4 py-2 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono text-sm disabled:opacity-50"
              >
                Run
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Results */}
      {incomeResults.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl mb-4">Results</h3>
          <div className="space-y-4">
            {incomeResults.slice().reverse().map((result, i) => (
              <div key={i} className="p-4 bg-[--rubin-ivory-med] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{result.stream}</span>
                  <span className="mono text-xs opacity-50">
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

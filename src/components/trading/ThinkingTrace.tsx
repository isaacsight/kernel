import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';
import type { ThinkingStep } from '../../engine/ReasoningEngine';

const typeColors: Record<string, string> = {
  observation: 'bg-blue-100 text-blue-700',
  analysis: 'bg-purple-100 text-purple-700',
  hypothesis: 'bg-yellow-100 text-yellow-700',
  calculation: 'bg-green-100 text-green-700',
  conclusion: 'bg-slate-800 text-white'
};

export function ThinkingTrace({ steps, isExpanded = true }: { steps: ThinkingStep[]; isExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(isExpanded);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mono text-xs opacity-60 hover:opacity-100"
      >
        <Brain size={14} />
        {expanded ? 'Hide' : 'Show'} Thinking ({steps.length} steps)
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 pl-4 border-l-2 border-[--rubin-ivory-dark]"
          >
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-2"
              >
                <span className={`px-2 py-0.5 rounded text-[10px] mono ${typeColors[step.type] || 'bg-gray-100'}`}>
                  {step.type}
                </span>
                <span className="text-sm italic opacity-80">{step.thought}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

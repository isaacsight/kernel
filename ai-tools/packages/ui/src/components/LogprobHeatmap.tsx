
import React from 'react';

export interface LogprobHeatmapProps {
    tokens: { text: string; logprob?: number }[];
    className?: string;
}

export const LogprobHeatmap: React.FC<LogprobHeatmapProps> = ({ tokens, className = '' }) => {
    return (
        <div className={`flex flex-wrap gap-1 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 ${className}`}>
            {tokens.map((token, i) => {
                // Calculate color based on logprob (0 is high conf, -inf is low)
                // Usually > -0.1 is very high confidence (green)
                // -0.1 to -1 is medium (yellow)
                // < -1 is low (red)

                let bgClass = 'bg-gray-100 dark:bg-zinc-800';
                const p = token.logprob ?? 0;

                if (p > -0.1) bgClass = 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100';
                else if (p > -0.5) bgClass = 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100';
                else bgClass = 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100';

                return (
                    <span
                        key={i}
                        className={`px-1 rounded text-sm font-mono cursor-help transition-all hover:scale-110 ${bgClass}`}
                        title={`Token: "${token.text}"\nLogprob: ${p.toFixed(4)}\nProb: ${(Math.exp(p) * 100).toFixed(1)}%`}
                    >
                        {token.text}
                    </span>
                );
            })}
        </div>
    );
};

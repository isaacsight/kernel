
import React from 'react';

export interface TokenCandidate {
    token: string;
    logprob: number;
    prob: number; // Percentage 0-100
}

interface TokenInspectorProps {
    token: string;
    logprob: number; // The chosen token's logprob
    candidates?: TokenCandidate[];
    className?: string;
}

export const TokenInspector: React.FC<TokenInspectorProps> = ({
    token,
    logprob,
    candidates = [],
    className = ''
}) => {
    // Calculate chosen token probability
    const chosenProb = Math.exp(logprob) * 100;

    return (
        <div className={`p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-xs w-64 ${className}`}>
            <div className="mb-2 pb-2 border-b border-zinc-800 flex justify-between items-center">
                <span className="font-mono text-white bg-zinc-800 px-1 rounded">"{token}"</span>
                <span className={`font-bold ${chosenProb > 80 ? 'text-green-400' : chosenProb > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {chosenProb.toFixed(1)}%
                </span>
            </div>

            {candidates.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Alternative Paths</span>
                    {candidates.map((cand, i) => (
                        <div key={i} className="flex flex-col gap-0.5 relative group">
                            <div className="flex justify-between text-zinc-300">
                                <span className="font-mono truncate max-w-[70%]">"{cand.token}"</span>
                                <span>{cand.prob.toFixed(1)}%</span>
                            </div>
                            {/* Bar */}
                            <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(cand.prob, 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-zinc-500 italic">No alternative logits available</div>
            )}
        </div>
    );
};

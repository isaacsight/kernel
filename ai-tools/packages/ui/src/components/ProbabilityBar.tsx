
import React from 'react';

export interface ProbabilityBarProps {
    label: string;
    probability: number; // 0 to 1
    color?: string;
}

export const ProbabilityBar: React.FC<ProbabilityBarProps> = ({
    label,
    probability,
    color = 'bg-blue-500'
}) => {
    return (
        <div className="flex items-center gap-3 text-xs font-mono w-full">
            <span className="w-24 text-zinc-500 truncate text-right shrink-0">{label}</span>
            <div className="flex-grow h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                <div
                    className={`h-full ${color} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(0, probability * 100))}%` }}
                />
            </div>
            <span className="w-12 text-right text-zinc-300 shrink-0">{(probability * 100).toFixed(1)}%</span>
        </div>
    );
};

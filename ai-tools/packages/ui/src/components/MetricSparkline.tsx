
import React from 'react';

export interface MetricSparklineProps {
    data: number[];
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
}

export const MetricSparkline: React.FC<MetricSparklineProps> = ({
    data,
    label,
    value,
    trend,
    color = '#3b82f6'
}) => {
    const max = Math.max(...data, 1);
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - (d / max) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg relative overflow-hidden group">
            <div className="relative z-10 flex justify-between items-end mb-2">
                <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{label}</h4>
                    <div className="text-2xl font-mono text-white mt-1">{value}</div>
                </div>
                {trend && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded
                ${trend === 'up' ? 'bg-green-500/20 text-green-400' :
                            trend === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-500/20 text-zinc-400'}
            `}>
                        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '-'}
                    </span>
                )}
            </div>

            {/* Sparkline SVG */}
            <div className="h-12 -mx-4 -mb-4 opacity-50 group-hover:opacity-80 transition-opacity">
                <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                    <polygon
                        points={`0,100 ${points} 100,100`}
                        fill={color}
                        className="opacity-20"
                    />
                </svg>
            </div>
        </div>
    );
};

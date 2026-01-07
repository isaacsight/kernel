import React from 'react';
import { Tile, ProgressBar } from '@carbon/react';
import type { ReactNode } from 'react';

interface MetricTileProps {
    label: string;
    value: string;
    subValue?: string;
    progress?: number;
    icon?: ReactNode;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
}

const MetricTile: React.FC<MetricTileProps> = ({
    label,
    value,
    subValue,
    progress,
    icon,
    trend,
    trendDirection
}) => {
    return (
        <Tile className="dtfr-glass border-white/5 hover:border-white/10 transition-all bg-slate-900/30 group p-5 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded leading-none ${trendDirection === 'up' ? 'text-emerald-500 bg-emerald-500/10' :
                        trendDirection === 'down' ? 'text-rose-500 bg-rose-500/10' :
                            'text-slate-500 bg-white/5'
                        }`}>
                        {trend}
                    </div>
                )}
            </div>
            <div className="relative">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block group-hover:text-slate-300 transition-colors">
                    {label}
                </span>
                <div className="text-3xl font-black text-slate-100 tracking-tighter tabular-nums mb-2 font-mono">
                    {value}
                </div>
            </div>

            {subValue && (
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {subValue}
                </div>
            )}

            {progress !== undefined && (
                <div className="mt-4">
                    <ProgressBar
                        label=""
                        helperText=""
                        value={progress}
                        max={100}
                        size="small"
                        status={progress > 90 ? 'error' : 'active'}
                    />
                </div>
            )}
        </Tile>
    );
};

export default MetricTile;

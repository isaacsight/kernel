
import React from 'react';

export interface MetricsCardProps {
    label: string;
    value: string | number;
    unit?: string;
    trend?: number; // + or - percentage
    className?: string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
    label,
    value,
    unit,
    trend,
    className = ''
}) => {
    return (
        <div className={`p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 ${className}`}>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</span>
                {unit && <span className="text-sm text-zinc-500">{unit}</span>}
            </div>
            {trend !== undefined && (
                <div className={`text-xs mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </div>
            )}
        </div>
    );
};


import React from 'react';

export interface ResearchBadgeProps {
    label: string;
    variant?: 'live' | 'offline' | 'beta' | 'experimental' | 'neutral';
    animate?: boolean;
}

export const ResearchBadge: React.FC<ResearchBadgeProps> = ({
    label,
    variant = 'neutral',
    animate = false
}) => {
    const styles = {
        live: 'bg-green-500/10 text-green-500 border-green-500/20',
        offline: 'bg-red-500/10 text-red-500 border-red-500/20',
        beta: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        experimental: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        neutral: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
    };

    return (
        <span className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border
        ${styles[variant]}
    `}>
            {animate && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            {label}
        </span>
    );
};

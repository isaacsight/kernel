
import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface AttentionMatrixProps {
    data: number[][]; // 2D array of attention weights (0-1)
    labels?: string[];
    className?: string;
}

export const AttentionMatrix: React.FC<AttentionMatrixProps> = ({
    data,
    labels,
    className = ''
}) => {
    return (
        <div className={cn("inline-block p-1 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm", className)}>
            {labels && (
                <div className="flex mb-1">
                    <div className="w-6"></div> {/* Spacer for row labels if we added them */}
                    {labels.map((label, i) => (
                        <div key={i} className="flex-1 text-[10px] text-center font-mono text-zinc-500 -rotate-45 origin-bottom-left w-6 h-6 overflow-hidden">
                            {label}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex flex-col gap-0.5">
                {data.map((row, i) => (
                    <div key={i} className="flex gap-0.5">
                        {row.map((val, j) => (
                            <motion.div
                                key={j}
                                initial={false}
                                animate={{
                                    backgroundColor: `rgba(59, 130, 246, ${val})`,
                                    borderColor: val > 0.5 ? 'rgba(59, 130, 246, 0.8)' : 'transparent'
                                }}
                                transition={{ duration: 0.3 }}
                                className="w-6 h-6 rounded-sm relative group border border-transparent"
                            >
                                {/* Tooltip */}
                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-[10px] font-mono rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                    {val.toFixed(4)}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};


import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TokenInspector, TokenCandidate } from './TokenInspector';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface Token {
    id: number;
    text: string;
    logprob?: number;
    candidates?: TokenCandidate[];
    time?: number;
    diffType?: 'added' | 'removed' | 'unchanged';
}

export interface TokenStreamViewerProps {
    tokens: Token[];
    className?: string;
    showLogprobs?: boolean;
}

export const TokenStreamViewer: React.FC<TokenStreamViewerProps> = ({
    tokens,
    className = '',
    showLogprobs = false
}) => {
    const [hoveredToken, setHoveredToken] = useState<Token | null>(null);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [tokens.length]);

    const handleMouseEnter = (e: React.MouseEvent, token: Token) => {
        setHoveredToken(token);
        const rect = e.currentTarget.getBoundingClientRect();
        setCoords({ x: rect.left, y: rect.bottom + 8 });
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "font-mono text-sm leading-relaxed whitespace-pre-wrap p-6",
                "bg-zinc-50 dark:bg-[#050505]",
                "rounded-xl border border-zinc-200 dark:border-zinc-800",
                "h-96 overflow-y-auto relative custom-scrollbar",
                "shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)]",
                className
            )}
        >
            {/* Floating Inspector */}
            <AnimatePresence>
                {hoveredToken && hoveredToken.logprob !== undefined && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{ position: 'fixed', left: coords.x, top: coords.y, zIndex: 100 }}
                        className="pointer-events-none origin-top-left"
                    >
                        <TokenInspector
                            token={hoveredToken.text}
                            logprob={hoveredToken.logprob}
                            candidates={hoveredToken.candidates}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode='popLayout'>
                {tokens.map((token, i) => {
                    let bgClass = '';
                    if (token.diffType === 'added') bgClass = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                    else if (token.diffType === 'removed') bgClass = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through';

                    let style = {};
                    if (showLogprobs && token.logprob !== undefined) {
                        const p = token.logprob;
                        if (p > -0.1) style = { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
                        else if (p > -1.0) style = { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: 'rgba(234, 179, 8, 0.3)' };
                        else style = { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
                    }

                    return (
                        <motion.span
                            key={`${token.id}-${i}`}
                            layout
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: i > tokens.length - 5 ? 0.05 * (i - (tokens.length - 5)) : 0 }}
                            className={cn(
                                "relative inline-block border-b-2 border-transparent",
                                "hover:border-zinc-400 dark:hover:border-zinc-600",
                                "cursor-help transition-colors duration-150",
                                "rounded-sm px-0.5 mx-[1px]",
                                bgClass
                            )}
                            style={style}
                            onMouseEnter={(e) => handleMouseEnter(e, token)}
                            onMouseLeave={() => setHoveredToken(null)}
                        >
                            <span className="relative z-10">{token.text}</span>
                        </motion.span>
                    );
                })}
            </AnimatePresence>

            {/* Pulsing Cursor */}
            <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="inline-block w-2.5 h-5 bg-blue-500/80 align-middle ml-1 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            />
        </div>
    );
};

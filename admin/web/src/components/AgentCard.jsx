import React from 'react';
import { Activity, Zap, Shield, BookOpen, PenTool, Eye } from 'lucide-react';

const icons = {
    "The Alchemist": Zap,
    "The Guardian": Shield,
    "The Librarian": BookOpen,
    "The Editor": PenTool,
    "The Visionary": Eye,
    "The Operator": Activity
};

const AgentCard = ({ name, role, status, onAction }) => {
    const Icon = icons[name] || Activity;
    const isIdle = status === 'Idle' || status === 'Ready';

    return (
        <div className="tech-card group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2 rounded bg-white/5 text-primary group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                    <Icon size={20} />
                </div>
                <div className="flex items-center gap-2">
                    <span className={`status-dot ${isIdle ? 'warning' : 'online'}`}></span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        {status.toUpperCase()}
                    </span>
                </div>
            </div>

            <h3 className="text-base font-bold mb-1 tracking-tight text-white">{name}</h3>
            <p className="text-xs text-muted-foreground mb-4 font-mono line-clamp-2 min-h-[2.5em]">{role}</p>

            <div className="flex flex-col gap-2">
                {/* Special Badges */}
                {name === "The Alchemist" && (
                    <div className="flex gap-2 mb-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-mono font-bold uppercase tracking-wider rounded border border-primary/20 flex items-center gap-1 w-full justify-center">
                            <Zap size={8} /> Node: Qwen-72B
                        </span>
                    </div>
                )}

                {name === "The Alchemist" && (
                    <button
                        onClick={() => onAction(name, 'generate_deep')}
                        className="w-full py-2 px-4 rounded bg-primary text-black hover:bg-primary/90 text-xs font-bold font-mono uppercase tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Zap size={14} /> Initialize Deep Work
                    </button>
                )}
                {name === "The Librarian" && (
                    <button
                        onClick={() => onAction(name, 'rebuild_graph')}
                        className="w-full py-2 px-4 rounded bg-secondary text-secondary-foreground hover:bg-white/10 text-xs font-bold font-mono uppercase tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-white/10"
                    >
                        Sync Knowledge Graph
                    </button>
                )}
            </div>
        </div>
    );
};

export default AgentCard;

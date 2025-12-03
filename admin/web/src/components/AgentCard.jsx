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
        <div className="group p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-secondary/50 text-accent group-hover:bg-accent/10 group-hover:scale-105 transition-all duration-300">
                    <Icon size={24} />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isIdle ? 'bg-secondary text-muted-foreground' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                    {status}
                </div>
            </div>

            <h3 className="text-lg font-semibold mb-1 tracking-tight">{name}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{role}</p>

            <div className="flex gap-2">
                {name === "The Alchemist" && (
                    <button
                        onClick={() => onAction(name, 'generate')}
                        className="w-full py-2 px-4 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                        Commission Post
                    </button>
                )}
                {name === "The Librarian" && (
                    <button
                        onClick={() => onAction(name, 'rebuild_graph')}
                        className="w-full py-2 px-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-border"
                    >
                        Rebuild Graph
                    </button>
                )}
            </div>
        </div>
    );
};

export default AgentCard;

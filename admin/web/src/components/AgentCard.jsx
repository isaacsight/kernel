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
        <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:border-accent transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-secondary/50 text-accent-foreground group-hover:bg-accent group-hover:text-white transition-colors">
                    <Icon size={24} />
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${isIdle ? 'bg-secondary text-muted-foreground' : 'bg-green-500/20 text-green-400'}`}>
                    {status}
                </div>
            </div>

            <h3 className="text-lg font-semibold mb-1">{name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{role}</p>

            <div className="flex gap-2">
                {name === "The Alchemist" && (
                    <button
                        onClick={() => onAction(name, 'generate')}
                        className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium transition-opacity"
                    >
                        Commission Post
                    </button>
                )}
                {name === "The Librarian" && (
                    <button
                        onClick={() => onAction(name, 'rebuild_graph')}
                        className="w-full py-2 px-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium transition-colors"
                    >
                        Rebuild Graph
                    </button>
                )}
            </div>
        </div>
    );
};

export default AgentCard;

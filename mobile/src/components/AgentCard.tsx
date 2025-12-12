import React from 'react';
import { Activity, Zap, Shield, BookOpen, PenTool, Eye } from 'lucide-react';

const icons: Record<string, React.ElementType> = {
    "The Alchemist": Zap,
    "The Guardian": Shield,
    "The Librarian": BookOpen,
    "The Editor": PenTool,
    "The Visionary": Eye,
    "The Operator": Activity
};

interface AgentCardProps {
    name: string;
    role: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAction?: (name: string, action: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ name, role, status, onAction }) => {
    const Icon = icons[name] || Activity;
    const isIdle = status === 'Idle' || status === 'Ready';

    return (
        <div className="tech-card group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2 rounded bg-white/5 text-primary">
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
                {name === "The Alchemist" && (
                    <div className="flex gap-2 mb-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-mono font-bold uppercase tracking-wider rounded border border-primary/20 flex items-center gap-1 w-full justify-center">
                            <Zap size={8} /> Node: Qwen-72B
                        </span>
                    </div>
                )}

                <button
                    onClick={() => onAction && onAction(name, 'interact')}
                    className="w-full py-2 px-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold font-mono uppercase tracking-wide border border-white/10"
                >
                    Details
                </button>
            </div>
        </div>
    );
};

export default AgentCard;

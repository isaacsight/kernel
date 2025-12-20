import React from 'react';
import { Activity, Zap, Shield, BookOpen, PenTool, Eye, Cpu, ChevronRight } from 'lucide-react';

const icons = {
    "The Alchemist": Zap,
    "The Guardian": Shield,
    "The Librarian": BookOpen,
    "The Editor": PenTool,
    "The Visionary": Eye,
    "The Operator": Cpu
};

const AgentCard = ({ name, role, status, onAction }) => {
    const Icon = icons[name] || Activity;
    const isIdle = status === 'Idle' || status === 'Ready';

    return (
        <div className="tech-card group flex flex-col items-start gap-4">
            <div className="w-full flex items-start justify-between">
                <div className={`p-3 rounded-2xl ${isIdle ? 'bg-white/5 text-muted-foreground' : 'bg-primary/10 text-primary border border-primary/20'} transition-all duration-500 group-hover:scale-110 shadow-lg`}>
                    <Icon size={20} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5">
                    <div className={`status-dot ${isIdle ? 'bg-amber-500' : 'bg-primary'}`} />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/70">
                        {status}
                    </span>
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-white group-hover:text-primary transition-colors">{name}</h3>
                <p className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest leading-relaxed line-clamp-2">{role}</p>
            </div>

            <div className="w-full pt-4 mt-auto">
                <button
                    onClick={() => onAction(name, 'status')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-foreground/70 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all group/btn"
                >
                    <span>View Intelligence</span>
                    <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
                </button>
            </div>
        </div>
    );
};

export default AgentCard;

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
    onAction?: (name: string, action: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ name, role, status, onAction }) => {
    const Icon = icons[name] || Activity;
    const isOnline = status === 'Active' || status === 'Ready' || status === 'Running';

    return (
        <div className="tech-card group flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/[0.04] text-white/90 group-hover:bg-white/[0.08] transition-all">
                            <Icon size={20} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-tight text-white/90">{name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`status-dot ${isOnline ? 'online' : 'warning'}`}></span>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                                    {status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-[13px] leading-relaxed text-white/50 mb-6 font-normal line-clamp-2">
                    {role}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={async () => {
                        try {
                            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
                            await Haptics.impact({ style: ImpactStyle.Light });
                        } catch {
                            console.warn("Haptics not available");
                        }
                        onAction && onAction(name, 'interact');
                    }}
                    className="flex-1 py-3 px-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-[13px] font-semibold text-white/70 active:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                    Intervene
                </button>
                {name === "The Alchemist" && (
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white/40">
                        <Zap size={14} />
                    </div>
                )}
            </div>
        </div>
    );
};


export default AgentCard;

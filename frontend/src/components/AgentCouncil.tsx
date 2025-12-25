const agents = [
    { name: "Antigravity", role: "Kernel", icon: "⚛️", status: "online" },
    { name: "Analyst", role: "Science", icon: "📊", status: "online" },
    { name: "Kernel Eng", role: "Hardware", icon: "💾", status: "online" },
    { name: "Librarian", role: "Memory", icon: "📚", status: "thinking" },
    { name: "Visionary", role: "Design", icon: "👁️", status: "idle" },
    { name: "Guardian", role: "Safety", icon: "🛡️", status: "online" }
];

export default function AgentCouncil() {
    return (
        <div className="agent-council-grid grid grid-cols-2 md:grid-cols-3 gap-4">
            {agents.map((agent) => (
                <div
                    key={agent.name}
                    className="glass-panel p-5 rounded-2xl bg-slate-900/10 border-white/5 flex items-center gap-4 group"
                >
                    <div className="w-12 h-12 rounded-xl bg-slate-800/20 border border-white/5 flex items-center justify-center text-xl shadow-inner">
                        {agent.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h3 className="text-sm font-bold text-slate-200 truncate">{agent.name}</h3>
                            <div className={`status-pill-v2 ${agent.status} scale-90 origin-right`}>
                                <div className="status-avatar-ring"></div>
                                {agent.status}
                            </div>
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{agent.role}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

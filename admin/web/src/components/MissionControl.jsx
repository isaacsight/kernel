import React from 'react';
import { Activity, Server, Users, Zap, Clock } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, subtext, status = "neutral" }) => {
    const statusColors = {
        active: "border-green-500/50 bg-green-500/5 text-green-400",
        warning: "border-yellow-500/50 bg-yellow-500/5 text-yellow-400",
        error: "border-red-500/50 bg-red-500/5 text-red-400",
        neutral: "border-white/10 bg-white/5 text-white"
    };

    return (
        <div className={`p-4 rounded-xl border ${statusColors[status]} transition-all hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-2">
                <Icon size={20} className="opacity-70" />
                {status === 'active' && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
            <div className="text-2xl font-mono font-bold tracking-tighter mb-1">{value}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-60 font-mono">{label}</div>
            {subtext && <div className="text-xs opacity-50 mt-1">{subtext}</div>}
        </div>
    );
};

const MissionControl = ({ heartbeat, agents }) => {
    const activeCount = agents.filter(a => a.status !== 'Sleeping' && a.status !== 'Dreaming').length;
    const pulseStatus = heartbeat?.status === 'Running' ? 'active' : 'neutral';

    return (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
                icon={Activity}
                label="System Pulse"
                value={heartbeat?.status === 'Running' ? "ONLINE" : "OFFLINE"}
                subtext={heartbeat ? `${heartbeat.interval}s Interval` : "Connecting..."}
                status={pulseStatus}
            />

            <StatCard
                icon={Users}
                label="Active Agents"
                value={activeCount.toString().padStart(2, '0')}
                subtext={`Total Swarm: ${agents.length}`}
                status={activeCount > 0 ? "active" : "neutral"}
            />

            <StatCard
                icon={Server}
                label="Compute Node"
                value="QWEN-72B"
                subtext="Local Inference"
                status="active"
            />

            <StatCard
                icon={Clock}
                label="Uptime"
                value="99.9%"
                subtext="Session: 2h 14m"
                status="neutral"
            />
        </section>
    );
};

export default MissionControl;

import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';
import AgentCard from '../components/AgentCard';
import NeuralLattice from '../components/NeuralLattice';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AgentService, SystemService, getActiveBaseUrl, setUrlChangeListener } from '../services/api';

interface Agent {
    name: string;
    role: string;
    status: string;
}

const Home: React.FC = () => {
    const [command, setCommand] = useState('');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeUrl, setActiveUrl] = useState(getActiveBaseUrl());

    useEffect(() => {
        setUrlChangeListener(setActiveUrl);
    }, []);

    const fetchAgents = async () => {
        setIsRefreshing(true);
        try {
            const data = await AgentService.getAll();
            setAgents(data);
        } catch (error) {
            console.error("Failed to fetch agents", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;

        setLoading(true);
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
            await SystemService.sendCommand(command);
            setCommand('');
            fetchAgents();
            await Haptics.notification({ type: 'SUCCESS' as any });
        } catch (error) {
            console.error("Command failed", error);
            await Haptics.notification({ type: 'ERROR' as any });
            alert("Command failed to execute");
        } finally {
            setLoading(false);
        }
    };

    const handleAgentAction = async (name: string, action: string) => {
        try {
            await AgentService.runAction(name, action);
            fetchAgents();
        } catch (error) {
            console.error("Action failed", error);
        }
    };

    return (
        <div className="space-y-8 pb-32 animate-fade-in px-4">
            {/* Minimal Header */}
            <header className="flex justify-between items-center py-10 relative">
                <NeuralLattice />
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold tracking-tighter text-white flex items-center gap-2">
                        Studio Control
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">
                            System {activeUrl.includes('100.81.9.128') ? 'Operational' : 'Fallback'}
                        </p>
                        <div className={`w-1.5 h-1.5 rounded-full ${activeUrl.includes('100.81.9.128') ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]'}`}></div>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        await Haptics.impact({ style: ImpactStyle.Light });
                        fetchAgents();
                    }}
                    className={`p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white/50 transition-all ${isRefreshing ? 'animate-spin' : 'active:scale-90'}`}
                >
                    <RefreshCw size={22} strokeWidth={1.5} />
                </button>
            </header>

            {/* Premium Command Bar */}
            <section className="relative">
                <form onSubmit={handleCommand}>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Ask anything or enter command..."
                        disabled={loading}
                        className="input-field pr-12"
                    />
                    <button
                        type="submit"
                        disabled={loading || !command.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/40 disabled:opacity-20 transition-all"
                    >
                        <Terminal size={20} strokeWidth={1.5} />
                    </button>
                </form>
            </section>

            {/* Agent Grid */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white/20 uppercase tracking-[0.15em]">Active Agent Swarm</h3>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                        <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="text-[9px] font-semibold text-white/40 tracking-wider">QWEN-72B</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {agents.map((agent) => (
                        <AgentCard
                            key={agent.name}
                            {...agent}
                            onAction={handleAgentAction}
                        />
                    ))}
                    {agents.length === 0 && !isRefreshing && (
                        <div className="p-12 text-center glass-panel rounded-3xl border-dashed">
                            <p className="text-white/20 text-xs font-medium">No active agents online.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};


export default Home;

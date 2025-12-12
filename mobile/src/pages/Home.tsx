import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';
import AgentCard from '../components/AgentCard';
import { AgentService, SystemService } from '../services/api';

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
            await SystemService.sendCommand(command);
            setCommand('');
            fetchAgents();
            // In a real app we'd show the result notification here
        } catch (error) {
            console.error("Command failed", error);
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
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-end pb-4 border-b border-white/5">
                <div>
                    <h1 className="text-xl font-bold tracking-tighter text-white mb-1 flex items-center gap-2">
                        <Terminal className="text-primary" size={20} />
                        MISSION_CTRL
                    </h1>
                    <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                        Status: <span className="text-[var(--status-online)]">OPERATIONAL</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-3">
                        <button onClick={() => fetchAgents()} className={`text-white/50 ${isRefreshing ? 'animate-spin' : ''}`}>
                            <RefreshCw size={14} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] animate-pulse"></div>
                            <span className="text-[10px] font-bold text-white font-mono">QWEN-72B</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Command Interface */}
            <section className="bg-black/40 border border-white/10 rounded-lg p-4">
                <h2 className="text-[10px] font-mono font-bold text-primary mb-3 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-0.5 h-3 bg-primary rounded-sm"></span>
                    Command Interface
                </h2>
                <form onSubmit={handleCommand} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-primary font-mono text-sm">{'>'}</span>
                    </div>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Enter system command..."
                        disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-white/20 disabled:opacity-50"
                    />
                </form>
            </section>

            {/* Agent Grid */}
            <section className="space-y-4">
                <h3 className="text-sm font-bold text-white/80">Active Agents</h3>
                <div className="grid grid-cols-1 gap-4">
                    {agents.map((agent) => (
                        <AgentCard
                            key={agent.name}
                            {...agent}
                            onAction={handleAgentAction}
                        />
                    ))}
                    {agents.length === 0 && !isRefreshing && (
                        <div className="p-8 text-center border border-dashed border-white/10 rounded-lg">
                            <p className="text-muted-foreground text-xs">No active agents found.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Home;

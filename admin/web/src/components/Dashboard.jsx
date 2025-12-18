import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, PenTool, Cpu, Users } from 'lucide-react';
import MissionControl from './MissionControl';
import EcosystemNeuralNet from './EcosystemNeuralNet';
import AgentCard from './AgentCard';

const Dashboard = () => {
    const [agents, setAgents] = useState([]);
    const [command, setCommand] = useState('');
    const [cmdResult, setCmdResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [heartbeat, setHeartbeat] = useState(null);
    const [evolution, setEvolution] = useState(null);

    const fetchAgents = async () => {
        try {
            const res = await axios.get('http://localhost:8000/agents');
            setAgents(res.data);
        } catch (err) {
            console.error("Failed to fetch agents:", err);
        }
    };

    const fetchHeartbeat = async () => {
        try {
            const res = await axios.get('http://localhost:8000/system/heartbeat');
            setHeartbeat(res.data);
        } catch (err) {
            console.error("Failed to fetch heartbeat:", err);
        }
    };

    const fetchEvolution = async () => {
        try {
            const res = await axios.get('http://localhost:8000/system/evolution/state');
            setEvolution(res.data);
        } catch (err) {
            console.error("Failed to fetch evolution:", err);
        }
    };

    useEffect(() => {
        fetchAgents();
        fetchHeartbeat();
        fetchEvolution();
        const interval = setInterval(() => {
            fetchAgents();
            fetchHeartbeat();
            fetchEvolution();
        }, 2000); // 2s for faster updates
        return () => clearInterval(interval);
    }, []);

    const handleCommand = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        setLoading(true);
        setCmdResult(null);
        try {
            const res = await axios.post('http://localhost:8000/command', { command });
            setCmdResult(res.data);
            if (res.data.success) {
                setCommand('');
                fetchAgents(); // Refresh state
            }
        } catch (err) {
            setCmdResult({ success: false, error: err.message });
        }
        setLoading(false);
    };

    const handleAction = async (agentName, action) => {
        // ... existing handleAction logic ...
        console.log(`Triggering ${action} for ${agentName}`);
        try {
            if (agentName === "The Alchemist") {
                const topic = prompt("Enter a topic for the new post:");
                if (!topic) return;

                // Deep Mode logic if action is generate_deep, or just default to it for Alchemist now
                const isDeep = action === 'generate_deep';

                await axios.post('http://localhost:8000/agents/run', {
                    agent_name: agentName,
                    action: 'generate', // Backend expects 'generate' method
                    parameters: { topic, deep_mode: isDeep }
                });
                alert("Alchemist commissioned! Deep Work started. This may take 60s.");
            } else {
                await axios.post('http://localhost:8000/agents/run', {
                    agent_name: agentName,
                    action: action
                });
                alert(`${agentName} action triggered.`);
            }
        } catch (error) {
            console.error(error);
            alert("Action failed: " + error.message);
        }
    };

    // Group agents by team
    const teams = {
        "Design Team": agents.filter(a => ["The Visionary", "The Designer"].includes(a.name)),
        "Function Team": agents.filter(a => ["The Operator", "The Architect", "The Guardian"].includes(a.name)),
        "Content Team": agents.filter(a => ["The Alchemist", "The Editor", "The Librarian"].includes(a.name))
    };

    const getTeamIcon = (team) => {
        switch (team) {
            case "Design Team": return <PenTool className="text-purple-400" />;
            case "Function Team": return <Cpu className="text-blue-400" />;
            case "Content Team": return <Users className="text-green-400" />;
            default: return <Users />;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <header className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white mb-2 flex items-center gap-3">
                        <Terminal className="text-primary" size={32} />
                        MISSION_CONTROL
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm max-w-md">
                        Orchestrate your autonomous agent swarm. Status: <span className="text-green-500">OPERATIONAL</span>
                    </p>
                </div>
            </header>

            {/* Neural Ecosystem View */}
            <section className="h-[400px] w-full bg-black/40 rounded-xl border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px]" />
                <EcosystemNeuralNet agents={agents} />

                {/* Overlay Title */}
                <div className="absolute top-4 left-4 pointer-events-none">
                    <h2 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-ping"></span>
                        Neural State
                    </h2>
                </div>
            </section>

            {/* Mission Control Status Board */}
            <MissionControl heartbeat={heartbeat} agents={agents} evolution={evolution} />

            {/* Command Center */}
            <section className="glass-panel p-1 rounded-xl">
                <div className="bg-black/40 rounded-lg p-6">
                    <h2 className="text-sm font-mono font-bold text-primary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-4 bg-primary rounded-sm"></span>
                        Command Interface
                    </h2>
                    <form onSubmit={handleCommand} className="flex gap-3">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-primary font-mono text-lg">{'>'}</span>
                            </div>
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Enter system command..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-4 text-white font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-white/20"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-black px-8 py-3 rounded-lg font-bold font-mono uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : 'Execute'}
                        </button>
                    </form>

                    {cmdResult && (
                        <div className={`mt-4 p-4 rounded border border-l-4 font-mono text-xs ${cmdResult.success ? 'bg-green-500/5 border-green-500/50 text-green-400' : 'bg-red-500/5 border-red-500/50 text-red-400'}`}>
                            {cmdResult.success ? (
                                <div className="space-y-1">
                                    <p className="font-bold flex items-center gap-2">
                                        <span className="text-lg">✓</span> COMMAND_EXECUTED
                                    </p>
                                    <p className="opacity-70">INTENT: [{cmdResult.intent}]</p>
                                    <p className="opacity-70">AGENTS: [{cmdResult.agents_involved?.join(", ")}]</p>
                                    {cmdResult.result?.report && (
                                        <div className="mt-3 p-3 bg-black/50 rounded border border-white/5">
                                            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed opacity-90">{cmdResult.result.report}</pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="flex items-center gap-2">
                                    <span>✕</span> ERROR: {cmdResult.error}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Team Views */}
            <div className="space-y-8">
                {Object.entries(teams).map(([teamName, teamAgents]) => (
                    <section key={teamName}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground/80">
                            {getTeamIcon(teamName)}
                            {teamName}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teamAgents.map(agent => (
                                <AgentCard
                                    key={agent.name}
                                    {...agent}
                                    onAction={handleAction}
                                    capabilities={agent.name === "The Alchemist" ? ["qwen_enabled"] : []}
                                />
                            ))}
                            {teamAgents.length === 0 && (
                                <div className="col-span-full text-muted-foreground italic text-sm p-4 border border-dashed border-border rounded-lg">
                                    No active agents in this team.
                                </div>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;

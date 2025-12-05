import React, { useState, useEffect } from 'react';
import AgentCard from './AgentCard';
import axios from 'axios';
import { Terminal, Users, PenTool, Cpu } from 'lucide-react';

const Dashboard = () => {
    const [agents, setAgents] = useState([]);
    const [command, setCommand] = useState('');
    const [cmdResult, setCmdResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchAgents = async () => {
        try {
            const res = await axios.get('http://localhost:8000/agents');
            setAgents(res.data);
        } catch (err) {
            console.error("Failed to fetch agents:", err);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000);
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

                await axios.post('http://localhost:8000/agents/run', {
                    agent_name: agentName,
                    action: action,
                    parameters: { topic }
                });
                alert("Alchemist commissioned! Check back soon.");
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
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold mb-2 tracking-tighter">Mission Control</h1>
                    <p className="text-muted-foreground text-base">Manage your autonomous creative team.</p>
                </div>
            </header>

            {/* Command Center */}
            <section className="bg-card/50 border border-border rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Terminal size={20} />
                    Command Center
                </h2>
                <form onSubmit={handleCommand} className="flex gap-4">
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Tell the team what to do (e.g., 'Write a post about AI', 'Evolve the system', 'Publish site')..."
                        className="flex-1 bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-accent text-accent-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Processing...' : 'Execute'}
                    </button>
                </form>

                {cmdResult && (
                    <div className={`mt-4 p-4 rounded-lg text-sm font-mono ${cmdResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {cmdResult.success ? (
                            <div>
                                <p className="font-bold">✅ Command Executed</p>
                                <p>Intent: {cmdResult.intent}</p>
                                <p>Agents: {cmdResult.agents_involved?.join(", ")}</p>
                                {cmdResult.result?.report && <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{cmdResult.result.report}</pre>}
                            </div>
                        ) : (
                            <p>❌ Error: {cmdResult.error}</p>
                        )}
                    </div>
                )}
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
                                <AgentCard key={agent.name} {...agent} onAction={handleAction} />
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

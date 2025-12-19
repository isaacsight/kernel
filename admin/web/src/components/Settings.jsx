import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Cpu, Activity, Power, RefreshCw } from 'lucide-react';

const Settings = () => {
    const [systemStatus, setSystemStatus] = useState({
        server: 'Checking...',
        ollama: 'Checking...'
    });
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            const serverRes = await axios.get(`${apiBase}/system/status`);
            const ollamaRes = await axios.post(`${apiBase}/system/ollama/status`);

            setSystemStatus({
                server: serverRes.data.server_status,
                ollama: ollamaRes.data.status
            });
        } catch (err) {
            console.error("Failed to fetch system status:", err);
        }
    };

    const fetchAgents = async () => {
        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            const res = await axios.get(`${apiBase}/agents`);
            setAgents(res.data);
        } catch (err) {
            console.error("Failed to fetch agents:", err);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchAgents();
        const interval = setInterval(() => {
            fetchStatus();
            fetchAgents();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleOllamaAction = async (action) => {
        setLoading(true);
        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            const res = await axios.post(`${apiBase}/system/ollama/${action}`);
            alert(res.data.message);
            fetchStatus();
        } catch (err) {
            alert("Action failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-bold mb-2 tracking-tighter">Settings & System</h1>
                <p className="text-muted-foreground text-base">Manage your Studio OS infrastructure.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* System Status Card */}
                <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-all duration-300">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 tracking-tight">
                        <Server size={20} />
                        System Status
                    </h2>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="font-semibold text-sm">API Server</span>
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${systemStatus.server.includes('Running')
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                {systemStatus.server}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-secondary/30 rounded-lg border border-border/50">
                            <span className="font-semibold text-sm">Ollama (Local AI)</span>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${systemStatus.ollama === 'Running'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                    }`}>
                                    {systemStatus.ollama}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => handleOllamaAction('start')}
                                disabled={loading || systemStatus.ollama === 'Running'}
                                className="flex-1 py-2.5 px-4 bg-accent text-accent-foreground rounded-lg disabled:opacity-50 hover:bg-accent/90 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Power size={16} />
                                Start Ollama
                            </button>
                            <button
                                onClick={() => handleOllamaAction('stop')}
                                disabled={loading || systemStatus.ollama !== 'Running'}
                                className="flex-1 py-2.5 px-4 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 hover:opacity-90 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Power size={16} />
                                Stop Ollama
                            </button>
                        </div>
                    </div>
                </div>

                {/* Agent Status Card */}
                <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-all duration-300">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 tracking-tight">
                        <Cpu size={20} />
                        Agent Status
                    </h2>
                    <div className="space-y-2">
                        {agents.map(agent => (
                            <div key={agent.name} className="flex justify-between items-center text-sm border-b border-border/50 last:border-0 pb-3 last:pb-0">
                                <span className="font-medium">{agent.name}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${agent.status === 'Active' || agent.status === 'Ready'
                                    ? 'text-green-400 bg-green-500/10 border border-green-500/30'
                                    : 'text-muted-foreground bg-secondary/50 border border-border'
                                    }`}>
                                    {agent.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;

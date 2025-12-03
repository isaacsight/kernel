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
            const serverRes = await axios.get('http://localhost:8000/system/status');
            const ollamaRes = await axios.post('http://localhost:8000/system/ollama/status');

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
            const res = await axios.get('http://localhost:8000/agents');
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
            const res = await axios.post(`http://localhost:8000/system/ollama/${action}`);
            alert(res.data.message);
            fetchStatus();
        } catch (err) {
            alert("Action failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings & System</h1>
                <p className="text-muted-foreground">Manage your Studio OS infrastructure.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* System Status Card */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Server size={20} />
                        System Status
                    </h2>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                            <span className="font-medium">API Server</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${systemStatus.server.includes('Running') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {systemStatus.server}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                            <span className="font-medium">Ollama (Local AI)</span>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${systemStatus.ollama === 'Running' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {systemStatus.ollama}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => handleOllamaAction('start')}
                                disabled={loading || systemStatus.ollama === 'Running'}
                                className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Power size={16} />
                                Start Ollama
                            </button>
                            <button
                                onClick={() => handleOllamaAction('stop')}
                                disabled={loading || systemStatus.ollama !== 'Running'}
                                className="flex-1 py-2 px-4 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Power size={16} />
                                Stop Ollama
                            </button>
                        </div>
                    </div>
                </div>

                {/* Agent Status Card */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Cpu size={20} />
                        Agent Status
                    </h2>
                    <div className="space-y-3">
                        {agents.map(agent => (
                            <div key={agent.name} className="flex justify-between items-center text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                                <span>{agent.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${agent.status === 'Active' || agent.status === 'Ready'
                                        ? 'text-green-400'
                                        : 'text-muted-foreground'
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

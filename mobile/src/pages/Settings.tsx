import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Server, Cpu } from 'lucide-react';

const Settings: React.FC = () => {
    const [status, setStatus] = useState({ server: 'Checking...', ollama: 'Checking...' });
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            const serverRes = await axios.get('http://localhost:8000/system/status');
            const ollamaRes = await axios.post('http://localhost:8000/system/ollama/status');
            setStatus({
                server: serverRes.data.server_status,
                ollama: ollamaRes.data.status
            });
        } catch {
            setStatus({ server: 'Offline', ollama: 'Unknown' });
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleOllama = async (action: 'start' | 'stop') => {
        setLoading(true);
        try {
            await axios.post(`http://localhost:8000/system/ollama/${action}`);
            setTimeout(checkStatus, 2000);
        } catch {
            alert(`Failed to ${action} Ollama`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in p-4 pb-20 space-y-6">
            <header className="pb-4 border-b border-white/5">
                <h1 className="text-xl font-bold tracking-tighter text-white">Settings</h1>
                <p className="text-xs text-muted-foreground">System Status & Configuration</p>
            </header>

            <div className="space-y-4">
                {/* Server Status */}
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Server size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">API Server</h3>
                            <p className="text-[10px] text-muted-foreground">localhost:8000</p>
                        </div>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${status.server.includes('Running') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        {status.server}
                    </span>
                </div>

                {/* Ollama Status */}
                <div className="glass-panel p-4 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">Ollama AI</h3>
                                <p className="text-[10px] text-muted-foreground">Local Inference</p>
                            </div>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${status.ollama === 'Running' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}>
                            {status.ollama}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => toggleOllama('start')}
                            disabled={loading || status.ollama === 'Running'}
                            className="flex-1 py-3 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase disabled:opacity-50 hover:bg-white/10"
                        >
                            Start
                        </button>
                        <button
                            onClick={() => toggleOllama('stop')}
                            disabled={loading || status.ollama !== 'Running'}
                            className="flex-1 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase disabled:opacity-50 hover:bg-red-500/20"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;

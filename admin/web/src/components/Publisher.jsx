import React, { useState } from 'react';
import axios from 'axios';
import { Terminal, Zap, Check, AlertCircle, Loader } from 'lucide-react';
import GravityRelease from './GravityRelease';

const Publisher = () => {
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleAction = async (action) => {
        setLoading(true);
        setStatus(null);
        // setLogs([]); // Keep logs for context? Or clear? Let's clear for fresh start if build
        if (action === 'build') setLogs([]);

        addLog(`Starting ${action}...`);

        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            const endpoint = action === 'build' ? '/system/site/build' : '/system/site/publish';

            const res = await axios.post(`${apiBase}${endpoint}`);

            setStatus({ type: 'success', message: res.data.message });
            addLog(`✅ ${res.data.message}`);
            return true; // Return true for GravityRelease
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.detail || err.message;
            setStatus({ type: 'error', message: errorMsg });
            addLog(`❌ Error: ${errorMsg}`);
            return false; // Return false for GravityRelease
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-black text-white p-6 md:p-12 overflow-hidden">
            {/* Header */}
            <header className="mb-10">
                <h1 className="text-4xl font-light tracking-tighter text-white mb-2 flex items-center gap-4">
                    <Zap className="text-yellow-400" size={32} />
                    Site Engine
                </h1>
                <p className="text-white/50 text-lg max-w-2xl">
                    Compile your thoughts into reality. Deploy the neural web to the public grid.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-0">
                {/* Control Panel */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* Staging Control */}
                    <div className="p-6 rounded-2xl bg-[#111] border border-white/10 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Terminal size={100} />
                        </div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            Staging
                        </h2>
                        <p className="text-white/40 text-sm mb-6">
                            Compiles markdown to static HTML in the local <code>docs/</code> folder. Visible only to you.
                        </p>
                        <button
                            onClick={() => handleAction('build')}
                            disabled={loading}
                            className={`
                                w-full py-4 px-6 rounded-lg font-bold tracking-widest uppercase text-sm
                                transition-all duration-200 border border-white/10
                                ${loading
                                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                    : 'bg-white/5 hover:bg-white/10 hover:border-white/20 text-white'
                                }
                            `}
                        >
                            {loading ? 'Compiling...' : 'Build Staging'}
                        </button>
                    </div>

                    {/* Production Control (Gravity Release) */}
                    <div className="flex-1 min-h-[400px] p-6 rounded-2xl bg-gradient-to-b from-[#111] to-black border border-white/10 relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                        <h2 className="text-xl font-bold mb-8 flex items-center gap-2 z-10">
                            <span className="w-2 h-2 rounded-full bg-[#00D6A3] animate-pulse" />
                            Production Realease
                        </h2>

                        <div className="z-10 scale-125">
                            <GravityRelease
                                onTrigger={() => handleAction('publish')}
                                loading={loading}
                            />
                        </div>

                        <div className="mt-12 text-center z-10">
                            <p className="text-white/30 text-xs max-w-[200px] mx-auto leading-relaxed">
                                <strong className="text-white/50">CAUTION:</strong> Engaging this lever will immediately push changes to the public grid.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Console Output */}
                <div className="lg:col-span-2 flex flex-col h-full min-h-0 bg-[#050505] rounded-2xl border border-white/10 overflow-hidden font-mono text-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                        <span className="text-white/40 text-xs uppercase tracking-widest">System Log</span>
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono scrollbar-hide">
                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                <Terminal size={48} strokeWidth={1} />
                                <p>System Ready. Waiting for input.</p>
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-3 text-white/70 border-l-2 border-white/10 pl-3 py-1">
                                <span className="text-white/30 select-none text-xs w-[140px] shrink-0">
                                    {log.split(']')[0]}]
                                </span>
                                <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-[#00D6A3]' : ''}>
                                    {log.split(']')[1]}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Status Footer */}
                    {status && (
                        <div className={`p-4 border-t ${status.type === 'success'
                                ? 'bg-[#00D6A3]/10 border-[#00D6A3]/20 text-[#00D6A3]'
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                            <div className="flex items-center gap-3">
                                {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                                <span className="font-medium">{status.message}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Publisher;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Database, ExternalLink, RefreshCw, Zap } from 'lucide-react';

const apiBase = `http://${window.location.hostname}:8000`;

const NeuralLink = () => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState(null);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${apiBase}/api/studio/neural_link`);
            if (res.data && res.data.feed) {
                setFeed(res.data.feed);
                setLastSync(new Date());
            }
        } catch (e) {
            console.error("Neural Link Sync Failed:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        // Poll every 3 seconds for "Live" feel
        const interval = setInterval(fetchFeed, 3000);
        return () => clearInterval(interval);
    }, []);

    // Helper to format timestamp
    const formatTime = (ts) => {
        if (!ts) return "--:--:--";
        // Assuming TS is UTC string from DB, localizing it
        // Or if it's already local on backend (it's stored as CURRENT_TIMESTAMP string usually)
        // Let's just try to parse it
        try {
            return new Date(ts + "Z").toLocaleTimeString(); // Append Z to assume UTC DB
        } catch (e) {
            return ts.split(' ')[1] || ts;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-white font-mono overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#080808]">
                <div className="flex items-center gap-3">
                    <Activity size={16} className="text-[#00D6A3]" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        NEURAL_LINK // INTAKE_STREAM
                    </h3>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-white/30">
                    <span className="flex items-center gap-1">
                        <Database size={12} />
                        BUFFER: {feed.length}
                    </span>
                    <span className="flex items-center gap-1">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        SYNC: {lastSync ? lastSync.toLocaleTimeString() : "PENDING"}
                    </span>
                </div>
            </div>

            {/* Matrix Feed */}
            <div className="flex-1 overflow-y-auto p-0 custom-scrollbar relative">
                <div className="absolute inset-0 bg-[url('/assets/grid.png')] opacity-[0.02] pointer-events-none" />

                {feed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20">
                        <Zap size={24} className="mb-2 opacity-50" />
                        <div className="text-xs uppercase tracking-widest">NO SIGNAL DETECTED</div>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#050505] z-10 text-[9px] text-white/20 uppercase tracking-widest font-bold border-b border-white/5">
                            <tr>
                                <th className="py-2 pl-6 w-24">TIME</th>
                                <th className="py-2 w-32">SOURCE_TYPE</th>
                                <th className="py-2">CONTENT_PAYLOAD</th>
                                <th className="py-2 w-24 text-right pr-6">ACTION</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px] text-white/60">
                            {feed.map((item, i) => (
                                <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.03] transition-colors group">
                                    <td className="py-3 pl-6 font-mono text-white/30">
                                        {formatTime(item.timestamp)}
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase
                                            ${item.source_type === 'browser_context' ? 'bg-[#00D6A3]/10 text-[#00D6A3]' :
                                                item.source_type === 'decision' ? 'bg-amber-500/10 text-amber-500' :
                                                    'bg-blue-500/10 text-blue-500'}`}>
                                            {item.source_type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <div className="flex flex-col gap-1">
                                            {item.metadata?.url && (
                                                <a href={item.metadata.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-white/40 hover:text-[#00D6A3] truncate max-w-[400px] flex items-center gap-1 transition-colors">
                                                    <ExternalLink size={10} />
                                                    {item.metadata.title || item.metadata.url}
                                                </a>
                                            )}
                                            <div className="text-white/70 line-clamp-2 md:line-clamp-1 font-sans">
                                                {item.content || JSON.stringify(item.metadata.context || item.metadata)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 pr-6 text-right">
                                        <button className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all">
                                            VIEW
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default NeuralLink;

import React from 'react';
import { ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * NeuralLink - Minimalist Typography Version
 * Renders a clean, high-performance list of intake items.
 */
const NeuralLink = ({ feed = [], loading = false, error = null }) => {

    // Format timestamp to HH:MM:SS
    const formatTime = (ts) => {
        if (!ts) return "--:--:--";
        try {
            const date = new Date(ts);
            if (!isNaN(date.getTime())) {
                return date.toLocaleTimeString('en-US', { hour12: false });
            }
            return ts.split(' ')[1] || ts;
        } catch (e) {
            return String(ts);
        }
    };

    if (error) {
        return (
            <div className="py-4 text-red-500 font-mono text-sm">
                [!] CONNECTION_LOST: {error}
            </div>
        );
    }

    if (!feed || feed.length === 0) {
        return (
            <div className="py-8 text-[#666] font-mono text-sm italic">
                {loading ? "INITIALIZING_UPLINK..." : "// NO_DATA_AVAILABLE"}
            </div>
        );
    }

    return (
        <div className="font-mono text-sm">
            {/* Header Row (Visual only) */}
            <div className="grid grid-cols-12 gap-4 pb-4 border-b border-[#333] text-[#666] text-xs uppercase tracking-wider mb-4">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-8">Payload</div>
            </div>

            {/* Data Rows */}
            <div className="space-y-4">
                {feed.map((item, i) => (
                    <div key={item.id || i} className="grid grid-cols-12 gap-4 group hover:bg-[#111] -mx-2 px-2 py-2 rounded transition-colors">
                        {/* Time */}
                        <div className="col-span-2 text-[#666] group-hover:text-[#888]">
                            {formatTime(item.timestamp)}
                        </div>

                        {/* Source */}
                        <div className="col-span-2 text-[#00D6A3] uppercase text-xs pt-0.5">
                            {(item.source_type || 'unknown').replace('_', ' ')}
                        </div>

                        {/* Content */}
                        <div className="col-span-8 overflow-hidden">
                            <div className="text-[#E0E0E0] truncate">
                                {item.content || (item.metadata ? JSON.stringify(item.metadata.context || item.metadata) : 'NO_CONTENT')}
                            </div>

                            {/* Metadata Link (if exists) */}
                            {item.metadata?.url && (
                                <a
                                    href={item.metadata.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block mt-1 text-xs text-[#666] hover:text-white truncate flex items-center gap-1 w-fit"
                                >
                                    <ExternalLink size={10} />
                                    {item.metadata.title || item.metadata.url}
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NeuralLink;

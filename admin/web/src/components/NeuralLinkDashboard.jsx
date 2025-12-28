import React from 'react';
import NeuralLink from './NeuralLink';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useNeuralStream } from '../hooks/useNeuralStream';

/**
 * NEURAL LINK // MINIMALIST
 * Performance-first, typography-centric layout.
 */
const NeuralLinkDashboard = () => {
    const navigate = useNavigate();
    const { feed, loading, error, signalStrength, lastSync } = useNeuralStream(3000);

    return (
        <div className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono p-4 md:p-12 selection:bg-white/20">

            {/* Minimal Header */}
            <header className="mb-12 flex flex-col gap-4 max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="w-fit text-xs text-[#666] hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    RETURN_ROOT
                </button>

                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
                        Neural Link
                    </h1>
                    <div className="flex flex-wrap gap-6 text-xs text-[#666] uppercase tracking-wider">
                        <span>STATUS: <span className={!error ? "text-[#00D6A3]" : "text-red-500"}>{!error ? "ONLINE" : "OFFLINE"}</span></span>
                        <span>SIGNAL: {signalStrength}%</span>
                        <span>SYNC: {lastSync?.toLocaleTimeString() || "PENDING"}</span>
                        <span>ITEMS: {feed.length}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-4xl mx-auto">
                {/* Simplified Feed Container */}
                <div className="border-t border-[#333] pt-8">
                    <NeuralLink feed={feed} loading={loading} error={error} minimal={true} />
                </div>
            </main>

        </div>
    );
};

export default NeuralLinkDashboard;

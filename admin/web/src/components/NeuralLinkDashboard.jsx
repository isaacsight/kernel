import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, Cpu, Network, Shield, Zap,
    Database, Server, Lock, Clock, AlertCircle,
    CheckCircle2, Search, Brain, Layers, ExternalLink,
    Terminal, ArrowLeft, RefreshCw
} from 'lucide-react';
import NeuralLink from './NeuralLink';
import { useNavigate } from 'react-router-dom';

/**
 * NEURAL LINK DEDICATED DASHBOARD
 * "The Physics of Reasoning in Real-Time"
 */

const Card = ({ children, className = "" }) => (
    <div className={`bg-black/40 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden ${className}`}>
        {children}
    </div>
);

const TelemetryItem = ({ label, value, color = "text-white/60" }) => (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 font-mono">
        <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">{label}</span>
        <span className={`text-[11px] font-bold ${color}`}>{value}</span>
    </div>
);

const NeuralLinkDashboard = () => {
    const navigate = useNavigate();
    const [nodeHealth, setNodeHealth] = useState("OPTIMAL");
    const [signalStrength, setSignalStrength] = useState(98);

    // Simulate some ticking telemetry
    useEffect(() => {
        const interval = setInterval(() => {
            setSignalStrength(s => Math.max(92, Math.min(100, s + (Math.random() - 0.5) * 2)));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-screen bg-[#020202] text-white font-sans flex flex-col overflow-hidden selection:bg-[#00D6A3]/20">

            {/* --- TOP HUD --- */}
            <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="space-y-0.5">
                        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white/90 flex items-center gap-3">
                            <Activity size={14} className="text-[#00D6A3]" />
                            Neural Link // Cognitive Cockpit
                        </h1>
                        <div className="text-[9px] font-mono text-[#00D6A3]/60 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00D6A3] animate-pulse" />
                            Live Telemetry Stream • Node: BETA_NODE [0xCF42]
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8 font-mono">
                    <div className="hidden md:flex flex-col items-end gap-0.5">
                        <span className="text-[9px] text-white/20 uppercase tracking-tighter">Signal Stability</span>
                        <span className="text-xs font-bold text-[#00D6A3]">{signalStrength.toFixed(1)}%</span>
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-0.5">
                        <span className="text-[9px] text-white/20 uppercase tracking-tighter">Uplink Status</span>
                        <span className="text-xs font-bold text-[#00D6A3]">ENCRYPTED</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[9px] text-white/20 uppercase tracking-tighter">Latency</span>
                        <span className="text-xs font-bold text-[#00D6A3]">14ms</span>
                    </div>
                </div>
            </header>

            {/* --- MAIN INTERFACE --- */}
            <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 min-h-0 relative">

                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[url('/assets/grid.png')] opacity-[0.03] pointer-events-none" />

                {/* LEFT COLUMN: PRIMARY FEED */}
                <div className="flex-1 flex flex-col min-h-0 relative group">
                    <div className="absolute -top-3 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-[#00D6A3] uppercase z-10">
                        Mission_Control // Intake_Stream
                    </div>

                    <Card className="flex-1 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/5 bg-black/80">
                        <NeuralLink />
                    </Card>
                </div>

                {/* RIGHT COLUMN: SYSTEM METASTATE */}
                <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">

                    {/* NODE INTROSPECTION */}
                    <div className="relative">
                        <div className="absolute -top-2 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-white/30 uppercase z-10">
                            Node_Introspection
                        </div>
                        <Card className="p-5 bg-white/[0.02]">
                            <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-[#00D6A3]/5 border border-[#00D6A3]/10">
                                    <div className="text-[9px] font-black text-[#00D6A3]/40 uppercase tracking-widest mb-1">Active Reasoning Loop</div>
                                    <div className="text-xs font-medium text-white/80 leading-relaxed">
                                        The OS is currently synthesizing browser hover signals into the <span className="text-[#00D6A3]">Passive Learning</span> buffer.
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <TelemetryItem label="Brain Cycles" value="1.2M / sec" />
                                    <TelemetryItem label="Synaptic Weight" value="4.2.1-δ" />
                                    <TelemetryItem label="Memory Pressure" value="Low" color="text-[#00D6A3]" />
                                    <TelemetryItem label="Inference Engine" value="TitanV3" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* COGNITIVE LOAD PANEL */}
                    <div className="flex-1 relative min-h-0">
                        <div className="absolute -top-2 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-white/30 uppercase z-10">
                            Cognitive_Audit
                        </div>
                        <Card className="h-full p-5 flex flex-col bg-white/[0.01]">
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-amber-500/10 rounded-md text-amber-500 shrink-0">
                                            <Shield size={14} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-white/60 mb-0.5">Sovereign Audit Active</div>
                                            <div className="text-[10px] text-white/30 font-mono leading-tight">
                                                Page content is being cross-referenced with your current Strategic Roadmap.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-[#00D6A3]/10 rounded-md text-[#00D6A3] shrink-0">
                                            <Brain size={14} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-white/60 mb-0.5">Intent Detection</div>
                                            <div className="text-[10px] text-white/30 font-mono leading-tight">
                                                Passive interest identified in 'Agentic Systems Design'. Buffer expanded.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 mt-4">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-3">System Constants</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded bg-white/5 text-center">
                                                <div className="text-[8px] text-white/20 uppercase">Phi</div>
                                                <div className="text-xs font-bold text-[#00D6A3]">0.942</div>
                                            </div>
                                            <div className="p-2 rounded bg-white/5 text-center">
                                                <div className="text-[8px] text-white/20 uppercase">Entropy</div>
                                                <div className="text-xs font-bold text-white">0.12</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-white/5">
                                <button className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-[#00D6A3]/10 hover:border-[#00D6A3]/30 transition-all flex items-center justify-center gap-2 group">
                                    <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                                    Reset Neural Handshake
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NeuralLinkDashboard;

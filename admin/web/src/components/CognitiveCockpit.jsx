import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Cpu, Network, Shield, Zap, Terminal,
    Database, Server, Lock, Clock, AlertCircle,
    CheckCircle2, Search, Brain, Layers
} from 'lucide-react';
import NeuralLink from './NeuralLink';

/**
 * COGNITIVE COCKPIT V1
 * "Exposing the Physics of Reasoning"
 * 
 * Design Philosophy:
 * - Raw Telemetry over Polish
 * - Monospace Data Density
 * - High-Contrast System Status
 */

const Card = ({ children, className = "" }) => (
    <div className={`bg-black/40 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden ${className}`}>
        {children}
    </div>
);

const MetricRow = ({ label, value, unit, trend }) => (
    <div className="flex justify-between items-end py-1 border-b border-white/5 last:border-0">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-[#00D6A3] font-mono">{value}</span>
            <span className="text-[9px] text-white/30 ml-1">{unit}</span>
        </div>
    </div>
);

const PulseGraph = ({ label, color = "#00D6A3", data }) => (
    <div className="h-24 w-full relative group">
        <div className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest text-white/30 z-10 group-hover:text-white/60 transition-colors">
            {label}
        </div>
        <div className="absolute inset-0 flex items-end px-2 pb-2 gap-[2px]">
            {data.map((h, i) => (
                <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex-1 bg-current opacity-20 rounded-t-sm"
                    style={{ color: i === data.length - 1 ? '#fff' : color }}
                />
            ))}
        </div>
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
    </div>
);

const CognitiveCockpit = () => {
    // --- State ---
    const [systemLoad, setSystemLoad] = useState("LOW");
    const [uplinkStatus, setUplinkStatus] = useState("ACTIVE");
    const [cpuData, setCpuData] = useState(Array(30).fill(10));
    const [memData, setMemData] = useState(Array(30).fill(20));

    // --- Mock Data Generators (Simulating Telemetry) ---
    useEffect(() => {
        const interval = setInterval(() => {
            // Simulate CPU/Mem Fluctuation
            setCpuData(prev => [...prev.slice(1), Math.max(5, Math.min(90, prev[prev.length - 1] + (Math.random() - 0.5) * 20))]);
            setMemData(prev => [...prev.slice(1), Math.max(10, Math.min(60, prev[prev.length - 1] + (Math.random() - 0.5) * 5))]);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    // --- Pulse Data generator already defined above ---

    return (
        <div className="w-full h-screen bg-[#020202] text-white font-sans p-4 md:p-8 flex flex-col overflow-hidden">

            {/* --- HEADER: VITAL SIGNS --- */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-white/5 shrink-0">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white/90">
                        Cognitive Observability
                    </h1>
                    <p className="text-sm text-white/40 font-light max-w-2xl">
                        Exposing the physics of reasoning. Live telemetry from <span className="text-[#00D6A3] font-mono">BETA_NODE</span>.
                    </p>
                </div>

                <div className="flex items-center gap-6 mt-4 md:mt-0 font-mono text-[10px] uppercase tracking-widest">
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-white/30">System Load</span>
                        <span className={`font-bold ${systemLoad === 'HIGH' ? 'text-red-500' : 'text-[#00D6A3]'}`}>
                            [{systemLoad}]
                        </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-white/30">Uplink</span>
                        <span className="text-[#00D6A3] font-bold">[{uplinkStatus}]</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-white/30">Node</span>
                        <span className="text-white/60">BETA_NODE</span>
                    </div>
                </div>
            </header>

            {/* --- MAIN DASHBOARD GRID --- */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

                {/* LEFT: NEURAL LINK (Live Data Feed) */}
                <div className="lg:col-span-8 flex flex-col relative group">
                    <div className="absolute -top-3 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-[#00D6A3] uppercase z-10">
                        Neural Link // Live Stream
                    </div>

                    <Card className="flex-1 flex flex-col relative bg-black/60 shadow-2xl overflow-hidden">
                        <NeuralLink />
                    </Card>
                </div>

                {/* RIGHT: PULSE PANE (Metrics) */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* CPU / MEM GRAPHS */}
                    <div className="relative">
                        <div className="absolute -top-2 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-white/30 uppercase z-10">
                            Pulse Pane
                        </div>
                        <Card className="p-4 space-y-6">
                            <div className="space-y-1">
                                <div className="flex justify-between items-end px-2">
                                    <span className="text-[10px] font-mono text-white/40">CPU Usage</span>
                                    <span className="text-lg font-bold font-mono text-white">{cpuData[cpuData.length - 1].toFixed(1)}%</span>
                                </div>
                                <PulseGraph label="" data={cpuData} color="#00D6A3" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-end px-2">
                                    <span className="text-[10px] font-mono text-white/40">Memory Utilization</span>
                                    <span className="text-lg font-bold font-mono text-white">{memData[memData.length - 1].toFixed(1)} GB</span>
                                </div>
                                <PulseGraph label="" data={memData} color="#3B82F6" />
                            </div>
                        </Card>
                    </div>

                    {/* VITAL STATISTICS */}
                    <div className="flex-1 relative">
                        <div className="absolute -top-2 left-4 bg-[#020202] px-2 text-[9px] font-black tracking-[0.2em] text-white/30 uppercase z-10">
                            System Vitals
                        </div>
                        <Card className="h-full p-6 flex flex-col gap-4">
                            <MetricRow label="Network Throughput" value="1.2" unit="Gbps" />
                            <MetricRow label="Disk I/O Read" value="450" unit="MB/s" />
                            <MetricRow label="Disk I/O Write" value="320" unit="MB/s" />
                            <MetricRow label="Active Threads" value="124" unit="THRDS" />
                            <MetricRow label="Context Window" value="94" unit="TOKENS (K)" />

                            <div className="mt-auto pt-4 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                        <Shield size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-white/40 tracking-widest">Security Status</div>
                                        <div className="text-sm font-bold text-white">SECURE</div>
                                    </div>
                                    <div className="ml-auto text-[9px] font-mono text-white/20">
                                        {new Date().toISOString().split('T')[0]}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CognitiveCockpit;

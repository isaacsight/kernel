import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Terminal, Cpu, Users, Zap, ChevronRight, MessageSquare,
    User, Sparkles, ArrowUp, Clock, Activity, Shield,
    AlertCircle, CheckCircle2, ChevronDown, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import sitePrompts from '../data/site_prompts.json'; // Import Prompts

import NeuralLink from './NeuralLink';
import MissionControl from './MissionControl';
import VaultIngest from './VaultIngest';

const apiBase = `http://${window.location.hostname}:8000`;

const AgentCard = ({ label, value, sub, icon: Icon, color = "text-[#00D6A3]" }) => (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col justify-between group hover:border-white/10 transition-all">
        <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{label}</span>
            <Icon size={12} className={`${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
        </div>
        <div>
            <div className="text-xl font-black text-white tracking-tight">{value}</div>
            <div className="text-[9px] text-white/40 font-mono mt-1 truncate">{sub}</div>
        </div>
    </div>
);

const EventRow = ({ log }) => (
    <div className="flex gap-3 text-[10px] py-1.5 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors font-mono">
        <span className="text-white/20 w-14 shrink-0">{log.t}</span>
        <span className={`w-8 font-bold ${log.type === 'SEC' ? 'text-red-400' :
            log.type === 'SYS' ? 'text-amber-400' : 'text-[#00D6A3]'
            }`}>{log.type}</span>
        <span className="text-white/60 truncate flex-1">{log.msg}</span>
    </div>
);

const Dashboard = () => {
    const [messages, setMessages] = useState([]);
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState(["STATUS", "RUN EVALS", "PREP BRIEF"]);
    const [missionExpanded, setMissionExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState(0); // Cognitive Load Balancer State
    const [mission, setMission] = useState(null);
    const [agents, setAgents] = useState([]);
    const [leftView, setLeftView] = useState("mission"); // "mission" or "vault"

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [missionRes, agentsRes] = await Promise.all([
                    axios.get(`${apiBase}/api/mission/status`),
                    axios.get(`${apiBase}/api/mission/status`) // Temporarily same endpoint if needed, but we wanted status
                ]);
                // Re-fetch mission status specifically
                const m = await axios.get(`${apiBase}/api/mission/status`);
                setMission(m.data);

                const a = await axios.get(`${apiBase}/api/agents/status`);
                setAgents(a.data.agents || []);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // 5s pulse
        return () => clearInterval(interval);
    }, []);

    // Initial Logs
    const [logs] = useState([
        { t: "11:12:31", type: "SYS", msg: "Protocol Exception: Request failed" },
        { t: "11:10:05", type: "OK", msg: "GET /api/studio/status 200" },
        { t: "11:09:45", type: "SEC", msg: "Handshake verified: BETA_NODE" },
        { t: "11:05:00", type: "AUD", msg: "Cognitive drift check passed" },
        { t: "11:01:12", type: "INF", msg: "Relay node latency nominal" },
    ]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleCommand = async (e) => {
        if (e) e.preventDefault();
        if (!command.trim()) return;

        const input = command.trim();
        setMessages(prev => [...prev, { type: 'user', content: input, timestamp: new Date().toLocaleTimeString([], { hour12: false }) }]);
        setCommand('');
        setLoading(true);

        // Simulation for demo
        setTimeout(() => {
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: `Command '${input}' recognized. Executing protocol...`,
                timestamp: new Date().toLocaleTimeString([], { hour12: false })
            }]);
            setLoading(false);
        }, 600);
    };

    return (
        <div className="min-h-screen md:h-screen flex flex-col bg-[#050505] text-white font-sans overflow-visible md:overflow-hidden selection:bg-[#00D6A3]/20">

            {/* 1. TOP ZONE: SYSTEM STATUS STRIP (Sticky Mobile, Fixed Desktop) */}
            <header className="h-12 md:h-14 bg-[#020202] border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0 z-50">
                {/* Left: Status Badges */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 text-[#00D6A3] whitespace-nowrap">
                        <Zap size={14} className="fill-current" />
                        <span className="text-[10px] md:text-[11px] font-black tracking-[0.15em] hidden md:inline">FRONTIER INTELLIGENCE ACTIVE</span>
                        <span className="text-[10px] font-black tracking-[0.15em] md:hidden">FRONTIER ACTIVE</span>
                    </div>
                    <div className="h-3 w-px bg-white/10 hidden md:block" />
                    <div className="hidden md:flex gap-4 text-[9px] font-mono font-bold text-white/40 uppercase tracking-wider">
                        <span className="text-[#00D6A3]">SYS_READY</span>
                        <span>NET_LINK_SECURE</span>
                        <span className="text-white/60">TRUST: HIGH</span>
                    </div>
                </div>

                {/* Right: Node Info */}
                <div className="flex items-center gap-4 text-[9px] font-mono text-white/30 uppercase tracking-wider">
                    <span className="hidden md:inline">FOUNDRY LABS KK [BETA_NODE]</span>
                    <span className="hidden md:inline text-[#00D6A3]">142ms</span>
                    <div className="w-2 h-2 rounded-full bg-[#00D6A3] animate-pulse md:hidden" />
                </div>
            </header>

            {/* MAIN LAYOUT: Scrollable Body */}
            <main className="flex-1 flex flex-col md:overflow-hidden relative">

                {/* MIDDLE ZONE: CONTENT (Desktop: Split, Mobile: Stack) */}
                <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">

                    {/* LEFT COLUMN (Desktop) / TOP (Mobile): Mission & Events */}
                    <div className="md:w-[45%] md:border-r border-white/5 flex flex-col md:overflow-hidden">

                        {/* VIEW TOGGLE */}
                        <div className="flex border-b border-white/5 bg-black/20">
                            <button
                                onClick={() => setLeftView("mission")}
                                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${leftView === 'mission' ? 'text-[#00D6A3] bg-[#00D6A3]/5 border-b border-[#00D6A3]' : 'text-white/20 hover:text-white/40'}`}
                            >
                                Mission Feed
                            </button>
                            <button
                                onClick={() => setLeftView("vault")}
                                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${leftView === 'vault' ? 'text-amber-400 bg-amber-400/5 border-b border-amber-400' : 'text-white/20 hover:text-white/40'}`}
                            >
                                Sovereignty Vault
                            </button>
                        </div>

                        {/* LEFT COLUMN CONTENT */}
                        <div className="p-4 md:p-6 border-b border-white/5 bg-white/[0.01]">
                            {leftView === 'mission' ? (
                                <MissionControl mission={mission} />
                            ) : (
                                <VaultIngest />
                            )}
                        </div>

                        {/* DESKTOP: NEURAL LINK FEED / MOBILE: CARD LIST */}
                        <div className="flex-1 flex flex-col h-auto md:h-full overflow-visible md:overflow-hidden bg-[#080808]">
                            <NeuralLink />
                        </div>
                    </div>

                    {/* RIGHT COLUMN (Desktop) / MIDDLE (Mobile): Metrics & Console */}
                    <div className="flex-1 flex flex-col md:overflow-hidden bg-[#050505]">

                        {/* METRICS GRID */}
                        <div className="p-4 md:p-6 border-b border-white/5">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 flex items-center gap-2">
                                <Activity size={10} /> SYSTEM_HEALTH_HARD_METRICS
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <AgentCard
                                    label="Operator Intelligence"
                                    value="94.2%"
                                    sub="Last run: 2h ago"
                                    icon={Cpu}
                                />
                                <AgentCard
                                    label="Refusal Rate"
                                    value="7.2%"
                                    sub="Uncertainty Index: Stable"
                                    icon={Shield}
                                    color="text-amber-400"
                                />
                                <AgentCard
                                    label="Intervention [24h]"
                                    value="02"
                                    sub="GREEN: NOMINAL PATH"
                                    icon={AlertCircle}
                                />
                                <div className="hidden md:flex p-4 rounded-xl border border-white/5 bg-white/[0.01] flex-col justify-center items-center text-center gap-2">
                                    <div className="text-[9px] uppercase tracking-widest text-white/20">Pending Directives</div>
                                    <div className="text-xl font-mono text-white/40">01</div>
                                </div>
                            </div>
                        </div>

                        {/* DESKTOP CONSOLE PANEL (Hidden on Mobile, replaced by sticky bottom) */}
                        <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-black/40">
                            <div className="px-6 py-3 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">COMMAND CONSOLE</h3>
                            </div>

                            {/* Output Area */}
                            <div className="flex-1 overflow-visible md:overflow-y-auto p-4 font-mono text-[11px] space-y-2 custom-scrollbar">
                                {messages.map((m, i) => (
                                    <div key={i} className={`${m.type === 'user' ? 'text-white/60' : 'text-[#00D6A3]'}`}>
                                        <span className="text-white/20 mr-3">{m.timestamp}</span>
                                        <span className="font-bold mr-2">{m.type === 'user' ? 'OPERATOR >' : 'CORE >'}</span>
                                        <span>{m.content}</span>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Category Tabs & Prompts */}
                            <div className="p-4 border-t border-white/5 bg-[#080808]">
                                <form onSubmit={handleCommand} className="flex gap-3 mb-3">
                                    <div className="flex-1 relative">
                                        <Terminal size={14} className="absolute top-3 left-3 text-white/20" />
                                        <input
                                            value={command}
                                            onChange={(e) => setCommand(e.target.value)}
                                            placeholder="Type a directive... (STATUS, RUN EVALS)"
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white focus:border-[#00D6A3]/50 focus:bg-black transition-all outline-none font-mono placeholder:text-white/10"
                                        />
                                    </div>
                                    <button type="submit" className="px-4 rounded-lg bg-[#00D6A3] text-black font-bold text-[10px] uppercase tracking-wider hover:brightness-110 transition-all">
                                        EXEC
                                    </button>
                                </form>

                                {/* Cognitive Load Balancer: Category Tabs */}
                                <div className="flex gap-2 mb-3 overflow-x-auto custom-scrollbar pb-1">
                                    {sitePrompts.map((cat, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveCategory(i)}
                                            className={`whitespace-nowrap px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all
                                                ${activeCategory === i
                                                    ? 'bg-[#00D6A3] text-black shadow-[0_0_10px_rgba(0,214,163,0.3)]'
                                                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            {cat.category}
                                        </button>
                                    ))}
                                </div>

                                {/* Active Prompts Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                                    {sitePrompts[activeCategory].prompts.map((p, j) => (
                                        <button
                                            key={j}
                                            onClick={() => setCommand(p.command)}
                                            title={p.command}
                                            className="px-3 py-2 rounded bg-white/5 border border-white/5 text-[9px] font-mono text-white/60 hover:text-[#00D6A3] hover:border-[#00D6A3]/30 hover:bg-[#00D6A3]/5 transition-all text-left flex items-center gap-2 group truncate"
                                        >
                                            {/* We could map icons here later */}
                                            <span className="opacity-50 group-hover:opacity-100 transition-opacity truncate">
                                                {p.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* MOBILE: STICKY BOTTOM CONSOLE */}
            <div className="md:hidden border-t border-white/10 bg-[#080808] p-4 pb-6 min-h-[140px] flex flex-col justify-end sticky bottom-0 z-50">
                {/* Mini Chat Preview (Last 2 messsages) */}
                <div className="mb-3 space-y-1 overflow-hidden h-12 mask-image-gradient-to-t">
                    {messages.slice(-2).map((m, i) => (
                        <div key={i} className="text-[10px] font-mono truncate">
                            <span className="text-white/30 mr-2">{m.timestamp}</span>
                            <span className={m.type === 'user' ? 'text-white/60' : 'text-[#00D6A3]'}>{m.content}</span>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleCommand} className="flex gap-2">
                    <input
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type directive..."
                        className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00D6A3]/50 outline-none font-mono"
                    />
                    <button type="submit" className="p-2.5 rounded-lg bg-[#00D6A3] text-black">
                        <ArrowUp size={16} />
                    </button>
                </form>
                <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                    {/* Active Category Tabs - Mobile */}
                    {sitePrompts.map((cat, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                // Logic to switch tab would go here if we tracked state on mobile
                                // For now, just show all but grouped
                            }}
                            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 text-[10px] font-mono text-white/50 border border-white/5 hover:bg-[#00D6A3]/10 hover:text-[#00D6A3] transition-colors"
                        >
                            {cat.category.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

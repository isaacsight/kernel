import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Radio, Terminal, Database, Users, User, Server, Cpu, Layers, GitBranch, Lock } from 'lucide-react';

// --- CONFIGURATION ---
const ISOMETRIC_ANGLE = 'rotateX(60deg) rotateZ(-45deg)';
const REVERSE_ANGLE = 'rotateZ(45deg) rotateX(-60deg)';

const ZONES = {
    // Top Layer (Output)
    PUBLIC: { id: 'PUBLIC', label: 'Public Surface', sub: 'Reputation', icon: Shield, color: 'text-white', bg: 'bg-white/10', border: 'border-white/50', gridPos: 'col-start-3 row-start-1' },

    // Middle Layer (Processing)
    CONTENT: { id: 'CONTENT', label: 'Synthetic Infinite', sub: 'Data Engine', icon: Layers, color: 'text-purple-400', bg: 'bg-purple-900/40', border: 'border-purple-500/50', gridPos: 'col-start-1 row-start-2' },
    CODE: { id: 'CODE', label: 'Self-Healing', sub: 'DSPy Migrator', icon: GitBranch, color: 'text-orange-400', bg: 'bg-orange-900/40', border: 'border-orange-500/50', gridPos: 'col-start-3 row-start-2' },

    // Bottom Layer await (Foundation)
    MEMORY: { id: 'MEMORY', label: 'Context Bridge', sub: 'MCP Server', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-500/50', gridPos: 'col-start-2 row-start-3' },
    HARDWARE: { id: 'HARDWARE', label: 'Privacy Pod', sub: 'Local Inference', icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-500/50', gridPos: 'col-start-1 row-start-3' },

    // Center Authority
    HUMAN: { id: 'HUMAN', label: 'AUTHORITY NODE', sub: 'HIL Socket', icon: User, color: 'text-yellow-400', bg: 'bg-yellow-900/40', border: 'border-yellow-500/80', gridPos: 'col-start-2 row-start-2' },
};

const AGENT_TYPES = {
    CONTEXT_BRIDGE: { id: 'CONTEXT_BRIDGE', label: 'MCP Connector', icon: '🔌', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/50' },
    DSPY_OPTIMIZER: { id: 'DSPY_OPTIMIZER', label: 'DSPy Optimizer', icon: '⚡', color: 'bg-orange-500', shadow: 'shadow-orange-500/50' },
    PRIVACY_POD: { id: 'PRIVACY_POD', label: 'Local Whisper', icon: '🔒', color: 'bg-blue-500', shadow: 'shadow-blue-500/50' },
    SYNTHETIC_GEN: { id: 'SYNTHETIC_GEN', label: 'Synthetic UX', icon: '👾', color: 'bg-purple-500', shadow: 'shadow-purple-500/50' },
};

const StudioSimulation = () => {
    const [agents, setAgents] = useState([]);
    const [authorityMode, setAuthorityMode] = useState(true);
    const [logs, setLogs] = useState(['SYSTEM INITIALIZED...', '2026 THESIS PROTOCOLS ACTIVE']);
    const [authorityBudget, setAuthorityBudget] = useState(10);
    const [pendingAuth, setPendingAuth] = useState(null);

    // --- Engine ---
    useEffect(() => {
        const interval = setInterval(() => {
            runSimulationStep();
        }, 1200);
        return () => clearInterval(interval);
    }, [authorityMode, agents, pendingAuth]);

    const runSimulationStep = () => {
        // 1. Spawn Mechanism
        if (Math.random() > 0.6) spawnAgent();

        // 2. Move Logic
        setAgents(prev => prev.map(processAgent).filter(a => !a.complete));
    };

    const spawnAgent = () => {
        // Select specific 2026 Project Agents
        const types = Object.keys(AGENT_TYPES);
        const typeKey = types[Math.floor(Math.random() * types.length)];
        const type = AGENT_TYPES[typeKey];

        // Define Routes based on Thesis
        let start = 'HARDWARE';
        let target = 'PUBLIC';

        if (typeKey === 'CONTEXT_BRIDGE') { start = 'MEMORY'; target = 'CONTENT'; } // MCP -> Content
        if (typeKey === 'DSPY_OPTIMIZER') { start = 'CODE'; target = 'PUBLIC'; } // Code -> Deploy
        if (typeKey === 'PRIVACY_POD') { start = 'HARDWARE'; target = 'MEMORY'; } // Local -> Memory
        if (typeKey === 'SYNTHETIC_GEN') { start = 'CONTENT'; target = 'CODE'; } // Data -> Model

        const newAgent = {
            id: Date.now() + Math.random(),
            type: type,
            zone: start,
            target: target,
            state: 'MOVING',
            progress: 0,
            intent: `${type.label} Action`,
        };

        setAgents(prev => [...prev, newAgent]);
        addLog(`[SPAWN] ${type.label} initialized in ${ZONES[start].label}`);
    };

    const processAgent = (agent) => {
        if (agent.state === 'WAITING_AUTH') return agent;

        if (agent.progress < 100) {
            return { ...agent, progress: agent.progress + 15 };
        }

        // Hit Gate
        if (agent.state === 'MOVING') {
            const isCritical = agent.type.id === 'DSPY_OPTIMIZER' || agent.type.id === 'SYNTHETIC_GEN';

            if (authorityMode && isCritical) {
                if (!pendingAuth) {
                    setPendingAuth(agent.id);
                    addLog(`[GATE] ${agent.type.label} BLOCKED. Requesting HIL.`);
                    return { ...agent, state: 'WAITING_AUTH' };
                } else {
                    addLog(`[GATE] ${agent.type.label} REJECTED (Queue Full).`);
                    return { ...agent, complete: true };
                }
            }
            return { ...agent, complete: true };
        }
        return agent;
    };

    const addLog = (msg) => setLogs(p => [msg, ...p].slice(0, 8));

    const handleAuth = (approved) => {
        if (!pendingAuth) return;
        setAgents(prev => prev.map(a => {
            if (a.id === pendingAuth) {
                addLog(`[AUTH] ${approved ? 'APPROVED' : 'DENIED'} ${a.type.label}`);
                if (approved) setAuthorityBudget(b => b - 1);
                return { ...a, complete: true, state: approved ? 'EXECUTING' : 'BLOCKED' };
            }
            return a;
        }));
        setPendingAuth(null);
    };

    return (
        <div className="h-screen bg-[#050505] text-white font-mono overflow-hidden flex flex-col perspective-1000">

            {/* UI Overlay (HUD) */}
            <div className="absolute top-0 left-0 w-full z-50 p-6 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <h1 className="text-xl font-bold tracking-widest text-white/90">STUDIO_OS V2.0</h1>
                    <div className="text-xs text-white/50 mt-1">DETERMINISTIC AGENCY SIMULATOR</div>
                    <div className="mt-4 flex flex-col gap-2">
                        <button onClick={() => setAuthorityMode(!authorityMode)} className={`px-4 py-2 text-xs border ${authorityMode ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-red-500 bg-red-900/20 text-red-500'}`}>
                            GUARDRAILS: {authorityMode ? 'ON' : 'OFF'}
                        </button>
                        <div className="text-xs text-white/40">AUTH_BUDGET: {authorityBudget}</div>
                    </div>
                </div>

                <div className="w-64 bg-black/80 backdrop-blur border border-white/10 p-4 rounded text-[10px] pointer-events-auto">
                    <div className="border-b border-white/10 pb-2 mb-2 font-bold text-white/60">SYSTEM TRACE</div>
                    {logs.map((l, i) => <div key={i} className="mb-1 text-white/70 truncate">{`> ${l}`}</div>)}
                </div>
            </div>

            {/* ISOMETRIC WORLD */}
            <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#020202]">
                <div
                    className="relative w-[800px] h-[800px] grid grid-cols-3 grid-rows-3 gap-8"
                    style={{ transform: ISOMETRIC_ANGLE, transformStyle: 'preserve-3d' }}
                >
                    {/* Base Grid Plane */}
                    <div className="absolute inset-0 border-2 border-white/5 rounded-3xl" style={{ transform: 'translateZ(-50px)' }} />

                    {/* Zones */}
                    <IsoZone zone={ZONES.CONTENT} agents={agents} />
                    <IsoZone zone={ZONES.PUBLIC} agents={agents} isHigh />
                    <IsoZone zone={ZONES.CODE} agents={agents} />

                    <IsoZone zone={ZONES.HARDWARE} agents={agents} />

                    {/* Center Authority Node */}
                    <div className={`col-start-2 row-start-2 relative transition-all duration-500`} style={{ transformStyle: 'preserve-3d' }}>
                        <div className={`absolute inset-0 rounded-xl border-4 ${pendingAuth ? 'border-yellow-500 bg-yellow-900/40' : 'border-white/10 bg-[#111]'} transition-colors duration-500 shadow-2xl`}
                            onClick={() => pendingAuth && handleAuth(true)}
                        >
                            {/* 3D Height Extrusion */}
                            <div className="absolute -inset-1 top-0 bg-yellow-500/10 blur-xl" style={{ transform: 'translateZ(-20px)' }} />
                        </div>

                        {/* Floating Icon */}
                        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'translateZ(60px) ' + REVERSE_ANGLE }}>
                            <div className="flex flex-col items-center cursor-pointer pointer-events-auto" onClick={() => pendingAuth && handleAuth(true)}>
                                <User size={40} className={pendingAuth ? 'text-yellow-400 animate-pulse' : 'text-white/20'} />
                                {pendingAuth && <div className="mt-2 bg-black/90 px-3 py-1 rounded text-[10px] text-yellow-400 border border-yellow-500">CLICK TO AUTHORIZE</div>}
                            </div>
                        </div>
                    </div>

                    <IsoZone zone={ZONES.CODE} agents={agents} /> {/* Duplicate for grid layout fix? No, removing. */}

                    <IsoZone zone={ZONES.MEMORY} agents={agents} />

                    {/* Render Agents - Floating in 3D Space */}
                    {agents.map(agent => (
                        <IsoAgent key={agent.id} agent={agent} />
                    ))}

                </div>
            </div>

        </div>
    );
};

const IsoZone = ({ zone, agents, isHigh }) => {
    return (
        <div className={`${zone.gridPos} relative group transition-all duration-500`} style={{ transformStyle: 'preserve-3d' }}>
            {/* Floor Plate */}
            <div className={`absolute inset-0 rounded-2xl border ${zone.border} ${zone.bg} backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-transform group-hover:translate-z-4`}
                style={{ transform: isHigh ? 'translateZ(40px)' : 'translateZ(0px)' }}
            >
                {/* 3D Wall Thickness Effect */}
                <div className={`absolute -bottom-2 left-0 right-0 h-2 ${zone.bg.replace('/40', '/80')} rounded-b-2xl`} style={{ transformOrigin: 'bottom', transform: 'rotateX(-90deg)' }} />
            </div>

            {/* Label (Floating billboard) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: (isHigh ? 'translateZ(80px)' : 'translateZ(40px)') + ' ' + REVERSE_ANGLE }}>
                <zone.icon size={24} className={`${zone.color} mb-2 opacity-80`} />
                <div className={`text-sm font-bold ${zone.color} tracking-wider`}>{zone.label}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest">{zone.sub}</div>
            </div>
        </div>
    );
};

const IsoAgent = ({ agent }) => {
    // Coordinate Mapping (Simple 3x3 Grid + Z-height)
    // 0,0 is top-left
    const getCoords = (zoneId) => {
        const map = {
            'HARDWARE': { x: '-30%', y: '30%' },
            'MEMORY': { x: '0%', y: '30%' },
            'CONTENT': { x: '-30%', y: '0%' }, // Left Middle
            'HUMAN': { x: '0%', y: '0%' }, // Center
            'CODE': { x: '30%', y: '0%' }, // Right Middle
            'PUBLIC': { x: '30%', y: '-30%' } // Right Top
        };
        return map[zoneId] || { x: 0, y: 0 };
    };

    const start = getCoords(agent.zone);
    const end = getCoords(agent.target);
    const mid = getCoords('HUMAN'); // All paths go through center? 

    // Interpolate manually or just use Framer Motion layoutId? 
    // For 3D Iso, absolute positioning is trickier. 
    // Let's use specific motion values.

    // We'll simplistic interpolation:
    const isWaiting = agent.state === 'WAITING_AUTH';
    const hasPassed = agent.state === 'EXECUTING';

    // Target coordinate
    let targetX = end.x;
    let targetY = end.y;
    let targetZ = 60;

    if (isWaiting) { targetX = '0%'; targetY = '0%'; targetZ = 80; }

    return (
        <motion.div
            className={`absolute top-1/2 left-1/2 w-12 h-12 -ml-6 -mt-6 rounded-lg ${agent.type.color} ${agent.type.shadow} flex items-center justify-center border border-white/20 z-50`}
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ x: start.x, y: start.y, z: 40, opacity: 0 }}
            animate={{
                x: isWaiting ? '0%' : (hasPassed ? end.x : end.x), // Simplified direct path for now
                y: isWaiting ? '0%' : end.y,
                z: isWaiting ? 120 : 60,
                opacity: 1
            }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
        >
            {/* Billboard Content */}
            <div style={{ transform: REVERSE_ANGLE }} className="text-xl">
                {agent.type.icon}
            </div>
        </motion.div>
    );
};

export default StudioSimulation;

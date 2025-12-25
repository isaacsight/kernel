import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
    Bot, Building, Settings, Sparkles, Search, BookOpen,
    Diamond, Tag, Share2, Youtube, Database, Brain, Activity, ChevronRight, Info, AlertCircle,
    CheckCircle2, Clock, Shield, FlaskConical, Type
} from 'lucide-react';

/**
 * STUDIO OS COGNITIVE COCKPIT V5
 * High-performance Agent Galaxy Visualization
 * 
 * Performance: Instanced Rendering (60FPS)
 * Stability: Seed-based Coordinate system
 * Aesthetics: Hard Engineering / Cyber-Zen
 */

const COLORS = {
    primary: '#00D6A3',
    background: '#020202',
    text: '#FFFFFF',
    muted: '#8A908C',
    orchestration: '#3B82F6',
    intelligence: '#F59E0B',
    content: '#EC4899',
    research: '#60A5FA',
    safety: '#10B981',
    infra: '#8B5CF6',
    error: '#EF4444'
};

const CATEGORY_COLORS = {
    'Orchestration': COLORS.orchestration,
    'Intelligence': COLORS.intelligence,
    'Content': COLORS.content,
    'Research': COLORS.research,
    'Safety': COLORS.safety,
    'Infra': COLORS.infra,
    'General': COLORS.muted
};

const AGENT_ASSETS = {
    'Architect': Building,
    'Operator': Settings,
    'Visionary': Sparkles,
    'Alchemist': FlaskConical,
    'Editor': Type,
    'Guardian': Shield,
    'MLEngineer': Brain,
    'Lattice Architect': Brain,
    'Network Engineer': Activity,
    'Researcher': Search,
    'Web Scout': Search,
};

// Seed-based stable hash for positions
const getStableHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const GalaxyCore = ({ agents, onSelect, selectedId }) => {
    const meshRef = useRef();
    const [hoveredId, setHoveredId] = useState(null);
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);

    useFrame((state) => {
        if (!meshRef.current || agents.length === 0) return;
        const t = state.clock.getElapsedTime();

        agents.forEach((agent, i) => {
            const isSelected = selectedId === agent.id;
            const isHovered = hoveredId === agent.id;
            const intensity = agent.status === 'working' ? 1.5 : 1;
            const floatY = Math.sin(t * 1.5 * intensity + (agent.hash % 10)) * 0.08;

            tempObject.position.set(
                agent.position[0],
                agent.position[1] + floatY,
                agent.position[2]
            );

            const baseScale = 0.35;
            const targetScale = isSelected ? 1.5 : (isHovered ? 1.25 : 1 + Math.sin(t * 2 + agent.hash) * 0.05);
            tempObject.scale.setScalar(targetScale * baseScale);

            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            const color = CATEGORY_COLORS[agent.category] || COLORS.primary;
            tempColor.set(color);
            if (agent.status === 'working') {
                const pulse = 1.0 + Math.sin(t * 6) * 0.4;
                tempColor.multiplyScalar(pulse * 2);
            } else if (isSelected) {
                tempColor.multiplyScalar(2.5);
            } else {
                tempColor.multiplyScalar(isHovered ? 1.2 : 0.6);
            }
            meshRef.current.setColorAt(i, tempColor);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    const linesGeometry = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        if (agents.length < 2) return geometry;
        const points = [];
        const core = agents.find(a => a.name === 'Architect' || a.name === 'System Architect') || agents[0];
        agents.forEach(a => {
            if (a.id !== core.id) {
                points.push(...core.position, ...a.position);
            }
        });
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        return geometry;
    }, [agents]);

    return (
        <group>
            <instancedMesh
                ref={meshRef}
                args={[null, null, agents.length]}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(agents[e.instanceId]);
                }}
                onPointerOver={(e) => setHoveredId(agents[e.instanceId].id)}
                onPointerOut={() => setHoveredId(null)}
            >
                <sphereGeometry args={[1, 12, 12]} />
                <meshStandardMaterial roughness={1.0} metalness={0.0} />
            </instancedMesh>

            <lineSegments geometry={linesGeometry}>
                <lineBasicMaterial color={COLORS.primary} transparent opacity={0.6} />
            </lineSegments>

            {(hoveredId || selectedId) && (
                <Html
                    position={agents.find(a => a.id === (hoveredId || selectedId))?.position}
                    distanceFactor={10}
                    pointerEvents="none"
                >
                    <div className="px-3 py-1 rounded border border-[#00D6A3]/20 text-[10px] font-mono font-bold whitespace-nowrap bg-black/90 backdrop-blur-xl text-white translate-y-[-25px] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00D6A3] animate-pulse" />
                        {agents.find(a => a.id === (hoveredId || selectedId))?.name}
                    </div>
                </Html>
            )}
        </group>
    );
};

const SynapticLattice = () => {
    const [viewMode, setViewMode] = useState('graph');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agents, setAgents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:8000/agents/status`);
                const data = await res.json();

                const mapped = data.agents.map((agent, index) => {
                    const hash = getStableHash(agent.name);
                    const groups = ['Orchestration', 'Content', 'Intelligence', 'Research', 'Safety', 'Infra'];
                    const gIdx = groups.indexOf(agent.category);
                    const gOffset = gIdx === -1 ? 0 : (gIdx * (Math.PI * 2 / groups.length));

                    const radius = agent.category === 'Orchestration' ? 3 : 6 + (hash % 50) / 10;
                    const phi = Math.acos(-1 + (2 * index) / data.agents.length);
                    const theta = gOffset + (hash % 100) / 40;

                    return {
                        ...agent,
                        id: agent.name,
                        hash,
                        icon: AGENT_ASSETS[agent.name] || Bot,
                        position: [
                            radius * Math.cos(theta) * Math.sin(phi),
                            radius * Math.sin(theta) * Math.sin(phi),
                            radius * Math.cos(phi)
                        ]
                    };
                });

                setAgents(mapped);
                setSummary(data.summary);
                setLoading(false);
            } catch (err) {
                console.error("Lattice Sync Failure:", err);
                setLoading(false);
            }
        };

        fetchData();
        const timer = setInterval(fetchData, 5000);
        return () => clearInterval(timer);
    }, []);

    const grouped = useMemo(() => {
        const g = {};
        agents.forEach(a => {
            if (!g[a.category]) g[a.category] = [];
            g[a.category].push(a);
        });
        return g;
    }, [agents]);

    return (
        <div className="flex flex-col h-full w-full bg-[#020202] text-white font-mono uppercase select-none overflow-hidden relative">

            {/* UNIFIED HEADER (Matches Dashboard) */}
            <header className="h-10 border-b border-white/10 flex items-center px-4 bg-black/80 backdrop-blur-xl z-50 shrink-0">
                <div className="flex items-center gap-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-[#00D6A3]">
                        <Activity size={12} />
                        <span className="text-[10px] font-black tracking-[0.2em]">NEURAL LATTICE VISUALIZATION</span>
                    </div>
                    <div className="h-3 w-px bg-white/10" />
                    <div className="flex items-center gap-4 text-[9px] font-mono text-white/40 uppercase tracking-tighter">
                        <span>SYS_READY</span>
                        <span>V5_SUBSTRATE</span>
                        <span className="text-white/60">ACTIVE_INFERENCE_ENGINE</span>
                        <span>NODES: <span className="text-white">{agents.length}</span></span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000_100%)]">
                {/* Sidebar: Tactical Directory */}
                <div className="w-[340px] h-full border-r border-white/10 flex flex-col bg-gradient-to-b from-[#111] to-black backdrop-blur-3xl z-40 shadow-2xl">
                    <div className="p-6 border-b border-white/10">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#00D6A3]/40 mb-2 flex items-center gap-2">
                            <Brain size={10} />
                            DIRECTORY_INDEX
                        </h3>
                        <div className="text-[11px] font-black text-white">SYSTEM_AGENTS</div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-10 mt-4">
                        {Object.entries(grouped).map(([category, items]) => (
                            <div key={category} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black tracking-[0.3em] text-[#00D6A3] whitespace-nowrap">{category}</span>
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[#00D6A3]/20 to-transparent" />
                                    <span className="text-[9px] font-mono text-white/40">[{items.length}]</span>
                                </div>

                                <div className="grid gap-2">
                                    {items.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => setSelectedAgent(agent)}
                                            className={`w-full group p-4 rounded-2xl border transition-all flex items-start gap-4 text-left ${selectedAgent?.id === agent.id
                                                ? 'bg-[#00D6A3]/10 border-[#00D6A3]/50 shadow-[0_0_20px_rgba(0,214,163,0.1)]'
                                                : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                                                }`}
                                        >
                                            <div className="relative mt-0.5">
                                                <div className={`p-2 rounded-xl bg-black/40 border border-white/5 transition-colors ${selectedAgent?.id === agent.id ? 'text-[#00D6A3]' : 'text-white/40 group-hover:text-white/60'}`}>
                                                    <agent.icon size={16} />
                                                </div>
                                                {agent.status === 'working' && (
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#00D6A3] rounded-full shadow-[0_0_8px_#00D6A3] animate-pulse" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className={`text-[12px] font-bold tracking-tight truncate ${selectedAgent?.id === agent.id ? 'text-[#00D6A3]' : 'text-white'}`}>
                                                        {agent.name}
                                                    </span>
                                                    {agent.status === 'working' && (
                                                        <div className="text-[8px] font-mono text-[#00D6A3]/70 animate-pulse">BUSY</div>
                                                    )}
                                                </div>
                                                <div className="text-[9px] text-white/30 tracking-tight leading-relaxed line-clamp-1 font-sans normal-case italic opacity-60">
                                                    {agent.role}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-white/5 bg-black/60">
                        <div className="flex items-center justify-between text-[8px] tracking-[0.2em] font-bold">
                            <div className="flex items-center gap-2 text-[#00D6A3]">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00D6A3] animate-pulse shadow-[0_0_8px_#00D6A3]" />
                                <span className="text-[#00D6A3] drop-shadow-[0_0_8px_rgba(0,214,163,0.5)]">LINK_STATUS: NOMINAL</span>
                            </div>
                            <span className="text-white/10">KERNEL_V5</span>
                        </div>
                    </div>
                </div>

                {/* Main Stage: Neural Visualization */}
                <div className="flex-1 relative">
                    {/* Control Bar */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 bg-black/80 backdrop-blur-2xl rounded-full border border-[#00D6A3]/30 shadow-[0_0_30px_rgba(0,214,163,0.1)]">
                        {['graph', 'list'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-6 py-2 rounded-full text-[9px] font-black tracking-[0.2em] transition-all ${viewMode === mode ? 'bg-[#00D6A3] text-black shadow-[0_0_20px_#00D6A3]' : 'text-white/60 hover:text-white'}`}
                            >
                                {mode === 'graph' ? 'LATTICE_3D' : 'NEURAL_STATS'}
                            </button>
                        ))}
                    </div>

                    {viewMode === 'graph' ? (
                        <div className="w-full h-full relative">
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020202] z-50">
                                    <Activity className="text-[#00D6A3] animate-pulse mb-4" size={32} />
                                    <div className="text-[10px] text-[#00D6A3] tracking-[0.5em] animate-pulse uppercase">Synchronizing_Substrate...</div>
                                </div>
                            )}
                            <Canvas camera={{ position: [0, 8, 16], fov: 45 }} dpr={[1, 1.5]} performance={{ min: 0.5 }}>
                                <Suspense fallback={null}>
                                    <fog attach="fog" args={['#020202', 12, 35]} />
                                    <ambientLight intensity={1.5} />
                                    <pointLight position={[10, 10, 10]} intensity={4.0} color="#00D6A3" />
                                    <pointLight position={[-10, -5, -10]} intensity={1.5} color="#3B82F6" />
                                    <group rotation={[0, -0.2, 0]}>
                                        {agents.length > 0 && (
                                            <GalaxyCore
                                                agents={agents}
                                                selectedId={selectedAgent?.id}
                                                onSelect={setSelectedAgent}
                                            />
                                        )}
                                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
                                            <planeGeometry args={[100, 100]} />
                                            <meshBasicMaterial color="#00D6A3" wireframe transparent opacity={0.08} />
                                        </mesh>
                                    </group>
                                    <OrbitControls enablePan={false} autoRotate={!selectedAgent} autoRotateSpeed={0.2} dampingFactor={0.05} />
                                </Suspense>
                            </Canvas>
                        </div>
                    ) : (
                        <div className="w-full h-full p-20 overflow-y-auto bg-black/40 backdrop-blur-3xl flex justify-center">
                            <div className="w-full max-w-4xl space-y-12">
                                <div className="grid grid-cols-4 gap-4">
                                    {Object.entries(summary?.by_status || {}).map(([s, count]) => (
                                        <div key={s} className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] space-y-2">
                                            <div className="text-[10px] text-white/30 tracking-widest">{s}</div>
                                            <div className="text-3xl font-black">{count}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-10 rounded-[40px] border border-white/5 bg-black/60 space-y-8">
                                    <h3 className="text-[11px] font-black text-[#00D6A3] tracking-[0.4em] flex items-center gap-4">
                                        <Brain size={16} />
                                        COGNITIVE_LOAD_TELEMETRY
                                    </h3>
                                    <div className="space-y-6">
                                        {agents.filter(a => a.status === 'working').map(a => (
                                            <div key={a.id} className="flex items-center gap-6">
                                                <div className="text-[10px] font-bold w-32 tracking-tighter">{a.name}</div>
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                    <div className="h-full bg-gradient-to-r from-[#00D6A3]/40 to-[#00D6A3] animate-pulse" style={{ width: `${a.progress}%` }} />
                                                </div>
                                                <div className="text-[10px] font-mono text-[#00D6A3]">{a.progress}%</div>
                                            </div>
                                        ))}
                                        {agents.filter(a => a.status === 'working').length === 0 && (
                                            <div className="py-20 flex flex-col items-center gap-4 opacity-20">
                                                <Clock size={32} />
                                                <div className="text-[10px] tracking-widest uppercase">Nodes_Idling // Standing_By</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Inspector: Deep State Overlay */}
                <div className={`fixed top-8 right-8 bottom-8 w-[460px] bg-black/95 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col overflow-hidden ${selectedAgent ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-[550px] opacity-0 scale-95'}`}>
                    {selectedAgent && (
                        <>
                            <div className="p-12 pb-6">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-[9px] font-black tracking-widest text-[#00D6A3]">
                                        SECURE_HANDSHAKE // OK
                                    </div>
                                    <button onClick={() => setSelectedAgent(null)} className="p-3 text-white/20 hover:text-white transition-colors">
                                        <ChevronRight size={28} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="p-6 rounded-[32px] bg-black/60 border border-white/10 shadow-2xl" style={{ color: CATEGORY_COLORS[selectedAgent.category] }}>
                                        <selectedAgent.icon size={48} strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-[#00D6A3] font-black tracking-[0.4em] uppercase">{selectedAgent.category}</div>
                                        <h3 className="text-3xl font-black tracking-tighter text-white">{selectedAgent.name}</h3>
                                        <div className="text-[9px] text-white/20 tracking-widest uppercase">NODE_ID_{selectedAgent.hash % 999} // HEX_{getStableHash(selectedAgent.id).toString(16).slice(0, 4)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-12">
                                {/* STATUS PANEL */}
                                <div className="p-8 rounded-[40px] bg-gradient-to-br from-[#00D6A3]/10 to-transparent border border-[#00D6A3]/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-20 transition-opacity group-hover:opacity-40">
                                        <Activity size={64} style={{ color: COLORS.primary }} />
                                    </div>

                                    <div className="relative space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] font-black text-[#00D6A3] tracking-[0.3em]">LIVE_STATUS</div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#00D6A3] animate-pulse" />
                                                <span className="text-[10px] font-black text-white">{selectedAgent.status.toUpperCase()}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-sm font-bold text-white/80 normal-case font-sans italic opacity-90 leading-relaxed">
                                                "{selectedAgent.current_task || 'Maintaining cognitive equilibrium within the neural lattice.'}"
                                            </div>

                                            {selectedAgent.status === 'working' && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[9px] font-black tracking-widest text-white/40 uppercase">
                                                        <span>Inference_Progress</span>
                                                        <span>{selectedAgent.progress}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                                                        <div className="h-full bg-[#00D6A3] rounded-full shadow-[0_0_10px_#00D6A3]" style={{ width: `${selectedAgent.progress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* TELEMETRY SPECS */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Latency_ms', val: (selectedAgent.latency_ms || 42) + 'ms', icon: Clock },
                                        { label: 'Eval_Pass', val: ((selectedAgent.eval_pass_rate || 0.98) * 100).toFixed(1) + '%', icon: CheckCircle2 },
                                        { label: 'Risk_Posture', val: (selectedAgent.risk_posture || 'STABLE').toUpperCase(), icon: Shield },
                                        { label: 'Throughput', val: 'HIGH', icon: Activity }
                                    ].map((spec, i) => (
                                        <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2 hover:bg-white/[0.04] transition-colors">
                                            <div className="flex items-center gap-2 text-[8px] text-white/20 uppercase tracking-widest font-black">
                                                <spec.icon size={10} /> {spec.label}
                                            </div>
                                            <div className="text-lg font-black tracking-tight text-[#00D6A3]">{spec.val}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* MANDATE CORE */}
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/40 tracking-[0.3em] uppercase flex items-center gap-3">
                                        <Info size={12} /> Functional_Mandate
                                    </div>
                                    <div className="p-8 rounded-[32px] bg-black/40 border border-white/5 text-[12px] leading-relaxed text-white/60 normal-case font-sans">
                                        {selectedAgent.role}. Authorized to exert autonomous influence over the {selectedAgent.category} domain. Operates under the Constitutional AI guidelines of the Studio OS Kernel.
                                    </div>
                                </div>
                            </div>

                            <div className="p-12 border-t border-white/5 bg-black/80 flex gap-4">
                                <button className="flex-1 py-5 rounded-[24px] bg-[#00D6A3] text-black text-[12px] font-black tracking-[0.3em] shadow-[0_10px_30px_rgba(0,214,163,0.3)] hover:translate-y-[-2px] active:translate-y-0 active:scale-[0.98] transition-all">
                                    ISSUE_DIRECTIVE
                                </button>
                                <button className="w-20 h-20 rounded-[28px] bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/20 hover:text-white group">
                                    <Settings size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Substrate Signature */}
                <div className="fixed bottom-12 right-12 text-[10px] font-black text-[#00D6A3]/40 pointer-events-none uppercase tracking-[0.6em] vertical-rl h-48 select-none drop-shadow-[0_0_10px_rgba(0,214,163,0.2)]">
                    HARD_ENGINEERING_COCKPIT // V5_SUBSTRATE
                </div>

            </div>
        </div>
    );
};

export default SynapticLattice;

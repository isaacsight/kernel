import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Bot, Youtube, Search, PenTool, Database } from 'lucide-react';
import ChatInterface from './ChatInterface';

// Agent Data (Mock for V1)
const StudioGrid = () => {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial color="#00D6A3" wireframe transparent opacity={0.05} />
        </mesh>
    );
};

// Studio Design Tokens
const COLORS = {
    primary: '#00D6A3', // Studio Green
    background: '#020202', // Deep Space
    text: '#FFFFFF',
    muted: '#8A908C'
};

const AGENTS = [
    { id: 1, name: 'Architect', role: 'System Orchestrator', icon: Bot, position: [0, 0, 0], color: COLORS.primary },
    { id: 2, name: 'ContentRepurposer', role: 'Content Synthesis', icon: PenTool, position: [-2, -1.5, 1], color: '#a855f7' },
    { id: 3, name: 'TikTokAuth', role: 'Social Gateway', icon: Youtube, position: [2, -1.5, 1], color: '#ef4444' },
    { id: 4, name: 'ResearchBot', role: 'Data Gathering', icon: Search, position: [-2, 1.5, -1], color: '#10b981' },
    { id: 5, name: 'DatabaseManager', role: 'Persistence', icon: Database, position: [2, 1.5, -1], color: '#f59e0b' },
];

const AgentNode = ({ agent, onClick }) => {
    const meshRef = useRef();
    const [hovered, setHover] = useState(false);

    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.getElapsedTime();
            meshRef.current.position.y += Math.sin(t * 1 + agent.id) * 0.002;
            meshRef.current.scale.setScalar(hovered ? 1.2 : 1 + Math.sin(t * 2) * 0.05);
        }
    });

    return (
        <group position={agent.position}>
            <Sphere args={[0.4, 32, 32]} ref={meshRef} onClick={onClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
                <meshStandardMaterial
                    color={agent.color}
                    emissive={agent.color}
                    emissiveIntensity={hovered ? 2 : 0.5}
                    roughness={0.2}
                    metalness={0.8}
                />
            </Sphere>
            <pointLight distance={3} intensity={2} color={agent.color} />
            <Html distanceFactor={10}>
                <div className={`pointer-events-none transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="bg-black/90 backdrop-blur-xl px-3 py-1 rounded-full border border-[var(--primary)]/30 text-xs font-mono font-bold whitespace-nowrap text-white shadow-[0_0_15px_rgba(0,214,163,0.3)]">
                        {agent.name}
                    </div>
                </div>
            </Html>
        </group>
    );
};

const ConnectionLines = ({ agents }) => {
    const lines = useMemo(() => {
        const _lines = [];
        for (let i = 1; i < agents.length; i++) {
            _lines.push([agents[0].position, agents[i].position]);
            if (i < agents.length - 1) {
                _lines.push([agents[i].position, agents[i + 1].position]);
            }
        }
        return _lines;
    }, [agents]);

    return (
        <group>
            {lines.map((line, i) => (
                <Line
                    key={i}
                    points={line}
                    color={COLORS.primary}
                    opacity={0.15}
                    transparent
                    lineWidth={1}
                />
            ))}
        </group>
    );
};

const SynapticLattice = () => {
    const [viewMode, setViewMode] = useState('graph');
    const [showChat, setShowChat] = useState(false);

    return (
        <div className="h-[calc(100vh-2rem)] w-full overflow-hidden relative flex flex-col bg-[#020202]">
            {/* Header / Thumb Zone Interaction */}
            <div className="absolute top-6 left-6 z-50 pointer-events-none">
                <h2 className="text-xl font-mono font-bold text-[#00D6A3] tracking-tighter">
                    STUDIO_OS // AGENT_ONE
                </h2>
                <div className="text-[10px] text-[#8A908C] font-mono tracking-widest mt-1">
                    NEURAL_LINK ACTIVATED
                </div>
            </div>

            {/* Chat Toggle (Top Right) */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => setShowChat(!showChat)}
                    className={`p-3 rounded-full bg-black/60 backdrop-blur-xl border ${showChat ? 'border-[#00D6A3] text-[#00D6A3]' : 'border-white/10 text-white'} transition-all`}
                >
                    <Bot size={20} />
                </button>
            </div>

            {/* Chat Overlay */}
            {showChat && (
                <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-md h-[80vh] relative">
                        <button
                            onClick={() => setShowChat(false)}
                            className="absolute -top-12 right-0 text-[#8A908C] hover:text-white"
                        >
                            CLOSE_UPLINK [X]
                        </button>
                        <div className="h-full border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                            <ChatInterface />
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile-First Toggle (Bottom Thumb Zone) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl">
                <button
                    onClick={() => setViewMode('graph')}
                    className={`px-6 py-3 rounded-full text-xs font-bold font-mono transition-all active:scale-95 touch-manipulation ${viewMode === 'graph' ? 'bg-[#00D6A3] text-black shadow-[0_0_20px_rgba(0,214,163,0.4)]' : 'text-[#8A908C] hover:text-white hover:bg-white/5'}`}
                >
                    LATTICE
                </button>
                <button
                    onClick={() => setViewMode('list')}
                    className={`px-6 py-3 rounded-full text-xs font-bold font-mono transition-all active:scale-95 touch-manipulation ${viewMode === 'list' ? 'bg-[#00D6A3] text-black shadow-[0_0_20px_rgba(0,214,163,0.4)]' : 'text-[#8A908C] hover:text-white hover:bg-white/5'}`}
                >
                    MATRIX
                </button>
            </div>

            {viewMode === 'graph' ? (
                <div className="w-full h-full">
                    <Canvas
                        camera={{ position: [0, 2, 8], fov: 50 }}
                        dpr={[1, 2.5]} // Optimized for iPhone 15 High-Refresh Retina
                        performance={{ min: 0.6 }} // Balanced degradation
                    >
                        <fog attach="fog" args={['#020202', 5, 20]} />
                        <ambientLight intensity={0.5} />
                        <pointLight position={[10, 10, 10]} intensity={1} color="#00D6A3" />

                        <group>
                            {AGENTS.map(agent => (
                                <AgentNode key={agent.id} agent={agent} />
                            ))}
                            <ConnectionLines agents={AGENTS} />
                            <StudioGrid />
                        </group>

                        <OrbitControls
                            enablePan={false}
                            enableZoom={true}
                            autoRotate
                            autoRotateSpeed={0.4}
                            enableDamping={true}
                            dampingFactor={0.15} // More 'viscous' feel for high-end glass
                            rotateSpeed={0.4} // Precision touch
                        />
                    </Canvas>
                </div>
            ) : (
                <div className="flex-1 p-6 md:p-24 overflow-y-auto bg-[#020202]">
                    <div className="max-w-4xl mx-auto backdrop-blur-md rounded-2xl overflow-hidden border border-white/5">
                        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                            <h3 className="font-mono text-[#00D6A3] text-sm font-bold">ACTIVE AGENTS</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                            {AGENTS.map(agent => (
                                <div key={agent.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors active:bg-white/10">
                                    <div className="p-3 rounded-xl bg-white/5 text-white" style={{ color: agent.color }}>
                                        <agent.icon size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-base">{agent.name}</div>
                                        <div className="text-xs text-[#8A908C] font-mono mt-1">{agent.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SynapticLattice;

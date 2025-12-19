import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Youtube, Search, PenTool, Database, Terminal } from 'lucide-react';

const AgentGalaxy = () => {
    const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list'
    const [agents] = useState([
        { id: 1, name: 'Architect', role: 'System Orchestrator', icon: Bot, position: { x: 0, y: 0 }, color: '#3b82f6' },
        { id: 2, name: 'ContentRepurposer', role: 'Content Synthesis', icon: PenTool, position: { x: -150, y: -100 }, color: '#a855f7' },
        { id: 3, name: 'TikTokAuth', role: 'Social Gateway', icon: Youtube, position: { x: 150, y: -100 }, color: '#ef4444' },
        { id: 4, name: 'ResearchBot', role: 'Data Gathering', icon: Search, position: { x: -150, y: 100 }, color: '#10b981' },
        { id: 5, name: 'DatabaseManager', role: 'Persistence', icon: Database, position: { x: 150, y: 100 }, color: '#f59e0b' },
    ]);

    return (
        <div className="h-[calc(100vh-2rem)] w-full overflow-hidden relative flex flex-col bg-black/5">
            <div className="absolute top-6 left-6 z-50 flex items-center gap-4">
                <h2 className="text-2xl font-mono font-bold opacity-30 pointer-events-none">
                    AGENT_GALAXY_VIEW // V1.1
                </h2>
                <div className="flex bg-black/20 backdrop-blur-md rounded-lg p-1 border border-white/10">
                    <button
                        onClick={() => setViewMode('graph')}
                        className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === 'graph' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'}`}
                    >
                        GRAPH
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'}`}
                    >
                        LIST
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="flex-1 p-24 overflow-y-auto">
                    <div className="max-w-4xl mx-auto bg-background/50 backdrop-blur-md border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="p-4 font-mono text-sm text-muted-foreground">AGENT</th>
                                    <th className="p-4 font-mono text-sm text-muted-foreground">ROLE</th>
                                    <th className="p-4 font-mono text-sm text-muted-foreground">STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(agent => (
                                    <tr key={agent.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 flex items-center gap-3">
                                            <div className="p-2 rounded bg-primary/10" style={{ color: agent.color }}>
                                                <agent.icon size={16} />
                                            </div>
                                            <span className="font-bold">{agent.name}</span>
                                        </td>
                                        <td className="p-4 text-sm opacity-80">{agent.role}</td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-mono font-bold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                ACTIVE
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 relative flex items-center justify-center">
                    {/* Central Hub Connection Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                        <g className="stroke-current text-primary" strokeWidth="1">
                            {agents.slice(1).map(agent => (
                                <line
                                    key={agent.id}
                                    x1="50%"
                                    y1="50%"
                                    x2={`calc(50% + ${agent.position.x}px)`}
                                    y2={`calc(50% + ${agent.position.y}px)`}
                                />
                            ))}
                        </g>
                    </svg>

                    {/* Agent Nodes */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        {agents.map((agent, index) => (
                            <motion.div
                                key={agent.id}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    x: agent.position.x,
                                    y: agent.position.y
                                }}
                                transition={{
                                    duration: 0.8,
                                    dalay: index * 0.1,
                                    type: "spring"
                                }}
                                whileHover={{ scale: 1.1 }}
                                className="absolute flex flex-col items-center gap-2 group cursor-pointer"
                            >
                                {/* Node Halo */}
                                <div
                                    className="bg-background/80 backdrop-blur-md p-4 rounded-full border border-white/10 shadow-xl relative z-10 group-hover:border-primary/50 transition-colors"
                                    style={{ boxShadow: `0 0 30px ${agent.color}20` }}
                                >
                                    <agent.icon size={32} style={{ color: agent.color }} />
                                </div>

                                {/* Label Badge */}
                                <div className="absolute top-full mt-3 px-3 py-1 bg-black/40 backdrop-blur-sm border border-white/5 rounded-full text-xs font-mono font-bold whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                                    {agent.name}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Background Ambient Particles */}
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute bg-primary/10 rounded-full blur-xl"
                            style={{
                                width: Math.random() * 300 + 50,
                                height: Math.random() * 300 + 50,
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                            }}
                            animate={{
                                x: [0, Math.random() * 100 - 50, 0],
                                y: [0, Math.random() * 100 - 50, 0],
                                opacity: [0.1, 0.3, 0.1],
                            }}
                            transition={{
                                duration: Math.random() * 10 + 10,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgentGalaxy;

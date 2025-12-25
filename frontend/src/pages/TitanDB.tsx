import { useState, type ReactNode } from 'react';
import TitanViz from '../components/TitanViz';
import {
    ArrowLeft, Database, Search, Shield, Zap,
    Activity, Info, ChevronRight, Terminal, Settings,
    Box, Layers, Share2, Cpu, Clock, HardDrive
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TitanDB() {
    const [activeSection, setActiveSection] = useState('overview');
    const [showConfig, setShowConfig] = useState<string | null>(null);

    const navItems = [
        { id: 'overview', label: 'Overview', icon: <Info size={14} /> },
        { id: 'cluster', label: 'Cluster', icon: <Cpu size={14} /> },
        { id: 'consensus', label: 'Consensus', icon: <Shield size={14} /> },
        { id: 'sharding', label: 'Sharding', icon: <Layers size={14} /> },
        { id: 'indexing', label: 'Indexing', icon: <Search size={14} /> },
        { id: 'integration', label: 'Lab Integration', icon: <Zap size={14} /> }
    ];

    return (
        <div className="titan-db-page p-8 max-w-[1400px] mx-auto space-y-10">
            {/* Top Navigation Bar: Styled Breadcrumb + Branding */}
            <div className="flex justify-between items-center">
                <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <Link to="/" className="flex items-center gap-1.5 hover:text-secondary transition-colors group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Lab
                    </Link>
                    <span className="text-slate-800">/</span>
                    <span className="text-slate-300">Titan DB Cluster</span>
                </nav>
                <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none">Protocol v4.2 / Live</span>
                </div>
            </div>

            {/* Header: Promoting to Page Title */}
            <header className="space-y-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-xl shadow-blue-500/5">
                        <Database className="text-blue-500" size={40} />
                    </div>
                    <div>
                        <h1 className="text-6xl font-black text-slate-100 tracking-tighter uppercase leading-[0.9]">Titan Distributed Vector DB</h1>
                        <p className="text-slate-400 text-xl font-medium mt-2">The Cluster overview and architecture substrate for Studio OS.</p>
                    </div>
                </div>

                {/* HUD Summary Row: Moved critical metrics to top */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <HudStat icon={<HardDrive size={16} />} label="Usage" value="1.2TB / 85%" progress={85} />
                    <HudStat icon={<Clock size={16} />} label="Uptime" value="1,248H 12M" subValue="99.998%" />
                    <HudStat icon={<Activity size={16} />} label="In-Flight" value="2,482 RPS" subValue="Latency: 12ms" />
                    <HudStat icon={<Cpu size={16} />} label="Active Nodes" value="5/5 Operational" subValue="Consensus: Quorum" />
                </div>
            </header>

            {/* Local Navigation Component (Sticky) */}
            <div className="sticky top-0 z-50 py-4 -mx-4 px-4 bg-bg-dark/80 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveSection(item.id);
                                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSection === item.id
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-4 pl-8">
                        <div className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-xl border-white/10 group cursor-pointer hover:bg-slate-800 transition-colors">
                            <Terminal size={14} className="text-slate-500 group-hover:text-blue-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">CLI Access</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-20">

                    {/* Bearing Panel: At a Glance bearing */}
                    <section id="overview" className="scroll-mt-32">
                        <div className="glass-panel glass-gradient-border p-8 rounded-[2rem] bg-blue-500/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <Box size={160} className="text-blue-500" />
                            </div>
                            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                        <Info size={14} /> What Titan Is
                                    </h3>
                                    <p className="text-sm text-slate-300 font-medium leading-relaxed">
                                        Titan is a high-performance distributed vector engine purpose-built for high-dimensional semantic search and real-time agent memory.
                                        It leverages <code className="text-blue-400 font-mono bg-blue-400/10 px-1 rounded">RAFT</code> for consistency and <code className="text-blue-400 font-mono bg-blue-400/10 px-1 rounded">HNSW</code> for search.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={14} /> What it Powers
                                    </h3>
                                    <ul className="text-sm text-slate-300 font-medium leading-relaxed space-y-3">
                                        <li className="flex gap-2">
                                            <div className="w-1 h-1 rounded-full bg-secondary mt-1.5 shadow-[0_0_8px_var(--secondary)]"></div>
                                            Studio OS long-term memory
                                        </li>
                                        <li className="flex gap-2">
                                            <div className="w-1 h-1 rounded-full bg-secondary mt-1.5 shadow-[0_0_8px_var(--secondary)]"></div>
                                            Intelligence semantic analytics
                                        </li>
                                    </ul>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Terminal size={14} /> Interaction surface
                                    </h3>
                                    <ul className="text-sm text-slate-300 font-medium leading-relaxed space-y-2">
                                        <li className="flex gap-2 group cursor-pointer hover:text-blue-400 transition-colors text-[10px] uppercase font-black">
                                            <ChevronRight size={12} className="mt-0.5 group-hover:translate-x-1 transition-transform" /> gRPC Cluster Console
                                        </li>
                                        <li className="flex gap-2 group cursor-pointer hover:text-blue-400 transition-colors text-[10px] uppercase font-black">
                                            <ChevronRight size={12} className="mt-0.5 group-hover:translate-x-1 transition-transform" /> REST Memory API
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Band 2: Cluster Topology Visual */}
                    <section id="cluster" className="scroll-mt-32 space-y-8">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black text-slate-200 uppercase tracking-tight">Cluster Status & Topology</h2>
                                <p className="text-slate-500 text-sm font-medium">Real-time mapping of <code className="text-slate-400 px-1">node_shards</code> and heartbeat activity.</p>
                            </div>
                            <div className="flex gap-6 pb-2">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_var(--color-titan)]"></div> Leader
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div> Follower
                                </div>
                            </div>
                        </div>

                        <div className="canvas-wrapper glass-panel glass-gradient-border rounded-[2.5rem] overflow-hidden min-h-[500px] border-white/5 relative bg-slate-900/60 p-1">
                            <TitanViz />
                        </div>
                    </section>

                    {/* Architecture Sections: Increased vertical rhythm and glass styling */}
                    <div className="space-y-10">
                        <section id="consensus" className="scroll-mt-32">
                            <ArchitectureBlock
                                icon={<Shield size={24} className="text-blue-500" />}
                                title="Raft Consensus & Replication"
                                description="Titan enforces linearizable read/write guarantees via the Raft protocol. This prevents state drift and ensures high availability across distributed shards."
                                configTitle="raft_config.yaml"
                                configContent={`# Raft Consensus Parameters
election_timeout_ms: 300
heartbeat_interval_ms: 50
consistency: strong_linearizable
quorum_size: floor(N/2) + 1`}
                                isOpen={showConfig === 'raft'}
                                onToggle={() => setShowConfig(showConfig === 'raft' ? null : 'raft')}
                            />
                        </section>

                        <section id="sharding" className="scroll-mt-32">
                            <ArchitectureBlock
                                icon={<Layers size={24} className="text-blue-500" />}
                                title="Consistent Hashing & Partitioning"
                                description="Collections are divided into 8 primary shards mapped across the node ring. This distribution allows for automatic rebalancing and sub-partitioning during cluster growth."
                                configTitle="sharding_policy.json"
                                configContent={`{
  "sharding_algorithm": "consistent_hashing",
  "vnodes_per_node": 256,
  "rebalancing": "auto_enforced",
  "checksum": "sha256_header"
}`}
                                isOpen={showConfig === 'sharding'}
                                onToggle={() => setShowConfig(showConfig === 'sharding' ? null : 'sharding')}
                            />
                        </section>

                        <section id="indexing" className="scroll-mt-32">
                            <ArchitectureBlock
                                icon={<Search size={24} className="text-blue-500" />}
                                title="HNSW Graph Indexing"
                                description="Hierarchical Navigable Small World graphs enable sub-millisecond approximate nearest neighbor search. Tunables focus on recall precision vs. ingestion throughput."
                                configTitle="indexing_profile.toml"
                                configContent={`[hnsw]
m_max = 16
ef_construction = 200
ef_search = 128
metric = "cosine_similarity"`}
                                isOpen={showConfig === 'hnsw'}
                                onToggle={() => setShowConfig(showConfig === 'hnsw' ? null : 'hnsw')}
                            />
                        </section>
                    </div>

                    <section id="integration" className="scroll-mt-32 pb-24">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-slate-200 uppercase tracking-tight">Lab Integration</h2>
                            <div className="flex items-center gap-2 bg-secondary/10 px-4 py-1.5 rounded-full border border-secondary/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                                <Zap className="text-secondary" size={14} />
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] leading-none">Lab-Native Substrate</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <IntegrationCard
                                subtitle="Neural Storage"
                                title="Studio OS Context"
                                body="Titan serves as the primary embeddings store for agentic reasoning. Every thought and archive is indexed for sub-second retrieval."
                            />
                            <IntegrationCard
                                subtitle="Semantic Analytics"
                                title="Intelligence Logic"
                                body="By clustering page views in vector space, Titan enables the Analyst to identify emerging thematic trends across the research lab."
                            />
                        </div>
                    </section>
                </div>

                {/* Sidebar: HUD Panel with sticky stats */}
                <aside className="hidden lg:block">
                    <div className="space-y-8 sticky top-32">
                        <div className="glass-panel glass-gradient-border p-6 rounded-3xl bg-slate-900/40 border-white/5">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex justify-between items-center">
                                Cluster Controls
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            </h3>
                            <div className="space-y-4">
                                <ControlBtn icon={<Activity size={14} />} label="Stream Logs" />
                                <ControlBtn icon={<Terminal size={14} />} label="Gossip Shell" />
                                <ControlBtn icon={<Settings size={14} />} label="Tune Config" />
                                <div className="h-[1px] bg-white/5 my-4"></div>
                                <div className="p-5 bg-white/5 rounded-2xl space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                                            <span>Collection Density</span>
                                            <span>88%</span>
                                        </div>
                                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[88%] rounded-full shadow-[0_0_8px_var(--color-titan)]"></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                                        REBALANCING ENFORCED BY GUARDIAN PROTOCOL.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function HudStat({ icon, label, value, subValue, progress }: { icon: ReactNode, label: string, value: string, subValue?: string, progress?: number }) {
    return (
        <div className="glass-panel p-5 rounded-2xl bg-slate-900/40 border-white/5 group hover:bg-slate-900/60 transition-all">
            <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                    {icon}
                </div>
                {progress !== undefined && (
                    <span className="text-[10px] font-black text-blue-500">{progress}%</span>
                )}
            </div>
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1">{label}</span>
            <span className="text-lg font-black text-slate-200 block tracking-tight uppercase">{value}</span>
            {subValue && (
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{subValue}</span>
            )}
            {progress !== undefined && (
                <div className="h-0.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            )}
        </div>
    );
}

function ArchitectureBlock({ icon, title, description, configTitle, configContent, isOpen, onToggle }: {
    icon: ReactNode,
    title: string,
    description: string,
    configTitle: string,
    configContent: string,
    isOpen: boolean,
    onToggle: () => void
}) {
    return (
        <div className="glass-panel glass-gradient-border p-8 rounded-[2.5rem] border-white/5 bg-slate-900/20 hover:bg-slate-900/30 transition-all group">
            <div className="flex items-start gap-8">
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors mt-1">
                    {icon}
                </div>
                <div className="flex-1 space-y-4">
                    <h3 className="text-3xl font-black text-slate-200 uppercase tracking-tight">{title}</h3>
                    <p className="text-base text-slate-400 font-medium leading-[1.6] max-w-2xl">
                        {description}
                    </p>
                    <button
                        onClick={onToggle}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${isOpen
                                ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-200 hover:border-white/20'
                            }`}
                    >
                        {isOpen ? 'Sync Config' : 'View Tuneables'}
                        <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                </div>
            </div>
            {isOpen && (
                <div className="mt-8 rounded-2xl overflow-hidden border border-white/5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900 px-5 py-3 flex justify-between items-center border-b border-white/10">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{configTitle}</span>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/5"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-white/5"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-white/5"></div>
                        </div>
                    </div>
                    <pre className="p-8 bg-slate-950/80 backdrop-blur-xl font-mono text-xs leading-6 text-blue-400 overflow-x-auto">
                        <code>{configContent}</code>
                    </pre>
                </div>
            )}
        </div>
    );
}

function IntegrationCard({ subtitle, title, body }: { subtitle: string, title: string, body: string }) {
    return (
        <div className="glass-panel glass-gradient-border p-8 rounded-[2rem] border-white/5 bg-slate-900/30 hover:border-blue-500/30 transition-all group">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 group-hover:text-blue-500 transition-colors">
                {subtitle}
            </span>
            <h4 className="text-2xl font-black text-slate-100 uppercase mb-4 tracking-tight">{title}</h4>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
                {body}
            </p>
        </div>
    );
}

function ControlBtn({ icon, label }: { icon: ReactNode, label: string }) {
    return (
        <button className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/10 text-slate-400 hover:text-slate-200 transition-all text-[10px] font-black uppercase tracking-[0.15em] group">
            <div className="flex items-center gap-3">
                <div className="text-slate-600 group-hover:text-blue-500 transition-colors">
                    {icon}
                </div>
                {label}
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
        </button>
    );
}

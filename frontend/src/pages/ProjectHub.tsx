import { Link } from 'react-router-dom';
import { Database, TrendingUp, Network, MonitorDot, Server, ArrowRight, Zap, Code } from 'lucide-react';
import AgentCouncil from '../components/AgentCouncil';

interface Project {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    tech: string[];
    status: 'In Progress' | 'Planned' | 'Live';
    path: string;
    color: string;
}

const projects: Project[] = [
    {
        id: 'titan',
        title: 'Titan Vector DB',
        description: 'Distributed vector database with Raft consensus and HNSW indexing for RAG workloads.',
        icon: Database,
        tech: ['Rust', 'Raft', 'gRPC'],
        status: 'In Progress',
        path: '/projects/titan',
        color: '#3b82f6'
    },
    {
        id: 'quantframe',
        title: 'QuantFrame Engine',
        description: 'Ultra-low latency crypto trading engine implementing LMAX Disruptor patterns.',
        icon: TrendingUp,
        tech: ['C++', 'Disruptor', 'WS'],
        status: 'Planned',
        path: '/projects/quantframe',
        color: '#ec4899'
    },
    {
        id: 'neuromesh',
        title: 'NeuroMesh',
        description: 'Federated learning infrastructure for privacy-preserving model training.',
        icon: Network,
        tech: ['PyTorch', 'Wasm', 'P2P'],
        status: 'Planned',
        path: '/projects/neuromesh',
        color: '#a855f7'
    },
    {
        id: 'omini',
        title: 'Omini DevOps',
        description: 'Agent-driven infrastructure management and automated cloud scaling.',
        icon: MonitorDot,
        tech: ['Agents', 'IaC', 'LLMs'],
        status: 'Planned',
        path: '/projects/omini',
        color: '#06b6d4'
    },
    {
        id: 'wasmcloud',
        title: 'WasmCloud Edge',
        description: 'Serverless compute platform leveraging WebAssembly sandboxing on edge nodes.',
        icon: Server,
        tech: ['Wasm', 'Rust', 'Edge'],
        status: 'Planned',
        path: '/projects/wasmcloud',
        color: '#10b981'
    }
];

export default function ProjectHub() {
    return (
        <div className="hub-container p-8 max-w-[1280px] mx-auto space-y-20 pb-32">

            {/* Grounded Hero: Clear Purpose */}
            <header className="hero-section space-y-8 pt-10 border-b border-white/5 pb-16">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">
                        <Zap size={12} className="text-secondary" />
                        Engineering Labs
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-slate-100 tracking-tight">
                        High-performance systems & <br /> AI infrastructure.
                    </h1>
                    <p className="text-slate-400 text-lg font-medium max-w-2xl leading-relaxed">
                        A lab focused on building the technical substrate for autonomous agents and distributed data systems.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/chat" className="btn-primary">
                        Open Studio
                    </Link>
                    <button
                        onClick={() => document.getElementById('labs-grid')?.scrollIntoView({ behavior: 'smooth' })}
                        className="btn-secondary"
                    >
                        View Lab Index
                    </button>
                </div>
            </header>

            {/* Labs Grid: Primary Centerpiece */}
            <section id="labs-grid" className="space-y-12">
                <div className="space-y-1">
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Active Projects</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            </section>

            {/* AI Council: Supporting Role */}
            <section className="pt-20 border-t border-white/5 space-y-12">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">The Council</h2>
                        <p className="text-slate-400 text-xs font-medium">Autonomous monitoring and kernel agents.</p>
                    </div>
                </div>

                <AgentCouncil />
            </section>
        </div>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const Icon = project.icon;
    const statusClass = project.status.toLowerCase().replace(' ', '-');

    return (
        <div className="glass-panel p-6 rounded-3xl bg-slate-900/20 border-white/5 hover:border-white/10 transition-all flex flex-col group h-full">
            <div className="flex justify-between items-start mb-6">
                <div
                    className="p-3 rounded-xl border"
                    style={{
                        backgroundColor: `${project.color}10`,
                        borderColor: `${project.color}20`,
                        color: project.color
                    }}
                >
                    <Icon size={20} />
                </div>
                <div className={`status-pill-v2 ${statusClass}`}>
                    {project.status}
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <h3 className="text-xl font-bold text-slate-200 tracking-tight">{project.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-2">
                    {project.description}
                </p>
            </div>

            <div className="mt-auto space-y-6">
                <div className="flex flex-wrap gap-1.5">
                    {project.tech.map((t) => (
                        <span key={t} className="text-[9px] font-black bg-white/5 text-slate-500 px-2 py-0.5 rounded border border-white/5 uppercase tracking-wider">
                            {t}
                        </span>
                    ))}
                </div>

                <Link
                    to={project.path}
                    className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-blue-500 hover:text-blue-400 transition-colors pt-4 border-t border-white/5"
                >
                    <span className="flex items-center gap-2">
                        <Code size={14} />
                        Inspect Implementation
                    </span>
                    <ArrowRight size={14} />
                </Link>
            </div>
        </div>
    );
}

import { Link } from 'react-router-dom';
import { Database, MonitorDot, ArrowRight, Zap, Code, Brain } from 'lucide-react';

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
        id: 'alchemist',
        title: 'High-Output Alchemist',
        description: 'Agentic content repurposing engine for 1→N distribution and viral growth automation.',
        icon: Zap,
        tech: ['n8n', 'OpenAI', 'DTFR'],
        status: 'Live',
        path: '/projects/alchemist',
        color: '#f59e0b'
    },
    {
        id: 'studio-os',
        title: 'Studio OS v3.0',
        description: 'Autonomous directing layer for multi-agent orchestration and mission telemetry.',
        icon: MonitorDot,
        tech: ['Sovereign', 'Telemetry', 'React'],
        status: 'Live',
        path: '/chat',
        color: '#06b6d4'
    }
];

const insights = [
    { topic: "Collective Knowledge", detail: "When self-improvement becomes self-rejection. System audit pending." },
    { topic: "Viral Protocol", detail: "The High-Output Alchemist is active. 1→N content repurposing at 85% efficiency." },
    { topic: "Core Philosophy", detail: "Directing, not Typing. Shifting human bandwidth to architectural oversight." }
];

export default function SovereignManifest() {
    return (
        <div className="hub-container p-8 max-w-[1280px] mx-auto space-y-20 pb-32">

            {/* Sovereign Hero */}
            <header className="hero-section space-y-8 pt-10 border-b border-white/5 pb-16">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">
                        <Zap size={12} className="text-secondary" />
                        Sovereign Intelligence Lab
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-slate-100 tracking-tight">
                        Directing, <br /> not Typing.
                    </h1>
                    <p className="text-slate-400 text-lg font-medium max-w-2xl leading-relaxed">
                        An integrated development and content pipeline designed to bridge the gap between autonomous execution and human-felt quality.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/chat" className="btn-primary">
                        Enter Studio
                    </Link>
                    <button
                        onClick={() => document.getElementById('manifest-grid')?.scrollIntoView({ behavior: 'smooth' })}
                        className="btn-secondary"
                    >
                        View Manifest
                    </button>
                </div>
            </header>

            {/* Active Substrates */}
            <section id="manifest-grid" className="space-y-12">
                <div className="space-y-1">
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Active Substrates</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            </section>

            {/* Recent Intelligence: Surfacing the "New Information" */}
            <section className="pt-20 border-t border-white/5 space-y-12">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Sovereign Insights</h2>
                        <p className="text-slate-400 text-xs font-medium">Latent signals from the collective knowledge graph.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="glass-panel p-6 rounded-3xl bg-slate-900/10 border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <Brain size={16} className="text-primary" />
                                <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{insight.topic}</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                {insight.detail}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Active Swarm Status */}
            <section className="pt-20 border-t border-white/5 space-y-12 text-center pb-20">
                <div className="space-y-1">
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Swarm Status</h2>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.1em]">System Oversight: Nominal</p>
                </div>

                <div className="flex flex-wrap justify-center gap-8">
                    {['Antigravity', 'Alchemist', 'Architect', 'Operator', 'Librarian'].map((agent) => (
                        <div key={agent} className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full border border-white/5 bg-white/5 flex items-center justify-center relative">
                                <div className="absolute inset-0 rounded-full border border-secondary/20 animate-ping"></div>
                                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{agent}</span>
                        </div>
                    ))}
                </div>
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

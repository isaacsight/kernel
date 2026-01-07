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
        <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-32)' }}>

            {/* Sovereign Hero */}
            <header className="hero-section" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: 'var(--space-20)' }}>
                <div className="flex flex-col gap-4" style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="flex items-center gap-2">
                        <Zap size={12} style={{ color: 'var(--color-secondary-500)' }} />
                        <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>
                            Sovereign Intelligence Lab
                        </span>
                    </div>
                    <h1 className="heading-1 gradient-text" style={{ fontSize: 'var(--text-5xl)', marginBottom: 'var(--space-4)' }}>
                        Directing, <br /> not Typing.
                    </h1>
                    <p className="body-large" style={{ color: 'var(--text-secondary)', maxWidth: '42rem' }}>
                        An integrated development and content pipeline designed to bridge the gap between autonomous execution and human-felt quality.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/chat" className="button button--primary button--lg">
                        <Zap size={16} />
                        Enter Studio
                    </Link>
                    <button
                        onClick={() => document.getElementById('manifest-grid')?.scrollIntoView({ behavior: 'smooth' })}
                        className="button button--outline button--lg"
                    >
                        View Manifest
                    </button>
                </div>
            </header>

            {/* Active Substrates */}
            <section id="manifest-grid" style={{ marginBottom: 'var(--space-20)' }}>
                <h2 className="heading-4" style={{ marginBottom: 'var(--space-6)', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>
                    Active Substrates
                </h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            </section>

            {/* Recent Intelligence: Surfacing the "New Information" */}
            <section style={{ paddingTop: 'var(--space-20)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: 'var(--space-20)' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-8)' }}>
                    <div>
                        <h2 className="heading-4" style={{ marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>
                            Sovereign Insights
                        </h2>
                        <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                            Latent signals from the collective knowledge graph.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="card glass-panel">
                            <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                                <Brain size={16} style={{ color: 'var(--color-primary-500)' }} />
                                <h3 className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                                    {insight.topic}
                                </h3>
                            </div>
                            <p className="body-small" style={{ color: 'var(--text-secondary)' }}>
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
    const statusBadge = project.status === 'Live' ? 'success' : project.status === 'In Progress' ? 'primary' : 'neutral';

    return (
        <div className="card card--elevated glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card__header">
                <div className="flex justify-between items-start">
                    <div
                        style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid',
                            backgroundColor: `${project.color}10`,
                            borderColor: `${project.color}20`,
                            color: project.color
                        }}
                    >
                        <Icon size={20} />
                    </div>
                    <span className={`badge badge--${statusBadge}`}>
                        {project.status}
                    </span>
                </div>
                <h3 className="card__title" style={{ marginTop: 'var(--space-4)' }}>
                    {project.title}
                </h3>
                <p className="card__subtitle">
                    {project.description}
                </p>
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                    {project.tech.map((t) => (
                        <span key={t} className="badge badge--neutral" style={{ fontSize: '9px' }}>
                            {t}
                        </span>
                    ))}
                </div>

                <div className="card__footer">
                    <Link
                        to={project.path}
                        className="button button--outline button--sm"
                        style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                        <span className="flex items-center gap-2">
                            <Code size={14} />
                            Inspect
                        </span>
                        <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

import { Link } from 'react-router-dom';
import { Database, MonitorDot, ArrowRight, Zap, Code, Brain } from 'lucide-react';
import { Grid, Column, Tile, Tag, Stack } from '@carbon/react';

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
                        I build production operating systems for human-AI teams. A unified infrastructure for the next generation of agentic development and creative output.
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
                <Grid narrow>
                    <Column lg={16} md={8} sm={4}>
                        <h2 className="heading-4" style={{ marginBottom: 'var(--space-6)', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>
                            Active Substrates
                        </h2>
                    </Column>
                    {projects.map((project) => (
                        <Column lg={5} md={4} sm={4} key={project.id}>
                            <ProjectCard project={project} />
                        </Column>
                    ))}
                </Grid>
            </section>

            {/* Recent Intelligence */}
            <section style={{ paddingTop: 'var(--space-20)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: 'var(--space-20)' }}>
                <Grid narrow>
                    <Column lg={16} md={8} sm={4}>
                        <div style={{ marginBottom: 'var(--space-8)' }}>
                            <h2 className="heading-4" style={{ marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>
                                Sovereign Insights
                            </h2>
                            <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                                Latent signals from the collective knowledge graph.
                            </p>
                        </div>
                    </Column>
                    {insights.map((insight, idx) => (
                        <Column lg={5} md={4} sm={4} key={idx}>
                            <div className="dtfr-glass" style={{ padding: '24px', height: '100%' }}>
                                <Stack gap={4}>
                                    <div className="flex items-center gap-3">
                                        <Brain size={16} style={{ color: 'var(--color-primary-500)' }} />
                                        <h3 className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                                            {insight.topic}
                                        </h3>
                                    </div>
                                    <p className="body-small" style={{ color: 'var(--text-secondary)' }}>
                                        {insight.detail}
                                    </p>
                                </Stack>
                            </div>
                        </Column>
                    ))}
                </Grid>
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
    const tagType = project.status === 'Live' ? 'green' : project.status === 'In Progress' ? 'blue' : 'cool-gray';

    return (
        <Link to={project.path} className="project-card-link" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <Tile
                className="dtfr-glass"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', cursor: 'pointer' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', width: '100%', marginBottom: '24px' }}>
                    <div style={{
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: `${project.color}15`,
                        color: project.color,
                        border: '1px solid currentColor'
                    }}>
                        <Icon size={24} />
                    </div>
                    <Tag type={tagType} size="sm">
                        {project.status}
                    </Tag>
                </div>

                <Stack gap={4}>
                    <h3 className="heading-4" style={{ color: 'var(--text-primary)' }}>
                        {project.title}
                    </h3>
                    <p className="body-small" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {project.description}
                    </p>
                </Stack>

                <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: '16px' }}>
                        {project.tech.map((t) => (
                            <Tag key={t} type="gray" size="sm" className="cds--tag--filter">
                                {t}
                            </Tag>
                        ))}
                    </div>
                    <div className="flex items-center justify-between" style={{ color: 'var(--color-primary-500)', fontSize: '13px', fontWeight: 600 }}>
                        <span className="flex items-center gap-2">
                            <Code size={14} />
                            Inspect Substrate
                        </span>
                        <ArrowRight size={14} />
                    </div>
                </div>
            </Tile>
        </Link>
    );
}

import { Link } from 'react-router-dom';
import { Database, TrendingUp, Network, MonitorDot, Server, ArrowRight } from 'lucide-react';

const projects = [
    {
        id: 'titan',
        title: 'Titan Vector DB',
        description: 'Distributed vector database for RAG applications. Features Raft consensus and HNSW indexing.',
        icon: Database,
        tech: ['Rust', 'Raft', 'gRPC'],
        status: 'In Progress',
        path: '/projects/titan',
        color: 'var(--color-titan)'
    },
    {
        id: 'quantframe',
        title: 'QuantFrame Engine',
        description: 'Ultra-low latency crypto trading engine using LMAX Disruptor patterns.',
        icon: TrendingUp,
        tech: ['C++', 'Low Latency', 'WebSocket'],
        status: 'Planned',
        path: '/projects/quantframe',
        color: 'var(--color-quant)'
    },
    {
        id: 'neuromesh',
        title: 'NeuroMesh',
        description: 'Federated learning system for privacy-preserving distributed model training.',
        icon: Network,
        tech: ['PyTorch', 'WebAssembly', 'Privacy'],
        status: 'Planned',
        path: '/projects/neuromesh',
        color: 'var(--color-neuro)'
    },
    {
        id: 'omini',
        title: 'Omini DevOps',
        description: 'Agentic infrastructure platform. "Jarvis" for your AWS/GCP cloud stack.',
        icon: MonitorDot,
        tech: ['Agents', 'Terraform', 'LLMs'],
        status: 'Planned',
        path: '/projects/omini',
        color: 'var(--color-omini)'
    },
    {
        id: 'wasmcloud',
        title: 'WasmCloud Edge',
        description: 'Serverless compute platform running WebAssembly on edge nodes.',
        icon: Server,
        tech: ['Wasm', 'Rust', 'Sandboxing'],
        status: 'Planned',
        path: '/projects/wasmcloud',
        color: 'var(--color-wasm)'
    }
];

export default function ProjectHub() {
    return (
        <div className="hub-container">
            <header className="hub-header">
                <h1 className="hub-title">Engineering Labs</h1>
                <p className="hub-subtitle">
                    Building high-performance distributed systems and AI infrastructure.
                    <br />
                    Showcasing skills for 2025's most demanding engineering roles.
                </p>
            </header>

            <div className="projects-grid">
                {projects.map((project) => (
                    <Link to={project.path} key={project.id} className="project-card" style={{ '--accent-color': project.color } as any}>
                        <div className="card-content">
                            <div className="card-header">
                                <project.icon className="card-icon" />
                                <span className={`status-badge ${project.status.toLowerCase().replace(' ', '-')}`}>
                                    {project.status}
                                </span>
                            </div>
                            <h2 className="card-title">{project.title}</h2>
                            <p className="card-description">{project.description}</p>

                            <div className="tech-stack">
                                {project.tech.map((t) => (
                                    <span key={t} className="tech-tag">{t}</span>
                                ))}
                            </div>

                            <div className="card-footer">
                                <span className="view-link">View Project <ArrowRight size={16} /></span>
                            </div>
                        </div>
                        <div className="card-glow" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

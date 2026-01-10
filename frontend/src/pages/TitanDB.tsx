import { ArrowLeft, Database, HardDrive, Clock, Activity, Cpu, Shield, Layers, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import TitanViz from '../components/TitanViz';
import MetricTile from '../components/layout/MetricTile';
import ProseContainer from '../components/layout/ProseContainer';
import './TitanDB.css';

export default function TitanDB() {
    return (
        <ProseContainer className="titan-page">
            <nav className="titan-nav">
                <Link to="/" className="back-link"><ArrowLeft size={14} /> Lab / Titan DB Cluster</Link>
                <div className="titan-status">Protocol v4.2 / Live</div>
            </nav>

            <header className="titan-header">
                <div className="header-icon"><Database size={40} /></div>
                <div>
                    <h1>Titan Distributed Vector DB</h1>
                    <p className="subtitle">The Cluster overview and architecture substrate for Studio OS.</p>
                </div>
            </header>

            <div className="metrics-row">
                <div className="metric-col">
                    <MetricTile icon={<HardDrive size={16} />} label="Usage" value="1.2TB / 85%" progress={85} />
                </div>
                <div className="metric-col">
                    <MetricTile icon={<Clock size={16} />} label="Uptime" value="1,248H 12M" subValue="99.998%" />
                </div>
                <div className="metric-col">
                    <MetricTile icon={<Activity size={16} />} label="In-Flight" value="2,482 RPS" subValue="Latency: 12ms" />
                </div>
                <div className="metric-col">
                    <MetricTile icon={<Cpu size={16} />} label="Active Nodes" value="5/5 Operational" subValue="Consensus: Quorum" />
                </div>
            </div>

            <section className="titan-viz-section">
                <h2><Activity size={16} /> Cluster Topology</h2>
                <div className="viz-container">
                    <TitanViz />
                </div>
            </section>

            <div className="architecture-grid">
                <ArchitectureBlock
                    icon={<Shield size={24} />}
                    title="Raft Consensus"
                    description="Titan enforces linearizable read/write guarantees via the Raft protocol."
                />
                <ArchitectureBlock
                    icon={<Layers size={24} />}
                    title="Consistent Hashing"
                    description="Collections are divided into 8 primary shards mapped across the node ring."
                />
                <ArchitectureBlock
                    icon={<Search size={24} />}
                    title="HNSW Indexing"
                    description="Hierarchical Navigable Small World graphs enable sub-millisecond search."
                />
            </div>
        </ProseContainer>
    );
}

function ArchitectureBlock({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="arch-block">
            <div className="arch-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

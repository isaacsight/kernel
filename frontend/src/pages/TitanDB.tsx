import TitanViz from '../components/TitanViz';
import { ArrowLeft, Server, Database, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TitanDB() {
    return (
        <div className="viz-container">
            <Link to="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
                <ArrowLeft size={20} /> Back to Lab
            </Link>

            <header style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                        <Database color="var(--color-titan)" size={32} />
                    </div>
                    <h1 style={{ fontSize: '3rem', margin: 0 }}>Titan Distributed Vector DB</h1>
                </div>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
                    A distributed vector database implementing Raft consensus for consistency and HNSW for approximate nearest neighbor search.
                </p>
            </header>

            <div className="canvas-wrapper">
                <TitanViz />
            </div>

            <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px' }}>
                <div className="card-content">
                    <Server color="var(--color-titan)" style={{ marginBottom: '16px' }} />
                    <h3>Raft Consensus</h3>
                    <p className="card-description">Ensures data consistency across the distributed cluster. Leader election and log replication logic.</p>
                </div>
                <div className="card-content">
                    <Database color="var(--color-titan)" style={{ marginBottom: '16px' }} />
                    <h3>Sharding Strategy</h3>
                    <p className="card-description">Horizontal partitioning of vector embeddings based on consistent hashing rings.</p>
                </div>
                <div className="card-content">
                    <Search color="var(--color-titan)" style={{ marginBottom: '16px' }} />
                    <h3>HNSW Pricing</h3>
                    <p className="card-description">Hierarchical Navigable Small World graphs for sub-millisecond similarity search.</p>
                </div>
            </div>
        </div>
    );
}

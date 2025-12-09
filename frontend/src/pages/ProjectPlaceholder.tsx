import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export default function ProjectPlaceholder() {
    const { id } = useParams();

    const titles: Record<string, string> = {
        'quantframe': 'QuantFrame Engine',
        'neuromesh': 'NeuroMesh',
        'omini': 'Omini DevOps',
        'wasmcloud': 'WasmCloud Edge'
    };

    const title = id ? titles[id] : 'Project';

    return (
        <div className="viz-container">
            <Link to="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
                <ArrowLeft size={20} /> Back to Lab
            </Link>

            <div style={{ textAlign: 'center', marginTop: '100px' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '24px' }}>{title}</h1>
                <div className="status-badge in-progress" style={{ display: 'inline-block', fontSize: '1rem', padding: '8px 16px', marginBottom: '48px' }}>
                    Coming Soon
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
                    This distributed system simulation is currently under development.
                    Check back soon to see the interactive demo.
                </p>
            </div>
        </div>
    );
}

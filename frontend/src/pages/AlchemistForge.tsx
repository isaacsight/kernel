import { useState, useEffect } from 'react';
import {
    Zap, Shield, Activity, Terminal,
    ArrowUpRight, ArrowDownRight, Info, AlertTriangle
} from 'lucide-react';
import './AlchemistForge.css';

interface Percept {
    id: string;
    time: string;
    source: string;
    message: string;
    sentiment: 'positive' | 'negative' | 'neutral';
}

interface InferenceMetric {
    label: string;
    value: number;
    max: number;
    colorClass?: string;
}

export default function AlchemistForge() {
    const [isEngaged, setIsEngaged] = useState(false);
    const [percepts, setPercepts] = useState<Percept[]>([
        { id: '1', time: '17:54:10', source: 'REUTERS', message: 'Federal Reserve hints at interest rate stability through Q3.', sentiment: 'neutral' },
        { id: '2', time: '17:54:25', source: 'ON-CHAIN', message: 'Whale movement detected: 4,500 BTC moved to cold storage.', sentiment: 'positive' },
        { id: '3', time: '17:54:40', source: 'TWITTER', message: 'Significant spike in #Solana sentiment across developer circles.', sentiment: 'positive' },
    ]);
    const [metrics, setMetrics] = useState<InferenceMetric[]>([
        { label: 'Expected Free Energy', value: 42, max: 100, colorClass: 'viz-bar--clay' },
        { label: 'Model Precision', value: 89, max: 100 },
        { label: 'Perceptual Surprise', value: 12, max: 100, colorClass: 'viz-bar--gold' },
        { label: 'Active Policy Weight', value: 65, max: 100 }
    ]);

    // Mock and Real data generation
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/forge');
                const data = await res.json();
                if (data.status === 'success') {
                    setMetrics([
                        { label: 'Expected Free Energy', value: data.metrics.expected_free_energy, max: 100, colorClass: 'viz-bar--clay' },
                        { label: 'Model Precision', value: data.metrics.model_precision, max: 100 },
                        { label: 'Perceptual Surprise', value: data.metrics.perceptual_surprise, max: 100, colorClass: 'viz-bar--gold' },
                        { label: 'Active Policy Weight', value: data.metrics.active_policy_weight, max: 100 }
                    ]);
                    setPercepts(data.percepts);
                }
            } catch (err) {
                console.error("Forge fetch failed:", err);
            }
        };

        const interval = setInterval(() => {
            if (isEngaged) {
                fetchData();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isEngaged]);

    return (
        <div className="alchemist-forge">
            <div className="forge-content">
                <header className="forge-header">
                    <div className="forge-title">
                        <h1>The Forge</h1>
                        <p>SOVEREIGN TRADING ENGINE // ACTIVE INFERENCE SUBSTRATE</p>
                    </div>
                    <div className="system-status">
                        <span className="status-orb" />
                        <span>NODE: ALPHA-7 // STATUS: {isEngaged ? 'ENGAGED' : 'STANDBY'}</span>
                    </div>
                </header>

                <div className="forge-grid">
                    {/* Main Engine Visualization */}
                    <section className="forge-panel">
                        <div className="panel-header">
                            <h2><Zap size={16} /> Inference Engine</h2>
                            <div className="panel-meta">MODEL: INF-CORE-V2</div>
                        </div>
                        <div className="engine-viz">
                            {metrics.map((metric, i) => (
                                <div key={i} className="viz-row">
                                    <span className="viz-label">{metric.label}</span>
                                    <div className="viz-bar-container">
                                        <div
                                            className={`viz-bar ${metric.colorClass || ''}`}
                                            style={{ '--bar-width': `${(metric.value / metric.max) * 100}%` } as React.CSSProperties}
                                        />
                                    </div>
                                    <span className="viz-value">
                                        {Math.round(metric.value)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Kill Switch Control */}
                    <section className="forge-panel">
                        <div className="panel-header">
                            <h2><Shield size={16} /> Sovereignty</h2>
                        </div>
                        <div className="kill-switch-container">
                            <div
                                className={`kill-switch ${isEngaged ? 'kill-switch--active' : ''}`}
                                onClick={() => setIsEngaged(!isEngaged)}
                            >
                                <Activity size={48} color={isEngaged ? 'white' : '#ccc'} />
                            </div>
                            <p className="engaging-p">
                                {isEngaged ? 'ENGAGED: Agent is optimizing trade policies.' : 'STANDBY: Handshake required to initiate execution.'}
                            </p>
                        </div>
                    </section>
                </div>

                <div className="forge-grid">
                    {/* Market Percepts */}
                    <section className="forge-panel">
                        <div className="panel-header">
                            <h2><Terminal size={16} /> Perceptual Feed</h2>
                            <div className="panel-meta">LATENCY: 12ms</div>
                        </div>
                        <div className="percept-feed">
                            {percepts.map(p => (
                                <div key={p.id} className="percept-item">
                                    <span className="percept-time">[{p.time}]</span>
                                    <span className="percept-source">{p.source}</span>
                                    <span className="percept-message">{p.message}</span>
                                    <span className="percept-sentiment">
                                        {p.sentiment === 'positive' ? <ArrowUpRight size={14} color="green" /> :
                                            p.sentiment === 'negative' ? <ArrowDownRight size={14} color="red" /> :
                                                <Info size={14} color="gray" />}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Cognitive Residue / Socratic Logic */}
                    <section className="forge-panel">
                        <div className="panel-header">
                            <h2><AlertTriangle size={16} /> Socratic Repair</h2>
                        </div>
                        <div className="residue-logs">
                            <div className="log-entry">
                                <b>[REPAIR-01]:</b> Divergence between predicted BTC volatility and realized price action. <i>Updating prior precision weights.</i>
                            </div>
                            <div className="log-entry">
                                <b>[REASONING]:</b> News event (Fed) minimized surprise on macro scale, but increased local uncertainty. <i>Minimizing Expected Free Energy by hedging.</i>
                            </div>
                            <div className="log-entry">
                                <b>[AUDIT]:</b> Execution halted for 500ms to verify signature integrity. <i>Sovereignty check: PASS.</i>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

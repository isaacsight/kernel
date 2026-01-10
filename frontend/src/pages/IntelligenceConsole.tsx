import { useState, useEffect } from 'react';
import {
    Eye, TrendingUp, Brain, List, Activity,
    ChevronDown, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import MetricTile from '../components/layout/MetricTile';
import ProseContainer from '../components/layout/ProseContainer';
import './IntelligenceConsole.css';

interface VisitorStat {
    slug: string;
    view_count: number;
}

interface ResearchInsight {
    data: {
        topic: string;
        summary: string;
    }
}

interface SystemEvent {
    type: string;
    timestamp: string;
    data: {
        action?: string;
        message?: string;
        amount?: number;
        item?: string;
        [key: string]: unknown;
    };
}

interface IntelligenceData {
    visitors: VisitorStat[];
    content: {
        total_posts: number;
        avg_word_count: number;
    };
    agents: Array<Record<string, unknown>>;
    research: ResearchInsight[];
    rigor: {
        views_24h: number;
        active_nodes_7d: number;
        trend_velocity: string | number;
        events_stream: SystemEvent[];
    };
}

export default function IntelligenceConsole() {
    const [data, setData] = useState<IntelligenceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedInsights, setExpandedInsights] = useState<number[]>([]);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/intelligence');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Intelligence fetch failed:", err);
            // Mock data for display if fetch fails (or no backend)
            setData({
                visitors: [
                    { slug: 'native-coding', view_count: 1240 },
                    { slug: 'system-compiler', view_count: 980 },
                    { slug: 'warm-computing', view_count: 850 },
                ],
                content: { total_posts: 12, avg_word_count: 1500 },
                agents: [],
                research: [
                    { data: { topic: 'Model Context Saturation', summary: 'Analysis indicates frequent context overflow in recent coding sessions.' } },
                    { data: { topic: 'User Intent Alignment', summary: 'High correlation between declarative prompts and successful code generation.' } }
                ],
                rigor: {
                    views_24h: 342,
                    active_nodes_7d: 15,
                    trend_velocity: 'stable',
                    events_stream: [
                        { type: 'system_log', timestamp: new Date().toISOString(), data: { message: 'Intelligence substrate synced.' } },
                        { type: 'agent_action', timestamp: new Date(Date.now() - 60000).toISOString(), data: { message: 'Refactoring started.' } }
                    ]
                }
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    const toggleInsight = (idx: number) => {
        setExpandedInsights(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    if (loading) return (
        <ProseContainer className="intelligence-loading">
            <div>Synchronizing Intelligence Substrate...</div>
        </ProseContainer>
    );

    return (
        <ProseContainer className="intelligence-console">
            <header className="console-header">
                <h1>Intelligence Console</h1>
                <div className="console-actions">
                    <button onClick={fetchData} disabled={refreshing} title="Refresh Data">
                        <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
                    </button>
                    <span className="status-indicator nominal">System Nominal</span>
                </div>
            </header>

            <div className="metrics-grid">
                <MetricTile
                    icon={<Eye size={18} />}
                    label="24H Volume"
                    value={data?.rigor.views_24h.toLocaleString() || "0"}
                    trend="+14%"
                    trendDirection="up"
                />
                <MetricTile
                    icon={<Brain size={18} />}
                    label="Active Nodes"
                    value={data?.rigor.active_nodes_7d.toLocaleString() || "0"}
                    trend="-2.4%"
                    trendDirection="down"
                />
                <MetricTile
                    icon={<TrendingUp size={18} />}
                    label="Growth Velocity"
                    value={data?.rigor.trend_velocity === "stable" ? "Stable" : "Elevated"}
                    trend="0.0%"
                    trendDirection="neutral"
                />
            </div>

            <section className="console-section">
                <h2><List size={16} /> Traffic Distribution</h2>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Node Name</th>
                                <th className="text-right">Views</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.visitors && data.visitors.length > 0 ? (
                                data.visitors.slice(0, 6).map((v, i) => (
                                    <tr key={v.slug}>
                                        <td className="font-code">{(i + 1).toString().padStart(2, '0')}</td>
                                        <td className="capitalize">{v.slug.replace(/-/g, ' ')}</td>
                                        <td className="text-right font-code">{v.view_count.toLocaleString()}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="empty-cell">Awaiting telemetry...</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="split-grid">
                <section className="console-section">
                    <h2><Brain size={16} /> System Insights</h2>
                    <div className="insights-list">
                        {data?.research && data.research.map((insight, i) => (
                            <div key={i} className="insight-card">
                                <div className="insight-header" onClick={() => toggleInsight(i)}>
                                    <h4>{insight.data.topic}</h4>
                                    <ChevronDown size={14} style={{ transform: expandedInsights.includes(i) ? 'rotate(180deg)' : 'none' }} />
                                </div>
                                {expandedInsights.includes(i) && (
                                    <div className="insight-body">
                                        <p>{insight.data.summary}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="console-section">
                    <h2><Activity size={16} /> Events Stream</h2>
                    <div className="events-list">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Time</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.rigor.events_stream && data.rigor.events_stream.map((event, i) => (
                                    <tr key={i}>
                                        <td>
                                            {event.type.includes('error') ? <AlertCircle size={12} color="red" /> : <CheckCircle2 size={12} color="green" />}
                                        </td>
                                        <td className="font-code text-small">
                                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="text-small">{event.data?.message || "Event"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </ProseContainer>
    );
}

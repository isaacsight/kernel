import { useState, useEffect } from 'react';
import {
    Eye, TrendingUp, Brain, List, Activity,
    ChevronDown, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import {
    Grid, Column,
    StructuredListWrapper, StructuredListHead, StructuredListBody, StructuredListRow, StructuredListCell
} from '@carbon/react';
import MetricTile from '../components/layout/MetricTile';

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
        [key: string]: any;
    };
}

interface IntelligenceData {
    visitors: VisitorStat[];
    content: {
        total_posts: number;
        avg_word_count: number;
    };
    agents: Record<string, unknown>[];
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
    const [timeRange, setTimeRange] = useState('24h');
    const [expandedInsights, setExpandedInsights] = useState<number[]>([]);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/intelligence');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Intelligence fetch failed:", err);
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
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary shadow-primary/20"></div>
            <div className="text-slate-400 font-medium animate-pulse">Synchronizing Intelligence Substrate...</div>
        </div>
    );

    return (
        <div className="intelligence-console p-8 max-w-[1400px] mx-auto space-y-10">
            {/* Band 1: Status Strip & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 glass-panel p-3 px-4 rounded-2xl border-white/5 bg-slate-900/50">
                <div className="flex items-center gap-6">
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 shadow-inner">
                        {['24h', '7d', '30d'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px - 5 py - 1.5 rounded - lg text - [10px] font - black uppercase transition - all ${timeRange === range
                                    ? 'bg-secondary text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    } `}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Oversight: Nominal</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10"></div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-600 uppercase leading-none mb-1">Last Heartbeat</span>
                            <span className="text-[10px] font-black text-slate-400 tabular-nums">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            className="p-2.5 glass-panel rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 border-white/10 group shadow-lg"
                            title="Sync Data"
                        >
                            <RefreshCw size={16} className={`${refreshing ? 'animate-spin' : ''} text - secondary group - hover: rotate - 180 transition - transform`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Header section (Compact) */}
            <header className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-[2px] w-8 bg-secondary rounded-full shadow-[0_0_8px_var(--secondary)]"></div>
                    <span className="text-[10px] font-black tracking-[0.3em] text-secondary uppercase">Observability</span>
                </div>
                <h1 className="text-4xl font-black text-slate-100 tracking-tighter uppercase">Intelligence Console</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">High-fidelity signal analysis of visitor density and agent substrate activity.</p>
            </header>

            {/* Band 2: Core Metrics & Traffic */}
            <Grid>
                {/* Metrics Layer */}
                <Column sm={4} md={8} lg={4}>
                    <div className="grid grid-cols-1 gap-4">
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
                </Column>

                {/* Traffic Distribution Table */}
                <Column sm={4} md={8} lg={12}>
                    <div className="glass-panel rounded-3xl p-8 border-white/5 relative bg-slate-900/40">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-3 text-slate-200">
                                    <List className="text-secondary" />
                                    Traffic Distribution
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Top Performing Knowledge Nodes</p>
                            </div>
                        </div>

                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest w-12">Rank</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Node Name</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest w-24 text-right">Views</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data?.visitors && data.visitors.length > 0 ? (
                                        data.visitors.slice(0, 6).map((v, i) => (
                                            <tr key={v.slug} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 font-mono text-[10px] text-slate-600">{(i + 1).toString().padStart(2, '0')}</td>
                                                <td className="py-4">
                                                    <div className="font-bold text-slate-200 group-hover:text-secondary transition-colors cursor-pointer capitalize text-sm tracking-tight">
                                                        {v.slug.replace(/-/g, ' ')}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <span className="text-sm font-black text-slate-400 tabular-nums group-hover:text-slate-100 transition-colors">
                                                        {v.view_count.toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="py-12 text-center text-slate-600 text-[10px] uppercase font-bold italic tracking-widest">
                                                Awaiting visitor telemetry...
                                            </td>
                                        </tr>
                                    )
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Column>
            </Grid>

            {/* Band 3: Narrative Layer (Insights & Events) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* System Insights */}
                <div className="glass-panel rounded-3xl p-8 bg-slate-900/40 relative">
                    <div className="absolute top-0 right-0 p-8">
                        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full group cursor-help">
                            <Activity size={12} className="text-primary animate-pulse" />
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest">Live Reasoning</span>
                        </div>
                    </div>
                    <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-slate-200">
                        <Brain className="text-primary" />
                        System Insights
                    </h2>

                    <div className="space-y-4">
                        {data?.research && data.research.length > 0 ? (
                            data.research.map((insight, i) => (
                                <div key={i} className="glass-panel border-white/5 rounded-2xl overflow-hidden group hover:border-primary/30 transition-all">
                                    <div
                                        className="p-4 flex flex-col cursor-pointer hover:bg-white/[0.02] transition-colors"
                                        onClick={() => toggleInsight(i)}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{insight.data.topic}</h4>
                                            <ChevronDown size={14} className={`text - slate - 600 transition - transform ${expandedInsights.includes(i) ? 'rotate-180' : ''} `} />
                                        </div>
                                    </div>
                                    {expandedInsights.includes(i) && (
                                        <div className="p-4 pt-0 border-t border-white/5 bg-slate-900/40">
                                            <p className="text-sm text-slate-400 leading-relaxed font-medium mt-4">
                                                {insight.data.summary}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <InsightErrorState message="Model context window saturated or quota exceeded." />
                        )}
                    </div>
                </div>

                {/* Events Stream Activity Log */}
                <div className="glass-panel rounded-3xl p-8 bg-slate-900/40 border-white/5 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black flex items-center gap-3 text-slate-200">
                            <Activity className="text-secondary" />
                            Events Stream
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <StructuredListWrapper aria-label="Events Stream" isCondensed>
                            <StructuredListHead>
                                <StructuredListRow head>
                                    <StructuredListCell head className="text-[10px] font-black uppercase tracking-widest text-slate-600">Type</StructuredListCell>
                                    <StructuredListCell head className="text-[10px] font-black uppercase tracking-widest text-slate-600">Timestamp</StructuredListCell>
                                    <StructuredListCell head className="text-[10px] font-black uppercase tracking-widest text-slate-600">Action</StructuredListCell>
                                </StructuredListRow>
                            </StructuredListHead>
                            <StructuredListBody>
                                {data?.rigor.events_stream && data.rigor.events_stream.length > 0 ? (
                                    data.rigor.events_stream.map((event, i) => {
                                        const isError = event.type === 'error' || event.data?.message?.toLowerCase().includes('error');
                                        let timestamp = "??:??";
                                        try {
                                            timestamp = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) { }

                                        return (
                                            <StructuredListRow key={i} className="group hover:bg-white/[0.03]">
                                                <StructuredListCell className="flex items-center gap-2">
                                                    {isError ? <AlertCircle size={14} className="text-rose-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                                    <span className="text-[9px] font-black text-slate-500 uppercase truncate">
                                                        {event.type.split('_')[0]}
                                                    </span>
                                                </StructuredListCell>
                                                <StructuredListCell className="font-mono text-[10px] text-slate-500 tabular-nums">
                                                    {timestamp}
                                                </StructuredListCell>
                                                <StructuredListCell className="text-xs font-medium text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                                                    {event.data?.action || event.data?.message || "Substrate process executed"}
                                                </StructuredListCell>
                                            </StructuredListRow>
                                        );
                                    })
                                ) : (
                                    <StructuredListRow>
                                        <StructuredListCell>
                                            <EmptyActivity message="Monitoring system telemetry..." />
                                        </StructuredListCell>
                                        <StructuredListCell />
                                        <StructuredListCell />
                                    </StructuredListRow>
                                )}
                            </StructuredListBody>
                        </StructuredListWrapper>
                    </div>
                </div>
            </div>
        </div>
    );
}

// EventRow removed as it's now integrated into the StructuredList loop.

function InsightErrorState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-rose-500/5 rounded-3xl border border-rose-500/10 border-dashed">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 text-rose-500">
                <AlertCircle size={24} />
            </div>
            <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Inference Interrupted</h4>
            <p className="text-xs text-rose-400/60 font-medium max-w-[280px] leading-relaxed mb-6">
                {message}
            </p>
        </div>
    );
}

function EmptyActivity({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <Activity size={32} className="text-slate-700 mb-4" />
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                {message}
            </p>
        </div>
    );
}

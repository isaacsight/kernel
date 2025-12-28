import { useState, useEffect } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus, Brain, List, Activity, ChevronDown, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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
                                className={`px-5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeRange === range
                                    ? 'bg-secondary text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Segment:</span>
                        <div className="flex items-center gap-2 cursor-pointer group">
                            <span className="text-[10px] font-black text-slate-300 uppercase group-hover:text-secondary transition-colors">Global Traffic</span>
                            <ChevronDown size={12} className="text-slate-500 group-hover:text-secondary" />
                        </div>
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
                            <RefreshCw size={16} className={`${refreshing ? 'animate-spin' : ''} text-secondary group-hover:rotate-180 transition-transform`} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Metrics Layer */}
                <div className="grid grid-cols-1 gap-4">
                    <MetricCard
                        icon={<Eye size={18} />}
                        label="24H Volume"
                        value={data?.rigor.views_24h.toLocaleString() || "0"}
                        trend="+14%"
                        trendDirection="up"
                        subtext="Unique views in rolling window."
                        color="secondary"
                    />
                    <MetricCard
                        icon={<Brain size={18} />}
                        label="Active Nodes"
                        value={data?.rigor.active_nodes_7d.toLocaleString() || "0"}
                        trend="-2.4%"
                        trendDirection="down"
                        subtext="Nodes viewed in last 7 days."
                        color="primary"
                    />
                    <MetricCard
                        icon={<TrendingUp size={18} />}
                        label="Growth Velocity"
                        value={data?.rigor.trend_velocity === "stable" ? "Stable" : "Elevated"}
                        trend="0.0%"
                        trendDirection="neutral"
                        subtext="Momentum baseline comparison."
                        color="accent"
                    />
                </div>

                {/* Traffic Distribution Table */}
                <div className="lg:col-span-2 glass-panel rounded-3xl p-8 border-white/5 relative bg-slate-900/40">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-3 text-slate-200">
                                <List className="text-secondary" />
                                Traffic Distribution
                            </h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Top Performing Knowledge Nodes</p>
                        </div>
                        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 hover:text-secondary uppercase tracking-widest transition-all">
                            Inspect Active Nodes →
                        </button>
                    </div>

                    <div className="overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest w-12">Rank</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Node Name</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-600 uppercase tracking-widest w-24">% Change</th>
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
                                            <td className="py-4">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500">
                                                    <TrendingUp size={10} />
                                                    +12%
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
                                        <td colSpan={4} className="py-12 text-center text-slate-600 text-[10px] uppercase font-bold italic tracking-widest">
                                            Awaiting visitor telemetry...
                                        </td>
                                    </tr>
                                )
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-slate-600 uppercase">Confidence</span>
                                                    <span className="text-[10px] font-black text-primary">85%</span>
                                                </div>
                                                <ChevronDown size={14} className={`text-slate-600 transition-transform ${expandedInsights.includes(i) ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                        <div className="h-[2px] w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                                            <div className="h-full bg-primary" style={{ width: '85%' }}></div>
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
                            <InsightErrorState message="Model context window saturated or quota exceeded. Switch to local inference?" />
                        )}
                    </div>
                </div>

                {/* Events Stream Activity Log */}
                <div className="glass-panel rounded-3xl p-8 bg-slate-900/40 border-white/5">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-3 text-slate-200">
                                <Activity className="text-secondary" />
                                Events Stream
                            </h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Live Activity Log</p>
                        </div>
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></div>
                            Streaming
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                        {data?.rigor.events_stream && data.rigor.events_stream.length > 0 ? (
                            data.rigor.events_stream.map((event, i) => (
                                <EventRow key={i} event={event} />
                            ))
                        ) : (
                            <EmptyActivity message="Monitoring system telemetry for incoming events..." />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, trend, trendDirection, subtext, color }: any) {
    const colors: any = {
        secondary: "text-secondary bg-secondary/10 border-secondary/20",
        primary: "text-primary bg-primary/10 border-primary/20",
        accent: "text-accent bg-accent/10 border-accent/20"
    };

    return (
        <div className="glass-panel p-5 rounded-2xl border-white/5 hover:border-white/10 transition-all bg-slate-900/30 group">
            <div className="flex justify-between items-start mb-6">
                <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded leading-none ${trendDirection === 'up' ? 'text-emerald-500 bg-emerald-500/10' :
                    trendDirection === 'down' ? 'text-rose-500 bg-rose-500/10' :
                        'text-slate-500 bg-white/5'
                    }`}>
                    {trendDirection === 'up' && <TrendingUp size={10} />}
                    {trendDirection === 'down' && <TrendingDown size={10} />}
                    {trendDirection === 'neutral' && <Minus size={10} />}
                    {trend}
                </div>
            </div>
            <div className="relative">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 block group-hover:text-slate-400 transition-colors">
                    {label}
                </span>
                <div className="text-3xl font-black text-slate-100 tracking-tighter tabular-nums mb-1">
                    {value}
                </div>
                <p className="text-[10px] text-slate-500 font-bold leading-tight">{subtext}</p>
            </div>
        </div>
    );
}

function EventRow({ event }: { event: SystemEvent }) {
    const isError = event.type === 'error' || event.data?.message?.toLowerCase().includes('error');
    const isSuccess = event.type === 'success' || event.data?.message?.toLowerCase().includes('success');

    let timestamp = "??:??";
    try {
        timestamp = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { }

    const getEntityIcon = () => {
        if (isError) return <AlertCircle size={14} className="text-rose-500" />;
        if (isSuccess) return <CheckCircle2 size={14} className="text-emerald-500" />;
        return <Activity size={14} className="text-secondary" />;
    };

    return (
        <div className="grid grid-cols-6 items-center gap-4 p-3 hover:bg-white/[0.03] rounded-xl transition-all border border-transparent hover:border-white/5 group">
            <div className="col-span-1 flex items-center gap-2">
                {getEntityIcon()}
                <span className="text-[9px] font-black text-slate-600 uppercase truncate">
                    {event.type.split('_')[0]}
                </span>
            </div>
            <div className="col-span-1 font-mono text-[10px] text-slate-500 tabular-nums">
                {timestamp}
            </div>
            <div className="col-span-4 flex justify-between items-center min-w-0">
                <p className="text-xs font-medium text-slate-400 truncate group-hover:text-slate-200 transition-colors mr-4">
                    {event.data?.action || event.data?.message || "Substrate process executed"}
                </p>
                {event.data?.amount && (
                    <span className="text-[10px] font-black text-emerald-500 whitespace-nowrap bg-emerald-500/10 px-2 py-0.5 rounded shadow-sm">
                        +${event.data.amount}
                    </span>
                )}
            </div>
        </div>
    );
}

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
            <button className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black text-rose-500 uppercase tracking-widest transition-all">
                Switch to Local Refiner
            </button>
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

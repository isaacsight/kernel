import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MissionControl from './MissionControl';
import EcosystemNeuralNet from './EcosystemNeuralNet';
import AgentCard from './AgentCard';
import {
    Terminal,
    Cpu,
    Users,
    Zap,
    ChevronRight,
    MessageSquare,
    User,
    Sparkles,
    ArrowUp,
    Clock,
    Activity
} from 'lucide-react';

const Message = ({ type, content, data, intent }) => {
    const isAssistant = type === 'assistant';

    return (
        <div className={`flex gap-4 p-8 ${isAssistant ? 'bg-secondary/10' : ''} border-b border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-700`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isAssistant ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_theme(colors.primary.DEFAULT)]' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                {isAssistant ? <Sparkles size={16} /> : <User size={16} />}
            </div>

            <div className="flex-1 space-y-4 max-w-3xl overflow-hidden">
                <div className={`text-base leading-relaxed ${isAssistant ? 'text-foreground' : 'text-foreground/90 font-medium'}`}>
                    {content}
                </div>

                {isAssistant && data && (
                    <div className="grid grid-cols-1 gap-4 mt-4">
                        <div className="tech-card bg-black/60 p-6 font-mono text-[11px] leading-relaxed overflow-x-auto border-white/5">
                            <pre className="text-primary/70">{JSON.stringify(data, null, 2)}</pre>
                        </div>
                    </div>
                )}

                {isAssistant && intent && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-primary/40 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                            Signal: {intent}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [messages, setMessages] = useState([
        {
            type: 'assistant',
            content: "Studio OS is initialized. The frontier swarm is awaiting your directive. What should we build?",
            intent: "sys_ready"
        }
    ]);
    const [command, setCommand] = useState('');
    const [loading, setLoading] = useState(false);
    const [agents, setAgents] = useState([]);
    const [heartbeat, setHeartbeat] = useState(null);
    const [evolution, setEvolution] = useState(null);

    const messagesEndRef = useRef(null);
    const apiBase = `http://${window.location.hostname}:8000`;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchSystemState = async () => {
        try {
            const [agentsRes, hbRes, evoRes] = await Promise.all([
                axios.get(`${apiBase}/agents`),
                axios.get(`${apiBase}/system/heartbeat`),
                axios.get(`${apiBase}/system/evolution/state`)
            ]);
            setAgents(agentsRes.data);
            setHeartbeat(hbRes.data);
            setEvolution(evoRes.data);
        } catch (err) {
            console.error("System sync failed:", err);
        }
    };

    useEffect(() => {
        fetchSystemState();
        const interval = setInterval(fetchSystemState, 15000); // 15s sync for background
        return () => clearInterval(interval);
    }, []);

    const handleCommand = async (e) => {
        e.preventDefault();
        const input = command.trim();
        if (!input || loading) return;

        setMessages(prev => [...prev, { type: 'user', content: input }]);
        setCommand('');
        setLoading(true);

        try {
            const res = await axios.post(`${apiBase}/command`, { command: input });
            const result = res.data;

            setMessages(prev => [...prev, {
                type: 'assistant',
                content: result.message || (result.success ? "Directive acknowledged. Execution results materialized." : "Task completed."),
                data: result.data,
                intent: result.intent
            }]);

            if (result.success) fetchSystemState();
        } catch (err) {
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: `Protocol Exception: ${err.message}. System integrity remains high.`,
                intent: "error"
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (agentName, action) => {
        try {
            setMessages(prev => [...prev, { type: 'user', content: `Trigger action: ${action} for ${agentName}` }]);
            setLoading(true);

            const res = await axios.post(`${apiBase}/agents/run`, {
                agent_name: agentName,
                action: action
            });

            setMessages(prev => [...prev, {
                type: 'assistant',
                content: `${agentName} reports: Action ${action} has been executed.`,
                data: res.data,
                intent: "agent_action_result"
            }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: `Action failed for ${agentName}: ${error.message}`,
                intent: "error"
            }]);
        } finally {
            setLoading(false);
            fetchSystemState();
        }
    };

    const teams = {
        "Strategic Intel": agents.filter(a => ["The Visionary", "The Designer"].includes(a.name)),
        "Core Operations": agents.filter(a => ["The Operator", "The Architect", "The Guardian"].includes(a.name)),
        "Creative Engine": agents.filter(a => ["The Alchemist", "The Editor", "The Librarian"].includes(a.name))
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* Scrollable Chat Stream */}
            <div className="flex-1 overflow-y-auto pt-24 pb-48 custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6">
                    {/* Welcome Header */}
                    <div className="mb-20 text-center animate-in fade-in zoom-in duration-1000">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary mb-6">
                            <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                            Frontier Intelligence Active
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-white mb-4">Studio OS</h1>
                        <p className="text-muted-foreground/60 max-w-md mx-auto text-sm leading-relaxed">
                            A live studio building agentic systems, products, and patterns in public.
                        </p>
                    </div>

                    <div className="divide-y divide-white/5 border-t border-white/5">
                        {messages.map((msg, i) => (
                            <Message key={i} {...msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Command Input */}
            <div className="fixed bottom-0 left-[72px] right-0 p-10 bg-gradient-to-t from-background via-background to-transparent z-40 pointer-events-none">
                <div className="max-w-3xl mx-auto pointer-events-auto">
                    <form onSubmit={handleCommand} className="relative group">
                        <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
                        <div className="relative glass-panel rounded-3xl flex items-center p-1.5 border-white/10 group-focus-within:border-primary/40 group-focus-within:bg-black/80 transition-all duration-500">
                            <div className="pl-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                                <Zap size={20} className={loading ? "animate-pulse" : ""} />
                            </div>
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Type a directive..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-base py-4 px-6 text-foreground placeholder:text-muted-foreground/30 font-sans"
                            />
                            <button
                                type="submit"
                                disabled={loading || !command.trim()}
                                className="bg-primary text-black w-12 h-12 rounded-2xl flex items-center justify-center hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 mr-1.5 shadow-lg shadow-primary/20"
                            >
                                <ArrowUp size={24} strokeWidth={3} />
                            </button>
                        </div>
                    </form>

                    <div className="flex items-center justify-center gap-8 mt-6 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700">
                        {["Status Check", "Generate Post", "Launch Evolution"].map(suggestion => (
                            <button
                                key={suggestion}
                                onClick={() => setCommand(suggestion)}
                                className="text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-muted-foreground/40 hover:text-primary transition-colors py-2 px-3 hover:bg-white/5 rounded-lg"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Stats Panel (Right fixed) */}
            <div className="fixed top-8 right-8 z-40 flex flex-col gap-4 items-end">
                <div className="glass-panel px-6 py-3 rounded-2xl border-white/5 flex items-center gap-4 group cursor-help transition-all duration-300 hover:border-primary/30">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">System Health</span>
                        <span className="text-xs font-bold text-primary">Operational</span>
                    </div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_12px_rgba(102,181,110,0.8)]" />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

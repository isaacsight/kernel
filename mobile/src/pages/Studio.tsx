import React, { useState } from 'react';
import { AgentService, SystemService } from '../services/api';
import { RefreshCw } from 'lucide-react';


// Simple Tabs implementation since we don't have shadcn yet, or we mock it
// Actually, let's implement a simple Tab system inline or separate component. 
// For speed, inline logic first, then refactor.

const Studio: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'critique' | 'generate' | 'write'>('write');
    const [input, setInput] = useState('');
    const [context, setContext] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAction = async () => {
        setLoading(true);
        try {
            let action = '';
            let params = {};
            let agent = 'The Visionary';

            if (activeTab === 'critique') {
                action = 'critique';
                params = { css: input, html: context };
            } else if (activeTab === 'generate') {
                action = 'generate_css';
                params = { requirements: input, current_css: context };
            } else if (activeTab === 'write') {
                action = 'generate';
                agent = 'The Alchemist';
                params = { topic: input, doctrine: context || "Agile, Modern, Professional" };
            }

            const data = await AgentService.runAction(agent, action, params);
            setResult(data.result || data.content || JSON.stringify(data));
        } catch (error) {
            setResult('Error executing studio action.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm("Confirm deployment to production?")) return;
        setLoading(true);
        try {
            const res = await SystemService.publish();
            alert(res.message);
        } catch {
            alert("Publishing failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in px-4 pb-32">
            <header className="py-6">
                <h1 className="text-xl font-semibold tracking-tight text-white inline-flex items-center gap-2">
                    Design Lab
                </h1>
                <p className="text-white/30 text-[11px] font-medium uppercase tracking-[0.2em] mt-1">
                    Multimodal Creative Suite
                </p>
            </header>

            <div className="flex p-1 gap-1 bg-white/[0.03] border border-white/[0.05] rounded-[20px] mb-8">
                {(['write', 'critique', 'generate'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-[16px] transition-all ${activeTab === tab ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/30 hover:text-white/60'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/20 tracking-[0.1em] ml-1">
                            {activeTab === 'critique' ? 'CSS Entry' : activeTab === 'write' ? 'Core Topic' : 'Specifications'}
                        </label>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="input-field min-h-[140px] resize-none"
                            placeholder={activeTab === 'critique' ? ".button { ... }" : activeTab === 'write' ? "Define your thesis..." : "Explain requirements..."}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/20 tracking-[0.1em] ml-1">
                            {activeTab === 'critique' ? 'Markup Context' : activeTab === 'write' ? 'Style Guidelines' : 'Environmental Context'}
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            className="input-field min-h-[100px] resize-none"
                            placeholder={activeTab === 'critique' ? "<div>...</div>" : activeTab === 'write' ? "Professional, Minimalist" : "Local context..."}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleAction}
                            disabled={loading || !input.trim()}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Synthesizing...' : activeTab === 'critique' ? 'Analyze Design' : activeTab === 'write' ? 'Draft Project' : 'Generate Asset'}
                        </button>

                        {activeTab === 'write' && result && (
                            <button
                                onClick={handlePublish}
                                disabled={loading}
                                className="w-full py-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 font-semibold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} strokeWidth={1.5} />
                                Deploy to Production
                            </button>
                        )}
                    </div>
                </div>

                {result && (
                    <div className="mt-8 glass-panel rounded-3xl p-6 border-white/[0.08]">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Synthesis Result</h3>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                        </div>
                        <pre className="text-[13px] leading-relaxed font-sans text-white/80 whitespace-pre-wrap">{result}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};


export default Studio;

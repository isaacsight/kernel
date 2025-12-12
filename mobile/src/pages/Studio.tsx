import React, { useState } from 'react';
import { AgentService, SystemService } from '../services/api';


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
                // Input is Topic, Context is Doctrine
                params = { topic: input, doctrine: context || "Agile, Modern, Professional" };
            }

            const data = await AgentService.runAction(agent, action, params);
            // Alchemist return format might differ
            setResult(data.result || data.content || JSON.stringify(data));
        } catch (error) {
            setResult('Error executing studio action.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm("Are you sure you want to publish to the live site?")) return;
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
        <div className="flex flex-col h-full animate-fade-in pb-20">
            <header className="px-4 pb-4 border-b border-white/5">
                <h1 className="text-xl font-bold tracking-tighter text-white">Design Studio</h1>
                <p className="text-xs text-muted-foreground">Collaborate with The Visionary.</p>
            </header>

            <div className="flex p-2 gap-2 bg-black/20 mx-4 mt-4 rounded-lg">
                <button
                    onClick={() => setActiveTab('write')}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'write' ? 'bg-primary text-black' : 'text-muted-foreground'}`}
                >
                    Write
                </button>
                <button
                    onClick={() => setActiveTab('critique')}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'critique' ? 'bg-primary text-black' : 'text-muted-foreground'}`}
                >
                    Critique
                </button>
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'generate' ? 'bg-primary text-black' : 'text-muted-foreground'}`}
                >
                    Generate
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">
                            {activeTab === 'critique' ? 'CSS Snippet' : activeTab === 'write' ? 'Topic' : 'Requirements'}
                        </label>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-md p-3 text-xs font-mono text-white focus:outline-none focus:border-primary/50"
                            placeholder={activeTab === 'critique' ? ".btn { ... }" : activeTab === 'write' ? "The Future of AI..." : "Make a glassmorphic card..."}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">
                            {activeTab === 'critique' ? 'HTML Context' : activeTab === 'write' ? 'Doctrine / Vibes' : 'Existing CSS'}
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            className="w-full h-24 bg-white/5 border border-white/10 rounded-md p-3 text-xs font-mono text-white focus:outline-none focus:border-primary/50"
                            placeholder={activeTab === 'critique' ? "<button>..." : activeTab === 'write' ? "Agile, Clean, Professional" : "@layer base { ... }"}
                        />
                    </div>

                    <button
                        onClick={handleAction}
                        disabled={loading}
                        className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wide text-xs rounded-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : activeTab === 'critique' ? 'Run Critique' : activeTab === 'write' ? 'Draft Post' : 'Generate'}
                    </button>

                    {activeTab === 'write' && result && (
                        <button
                            onClick={handlePublish}
                            disabled={loading}
                            className="w-full py-3 mt-2 bg-red-500/20 border border-red-500/50 text-red-500 hover:bg-red-500/30 font-bold uppercase tracking-wide text-xs rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <span>🚀</span> Publish Live
                        </button>
                    )}
                </div>

                {result && (
                    <div className="mt-6 bg-black/40 border border-white/10 rounded-lg p-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground mb-2 uppercase">Result</h3>
                        <pre className="text-[10px] font-mono whitespace-pre-wrap opacity-90">{result}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Studio;

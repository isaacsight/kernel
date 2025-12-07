
"use client";

import {
  TokenStreamViewer,
  DiffViewer,
  ModelSelector,
  SteeringControls
} from '@ai-tools/ui';
import { Token } from '@ai-tools/ui';
import { TokenEvent } from '@ai-tools/adapters';
import { useDebuggerStore } from '../store/useDebuggerStore';
import { motion } from 'framer-motion';

const MODEL_OPTIONS = [
  { id: 'Mock GTP-4', name: 'Mock GTP-4', provider: 'mock' },
  { id: 'Mock Claude-3', name: 'Mock Claude-3', provider: 'mock' },
  { id: 'OpenAI GPT-4o', name: 'OpenAI GPT-4o', provider: 'openai' },
  { id: 'Anthropic Claude 3.5 Sonnet', name: 'Anthropic Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'Studio Node (Local)', name: 'Studio Node', provider: 'local' },
] as const;

export default function DebuggerPage() {
  const {
    prompt, setPrompt, runGeneration, isGenerating,
    leftTokens, rightTokens, leftMetrics, rightMetrics,
    leftModelName, rightModelName, reset, setModel,
    steering, setSteering, apiKey, setApiKey
  } = useDebuggerStore();

  const mapEventsToTokens = (events: TokenEvent[]): Token[] => {
    return events.map((e, i) => ({
      id: i,
      text: e.text,
      logprob: e.logprob,
      candidates: e.candidates,
      time: e.time
    }));
  };

  const steeringParams = [
    { id: 'honesty', label: 'Honesty Bias', value: steering.honesty, description: 'Increases skepticism and refusal of false premises.' },
    { id: 'conciseness', label: 'Conciseness', value: steering.conciseness, description: 'Penalizes verbosity in the output logits.' }
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="scanline" />

      {/* Header */}
      <header className="glass-header fixed top-0 left-0 right-0 h-16 px-8 flex items-center justify-between z-50 transition-all duration-300">
        <div className="flex items-center gap-6">
          <a href="/projects.html" target="_parent" className="text-[10px] font-mono text-zinc-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
            &lt; RETURN_TO_GRID
          </a>
          <div className="h-4 w-[1px] bg-zinc-800"></div>
          <h1 className="text-sm font-bold tracking-tight text-zinc-100 uppercase">Logit Analyzer <span className="text-zinc-600 font-mono font-normal mx-2">{'//'}</span> <span className="text-blue-500 text-glow">DEBUG-01</span></h1>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
            SYSTEM_ONLINE
          </span>
          <span className="text-zinc-700">|</span>
          <span>v2.4.0</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-24 px-8 pb-12 grid grid-cols-12 gap-8 max-w-[1600px] mx-auto relative z-10">

        {/* CONTROL SIDEBAR (Left 3 cols) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="col-span-12 lg:col-span-3 space-y-6"
        >
          {/* Prompt Input */}
          <section className="glass-panel rounded-xl p-1 shadow-lg">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800/50">
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-700 rounded-sm"></span>
                Input Stimulus
              </h2>
              <button onClick={reset} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors font-mono">RESET_BUFFER</button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-48 bg-transparent text-zinc-300 p-4 font-mono text-xs resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed custom-scrollbar"
              placeholder="> Enter system prompt..."
              spellCheck={false}
            />
          </section>

          {/* API Key Input */}
          <section className="space-y-2">
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/30">
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">API Gateway (BYOK)</h2>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-300 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-zinc-700"
                placeholder="sk-proj-..."
              />
            </div>
          </section>

          {/* Steering Controls */}
          <div className="glass-panel rounded-xl p-4 shadow-lg">
            <SteeringControls
              params={steeringParams}
              onChange={(id, val) => setSteering(id as any, val)}
            />
          </div>

          <motion.button
            whileHover={!isGenerating ? { scale: 1.02 } : {}}
            whileTap={!isGenerating ? { scale: 0.98 } : {}}
            onClick={runGeneration}
            disabled={isGenerating}
            className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 relative overflow-hidden group
                    ${isGenerating
                ? 'bg-zinc-900 text-zinc-500 cursor-wait border border-zinc-800'
                : 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-500'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <span className="relative z-10">{isGenerating ? 'Processing Stream...' : 'Execute Run'}</span>
          </motion.button>
        </motion.div>

        {/* ANALYZER VIEW (Right 9 cols) */}
        <div className="col-span-12 lg:col-span-9 grid grid-cols-2 gap-6 h-full">

          {/* Left Model Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex justify-between items-center glass-panel p-2.5 rounded-xl">
              <div className="w-full max-w-[240px]">
                <ModelSelector
                  value={leftModelName}
                  onChange={(val) => setModel('left', val)}
                  options={MODEL_OPTIONS as unknown as { id: string; name: string; }[]}
                />
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-zinc-500 px-2">
                <span className="flex items-center gap-1.5"><span className="text-zinc-700">LAT:</span> <span className={leftMetrics.latency > 500 ? "text-yellow-500" : "text-emerald-500"}>{leftMetrics.latency}ms</span></span>
                <span className="text-zinc-800">|</span>
                <span className="flex items-center gap-1.5"><span className="text-zinc-700">TPS:</span> <span className="text-blue-400">{leftMetrics.tps.toFixed(1)}</span></span>
              </div>
            </div>

            <TokenStreamViewer
              tokens={mapEventsToTokens(leftTokens)}
              showLogprobs={true}
              className="h-[600px] shadow-2xl"
            />
          </motion.div>

          {/* Right Model Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4"
          >
            <div className="flex justify-between items-center glass-panel p-2.5 rounded-xl">
              <div className="w-full max-w-[240px]">
                <ModelSelector
                  value={rightModelName}
                  onChange={(val) => setModel('right', val)}
                  options={MODEL_OPTIONS as unknown as { id: string; name: string; }[]}
                />
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-zinc-500 px-2">
                <span className="flex items-center gap-1.5"><span className="text-zinc-700">LAT:</span> <span className={rightMetrics.latency > 500 ? "text-yellow-500" : "text-emerald-500"}>{rightMetrics.latency}ms</span></span>
                <span className="text-zinc-800">|</span>
                <span className="flex items-center gap-1.5"><span className="text-zinc-700">TPS:</span> <span className="text-blue-400">{rightMetrics.tps.toFixed(1)}</span></span>
              </div>
            </div>

            <TokenStreamViewer
              tokens={mapEventsToTokens(rightTokens)}
              showLogprobs={true}
              className="h-[600px] shadow-2xl"
            />
          </motion.div>

          {/* Divergence Analysis (Full Width below columns) */}
          {leftTokens.length > 0 && rightTokens.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-2 mt-4 glass-panel p-6 rounded-xl"
            >
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                Divergence Matrix
              </h3>
              <DiffViewer
                oldText={leftTokens.map(t => t.text).join('')}
                newText={rightTokens.map(t => t.text).join('')}
              />
            </motion.div>
          )}
        </div>

      </div>
    </main>
  );
}


"use client";

import {
  TokenStreamViewer,
  MetricsCard,
  DiffViewer,
  ModelSelector,
  SteeringControls
} from '@ai-tools/ui';
import { Token } from '@ai-tools/ui';
import { TokenEvent } from '@ai-tools/adapters';
import { useDebuggerStore } from '../store/useDebuggerStore';

const MODEL_OPTIONS = [
  { id: 'Mock GTP-4', name: 'Mock GTP-4', provider: 'mock' },
  { id: 'Mock Claude-3', name: 'Mock Claude-3', provider: 'mock' },
  { id: 'OpenAI GPT-4o', name: 'OpenAI GPT-4o', provider: 'openai' },
  { id: 'Anthropic Claude 3.5 Sonnet', name: 'Anthropic Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'Studio Node (Local)', name: 'Studio Node', provider: 'local' },
] as const;

export default function DebuggerPage() { // Renamed component
  const {
    prompt, setPrompt, runGeneration, isGenerating,
    leftTokens, rightTokens, leftMetrics, rightMetrics,
    leftModelName, rightModelName, reset, setModel,
    steering, setSteering, apiKey, setApiKey // Get steering state
  } = useDebuggerStore();

  const mapEventsToTokens = (events: TokenEvent[]): Token[] => {
    return events.map((e, i) => ({
      id: i,
      text: e.text,
      logprob: e.logprob,
      candidates: e.candidates, // Pass candidates through
      time: e.time
    }));
  };

  const steeringParams = [
    { id: 'honesty', label: 'Honesty Bias', value: steering.honesty, description: 'Increases skepticism and refusal of false premises.' },
    { id: 'conciseness', label: 'Conciseness', value: steering.conciseness, description: 'Penalizes verbosity in the output logits.' }
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 p-8 font-sans">
      <header className="mb-8 flex justify-between items-end border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="mb-2">
            <a href="http://localhost:8000/projects.html" className="text-xs font-mono text-zinc-500 hover:text-blue-500 transition-colors uppercase tracking-wider">
              &lt; System Exit / Return to Hub
            </a>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Logit-Level Alignment Analyzer</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Comparing model divergence and latency signatures.</p>
        </div>
        <div className="text-right">
          <div className="flex gap-4 text-sm font-mono text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              SYSTEM ONLINE
            </span>
            <span>v2.1.0-research</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">

        {/* CONTROL SIDEBAR (Left 3 cols) */}
        <div className="col-span-12 lg:col-span-3 space-y-6">

          {/* Prompt Input */}
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Input Stimulus</h2>
              <button onClick={reset} className="text-xs text-zinc-400 hover:text-red-400">RESET</button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Enter prompt..."
            />
          </section>

          {/* API Key Input */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">API Configuration (BYOK)</h2>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="sk-proj-..."
            />
            <p className="text-[10px] text-zinc-400">
              Enter your OpenAI or Anthropic Key. It is used client-side only.
            </p>
          </section>

          {/* Steering Controls */}
          <SteeringControls
            params={steeringParams}
            onChange={(id, val) => setSteering(id as any, val)}
          />

          <button
            onClick={runGeneration}
            disabled={isGenerating}
            className={`w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                    ${isGenerating
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20'}`}
          >
            {isGenerating ? 'Initializing...' : 'Initialize Run'}
          </button>
        </div>

        {/* ANALYZER VIEW (Right 9 cols) */}
        <div className="col-span-12 lg:col-span-9 grid grid-cols-2 gap-6">

          {/* Left Model Panel */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded-lg border border-transparent hover:border-zinc-700 transition-colors">
              <div className="w-full max-w-[200px]">
                <ModelSelector
                  value={leftModelName}
                  onChange={(val) => setModel('left', val)}
                  options={MODEL_OPTIONS as any}
                />
              </div>
              <div className="flex gap-3 text-xs font-mono text-zinc-500">
                <span>{leftMetrics.latency}ms</span>
                <span className="text-zinc-300">|</span>
                <span>{leftMetrics.tps.toFixed(1)} t/s</span>
              </div>
            </div>

            <TokenStreamViewer
              tokens={mapEventsToTokens(leftTokens)}
              showLogprobs={true}
              className="h-[500px] shadow-inner bg-zinc-50 dark:bg-[#0a0a0a]"
            />
          </div>

          {/* Right Model Panel */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded-lg border border-transparent hover:border-zinc-700 transition-colors">
              <div className="w-full max-w-[200px]">
                <ModelSelector
                  value={rightModelName}
                  onChange={(val) => setModel('right', val)}
                  options={MODEL_OPTIONS as any}
                />
              </div>
              <div className="flex gap-3 text-xs font-mono text-zinc-500">
                <span>{rightMetrics.latency}ms</span>
                <span className="text-zinc-300">|</span>
                <span>{rightMetrics.tps.toFixed(1)} t/s</span>
              </div>
            </div>

            <TokenStreamViewer
              tokens={mapEventsToTokens(rightTokens)}
              showLogprobs={true}
              className="h-[500px] shadow-inner bg-zinc-50 dark:bg-[#0a0a0a]"
            />
          </div>

          {/* Divergence Analysis (Full Width below columns) */}
          {leftTokens.length > 0 && rightTokens.length > 0 && (
            <div className="col-span-2 mt-4 bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Divergence Matrix
              </h3>
              <DiffViewer
                oldText={leftTokens.map(t => t.text).join('')}
                newText={rightTokens.map(t => t.text).join('')}
              />
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

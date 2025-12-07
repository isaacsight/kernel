
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { encodingForModel } from 'js-tiktoken';
import { AttentionMatrix } from '@ai-tools/ui';
import { motion, AnimatePresence } from 'framer-motion';

const SAMPLE_TEXT = "In network theory, the context window represents the limited scope of attention a model can maintain. As new tokens enter, old ones must slide out or be compressed. This visualization demonstrates that mechanism.";

export default function Home() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [windowSize] = useState(20);
  const [cursor, setCursor] = useState(0);

  // Initialize encoder via useMemo (Fellow-Grade: Pure functional initialization)
  const encoder = useMemo(() => {
    try {
      return encodingForModel("gpt-4");
    } catch (e) {
      console.error("Failed to load encoder", e);
      return null;
    }
  }, []);

  const tokens = useMemo(() => {
    if (!encoder) return [];

    // Real BPE Tokenization
    const tokenIds = encoder.encode(text);
    return tokenIds.map((id) => ({
      id: id,
      text: encoder.decode([id]),
      weight: (id % 100) / 100 // pseudo-random deterministic weight based on token id
    }));
  }, [text, encoder]);

  const activeTokens = tokens.slice(Math.max(0, cursor - windowSize), cursor);

  // Auto-play animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCursor(c => {
        if (c >= tokens.length + 5) return 0; // loop with delay
        return c + 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [tokens.length]);

  if (!encoder) return <div className="p-8 text-zinc-500 font-mono">Initializing Neural Interfaces...</div>;

  return (
    <main className="min-h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-purple-500/30 overflow-hidden relative">
      <div className="scanline" />

      {/* Header */}
      <header className="glass-header fixed top-0 left-0 right-0 h-16 px-8 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <a href="/projects.html" target="_parent" className="text-[10px] font-mono text-zinc-500 hover:text-purple-400 transition-colors uppercase tracking-widest">
            &lt; RETURN_TO_GRID
          </a>
          <div className="h-4 w-[1px] bg-zinc-800"></div>
          <h1 className="text-sm font-bold tracking-tight text-zinc-100 uppercase">Context Dynamics <span className="text-zinc-600 font-mono font-normal mx-2">{'//'}</span> <span className="text-purple-500 text-glow">VIS-02</span></h1>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse"></span>
            SIMULATION_ACTIVE
          </span>
          <span className="text-zinc-700">|</span>
          <span>v1.8.0</span>
        </div>
      </header>

      <div className="pt-24 px-8 pb-12 max-w-[1400px] mx-auto relative z-10 space-y-8">

        {/* Main Viz Unit */}
        <section className="glass-panel p-1 rounded-2xl shadow-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>

          <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800/50 relative z-10">
            <div>
              <h2 className="text-sm font-bold text-zinc-200">Token Stream Visualization (BPE)</h2>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] font-mono text-zinc-500">WINDOW_SIZE: <span className="text-zinc-300">{windowSize}</span></span>
                <span className="text-[10px] font-mono text-zinc-500">CURSOR_POS: <span className="text-blue-400">{cursor}</span></span>
              </div>
            </div>
            <div className="px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Live Feed</span>
            </div>
          </div>

          <div className="relative h-48 flex items-center overflow-hidden bg-black/40 px-4 mt-4 mb-4 mx-4 rounded-xl border border-zinc-800/50">
            {/* Visual Window Box */}
            <div className="absolute left-1/2 -translate-x-1/2 h-full w-[600px] border-x-2 border-purple-500/30 bg-purple-500/5 pointer-events-none z-10 flex flex-col items-center justify-start py-2">
              <span className="bg-purple-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-sm font-mono tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.5)]">ACTIVE_CONTEXT_WINDOW</span>
            </div>

            {/* Sliding Content */}
            <motion.div
              className="flex items-center"
              animate={{ x: `calc(50% - ${cursor * 52}px)` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {tokens.map((token, i) => {
                const isActive = i >= cursor - windowSize && i < cursor;
                const isDropped = i < cursor - windowSize;

                return (
                  <motion.div
                    key={`${token.id}-${i}`}
                    layout
                    className={`
                                     flex-shrink-0 w-[44px] h-24 flex flex-col items-center justify-center mx-1 rounded-md transition-all duration-300 border
                                     ${isActive
                        ? 'bg-zinc-900 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-110 z-20'
                        : 'bg-zinc-900/30 border-zinc-800 scale-90 opacity-40 grayscale'}
                                     ${isDropped ? 'opacity-20 blur-[1px]' : ''}
                                `}
                  >
                    <span className={`text-[9px] font-mono mb-1 ${isActive ? 'text-purple-300' : 'text-zinc-600'}`}>{token.id}</span>
                    <span className="text-xs font-medium whitespace-pre bg-black/40 px-1.5 py-0.5 rounded text-zinc-300 min-w-[20px] text-center">{token.text}</span>
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        className="mt-2 w-1 h-1 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.8)]"
                      />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-8">
          {/* Attention Output */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Simulated Attention Head (Layer 10)
            </h3>
            <div className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center min-h-[300px]">
              <AttentionMatrix
                data={activeTokens.map(t => activeTokens.map(t2 => Math.random() * t.weight))}
                className=""
              />
              <p className="mt-6 text-xs text-zinc-500 text-center max-w-sm leading-relaxed">
                <strong className="text-zinc-300">Self-Attention Mechanism:</strong> Visualizing query-key compatibility scores in real-time. Brighter cells indicate stronger semantic dependencies between tokens in the active window.
              </p>
            </div>
          </div>

          {/* Context Table */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
              Latent State Breakdown
            </h3>

            <div className="glass-panel rounded-xl overflow-hidden min-h-[300px]">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-zinc-800/50 bg-black/20 text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
                <div className="col-span-2">ID</div>
                <div className="col-span-6">Token String</div>
                <div className="col-span-4 text-right">Attention Weight</div>
              </div>
              <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode='popLayout'>
                  {activeTokens.slice().reverse().map((token, idx) => (
                    <motion.div
                      key={`${token.id}-${idx}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-12 gap-4 px-6 py-2.5 border-b border-zinc-800/30 hover:bg-white/5 transition-colors group"
                    >
                      <div className="col-span-2 text-xs font-mono text-purple-400 group-hover:text-purple-300">{token.id}</div>
                      <div className="col-span-6 text-sm text-zinc-300 font-medium truncate">
                        <span className="bg-zinc-900/50 px-1.5 py-0.5 rounded text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          {JSON.stringify(token.text).slice(1, -1)}
                        </span>
                      </div>
                      <div className="col-span-4 flex items-center justify-end gap-3">
                        <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${token.weight * 100}%` }}
                            className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">{token.weight.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <section className="mt-8">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Input Stream Injection</label>
            <span className="text-[10px] font-mono text-zinc-600">Supports Multi-lingual & Code</span>
          </div>
          <div className="glass-panel p-1 rounded-xl">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-4 rounded-lg bg-black/40 text-zinc-300 focus:outline-none focus:bg-black/60 transition-all font-mono text-xs h-24 resize-none leading-relaxed custom-scrollbar border-none placeholder:text-zinc-700"
              spellCheck={false}
            />
          </div>
        </section>

      </div>
    </main>
  );
}

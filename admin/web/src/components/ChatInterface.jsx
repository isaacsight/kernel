import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, ArrowUp, User, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const ws = useRef(null);

    // Auto-scroll to bottom with high-fidelity control
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        const connectWS = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use port 8001 directly for debugging if proxy fails, 
            // but let's try the proxied version first with better logging.
            const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
            console.log('Connecting to Sovereign WebSocket:', wsUrl);

            const socket = new WebSocket(wsUrl);
            ws.current = socket;

            socket.onopen = () => {
                console.log('WebSocket Connected');
                setLoading(false);
            };

            socket.onmessage = (event) => {
                console.log('WS Message Received:', event.data);
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'status') {
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, status: data.content }
                                ];
                            } else {
                                return [...prev, { role: 'assistant', content: '', status: data.content, isStreaming: true }];
                            }
                        });
                        return;
                    }

                    if (data.type === 'thought') {
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, reasoning: (lastMsg.reasoning || '') + data.content + '\n' }
                                ];
                            } else {
                                return [...prev, { role: 'assistant', content: '', reasoning: data.content, isStreaming: true }];
                            }
                        });
                        return;
                    }

                    if (data.type === 'result') {
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, content: data.content, isStreaming: false }
                                ];
                            } else {
                                return [...prev, { role: 'assistant', content: data.content, isStreaming: false }];
                            }
                        });
                        setLoading(false);
                        return;
                    }

                    if (data.type === 'done') {
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    const text = event.data;
                    if (text === '[DONE]') {
                        setLoading(false);
                        return;
                    }

                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                            return [
                                ...prev.slice(0, -1),
                                { ...lastMsg, content: lastMsg.content + text }
                            ];
                        } else {
                            return [...prev, { role: 'assistant', content: text, isStreaming: true }];
                        }
                    });
                }
            };

            socket.onerror = (error) => {
                console.error('WebSocket Error:', error);
            };

            socket.onclose = () => {
                console.log('WebSocket Disconnected. Retrying in 3s...');
                setTimeout(connectWS, 3000);
            };
        };

        connectWS();
        return () => {
            if (ws.current) {
                ws.current.onclose = null; // Prevent retry on manual close
                ws.current.close();
            }
        };
    }, []);

    const handleSend = (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(input);
            // Don't add an empty assistant message here if the backend broadcasts the full message
            // But for responsiveness, we can add a placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
        }
        setInput('');
    };

    return (
        <div className="h-full flex flex-col bg-black relative selection:bg-primary/20">
            {/* Scrollable conversation stream */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto pt-20 pb-40 px-4 md:px-0 custom-scrollbar scroll-smooth relative"
            >
                {/* Background Depth Gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(102,181,110,0.03)_0%,_transparent_50%)] pointer-events-none" />

                <div className="max-w-2xl mx-auto w-full relative z-10">
                    <AnimatePresence mode="popLayout">
                        {messages.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="min-h-[70vh] flex flex-col items-center justify-center text-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10 group hover:border-primary/40 transition-colors shadow-2xl shadow-primary/5">
                                    <Sparkles size={32} className="text-white/20 group-hover:text-primary transition-colors duration-500" />
                                </div>
                                <h1 className="text-4xl font-semibold tracking-tight text-white mb-4">The Sovereign</h1>
                                <p className="text-white/60 text-lg font-medium max-w-sm">
                                    Direct communication channel with Studio OS Collective Intelligence.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12 w-full">
                                    {[
                                        "Diagnose system issues",
                                        "Draft a technical post",
                                        "Analyze agent swarm",
                                        "Research biotech trends"
                                    ].map((suggestion, idx) => (
                                        <motion.button
                                            key={suggestion}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + (idx * 0.1) }}
                                            onClick={() => setInput(suggestion)}
                                            className="text-left px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all text-[15px] font-medium text-white/60"
                                        >
                                            {suggestion}
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="space-y-12">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4 }}
                                        className={`flex gap-6`}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1">
                                            {msg.role === 'assistant' ? (
                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_15px_-3px_rgba(102,181,110,0.4)]">
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white/40">
                                                    <User size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                                                {msg.role === 'assistant' ? 'The Sovereign' : 'Isaac'}
                                            </div>

                                            {msg.reasoning && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    className="text-[14px] leading-relaxed text-white/50 border-l-2 border-white/10 pl-4 py-2 my-4 bg-white/[0.02] rounded-r-lg italic"
                                                >
                                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-2 opacity-40">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
                                                        Recursive Reasoning: Pass {msg.pass || 'Trace'}
                                                    </div>
                                                    {msg.reasoning}
                                                </motion.div>
                                            )}

                                            <div className="text-[17px] leading-[1.6] text-white/90">
                                                {msg.content}
                                                {msg.isStreaming && <motion.span
                                                    animate={{ opacity: [1, 0] }}
                                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                                    className="inline-block w-1.5 h-6 bg-primary/60 ml-1 align-middle"
                                                />}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Persistent Fluid Input Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent z-40">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSend} className="neural-input">
                        <button type="button" className="p-3 text-white/20 hover:text-white transition-colors mb-0.5">
                            <Plus size={24} />
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Message Studio..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-lg py-3.5 px-2 text-white placeholder:text-white/20 resize-none max-h-40"
                            rows={1}
                        />
                        <div className="flex items-center gap-2 pb-1.5 pr-1.5">
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-xl shadow-white/5 ${input.trim() && !loading
                                    ? "bg-white text-black hover:scale-105 active:scale-95"
                                    : "bg-white/5 text-white/20 cursor-not-allowed"
                                    }`}
                            >
                                <ArrowUp size={22} strokeWidth={2.5} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;

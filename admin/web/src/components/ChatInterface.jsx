import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, Shield, Zap, Plus, Layers, Mic, Search } from 'lucide-react';
import { useMode } from '../context/ModeContext';

const ChatInterface = () => {
    const { mode } = useMode();
    const INITIAL_MESSAGE = {
        id: 1,
        role: 'assistant',
        content: "Neural link active. Systems ready. Tell me what we are creating today.",
        timestamp: new Date().toLocaleTimeString()
    };

    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);
    const ws = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/client`;
        ws.current = new WebSocket(wsUrl);

        ws.current.onmessage = (event) => {
            const text = event.data;
            if (text === '[DONE]') {
                setIsTyping(false);
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
            setIsTyping(false);
        };

        return () => ws.current?.close();
    }, []);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg = { id: Date.now(), role: 'user', content: input, timestamp: new Date().toLocaleTimeString() };
        setMessages(prev => [...prev, userMsg]);

        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(input);
            setIsTyping(true);
            setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
        }

        setInput('');
    };

    const handleNewChat = () => {
        setMessages([INITIAL_MESSAGE]);
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send("/reset");
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#FCFCFC] text-black font-sans overflow-hidden">
            {/* Minimal Header (Inspiration from Pro UI) */}
            <div className="fixed top-0 left-0 right-0 p-5 flex justify-between items-center z-30 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00D6A3] to-[#009e75] p-[2px] shadow-lg pointer-events-auto">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 blur-[2px] opacity-80 animate-pulse" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                    <button
                        onClick={handleNewChat}
                        className="p-2 rounded-full hover:bg-black/5 transition-all text-[#888]"
                    >
                        <Plus size={20} />
                    </button>
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-black/5 shadow-sm">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Isaac" alt="User" />
                    </div>
                </div>
            </div>

            {/* Background Aesthetic - Clean White Canvas */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00D6A3]/03 blur-[150px] rounded-full opacity-40" />
            </div>

            {/* Center Logo Shimmer */}
            {messages.length === 1 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
                    <div className="flex items-baseline gap-1 animate-in fade-in zoom-in-95 duration-1000">
                        <h1 className="text-4xl font-semibold tracking-tight text-black/90">studio</h1>
                        <span className="text-2xl font-light text-[#00D6A3]">one</span>
                    </div>
                    <div className="mt-2 text-[11px] font-medium tracking-[.2em] uppercase text-black/20">Agent Intelligence OS</div>
                </div>
            )}

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-5 py-24 space-y-8 scroll-smooth pb-48 z-10"
            >

                {messages.map((msg, i) => (
                    <div key={msg.id || i} className={`flex transition-all duration-500`}>
                        <div className={`w-full flex flex-col items-start`}>
                            {msg.role === 'user' ? (
                                <div className="w-full flex justify-end">
                                    <div className="bg-[#f2f2f2] text-[#222] px-6 py-3.5 rounded-2xl max-w-[85%] text-[17px] font-medium leading-relaxed shadow-sm">
                                        {msg.content}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-start gap-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                            <div className="w-3 h-3 bg-[#00D6A3] rounded-full blur-[1px]" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Studio One Agent</span>
                                    </div>
                                    <div className="text-black text-[18px] leading-[1.6] max-w-full pl-0 whitespace-pre-wrap">
                                        {msg.content}
                                        {msg.isStreaming && (
                                            <span className="inline-block w-2 h-5 ml-1 bg-[#00D6A3]/60 animate-pulse align-middle rounded-sm" />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && messages[messages.length - 1]?.content === '' && (
                    <div className="flex justify-start gap-4">
                        <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce"></div>
                    </div>
                )}
            </div>

            {/* Floating Input Bar (High Fidelity Mapping) */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#FCFCFC] via-[#FCFCFC]/90 to-transparent pt-12 z-20">
                <div className="max-w-xl mx-auto flex flex-col gap-3">
                    <div className="relative flex flex-col bg-[#F6F6F6] border border-black/[0.03] rounded-[28px] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all focus-within:bg-white focus-within:shadow-[0_10px_40px_rgba(0,0,0,0.06)] focus-within:border-black/[0.08]">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask anything..."
                            rows={1}
                            className="w-full bg-transparent border-none outline-none text-[18px] text-[#222] px-4 pt-3 pb-2 placeholder:text-[#AAA] resize-none min-h-[50px] max-h-[200px]"
                            autoFocus
                        />
                        <div className="flex items-center justify-between px-2 pb-1">
                            <div className="flex items-center gap-1">
                                <button className="p-2.5 rounded-full hover:bg-black/[0.04] text-[#888] transition-colors">
                                    <Plus size={18} />
                                </button>
                                <button className="p-2.5 rounded-full hover:bg-black/[0.04] text-[#888] transition-colors">
                                    <Search size={18} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2.5 rounded-full hover:bg-black/[0.04] text-[#888] transition-colors">
                                    <Mic size={18} />
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${input.trim()
                                        ? 'bg-[#00D6A3] text-white shadow-[0_4px_12px_rgba(0,214,163,0.3)]'
                                        : 'bg-black/10 text-white opacity-40'
                                        }`}
                                >
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        {/* Waveform-like Icon for Send in Pro UI */}
                                        <Zap size={16} fill="currentColor" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;

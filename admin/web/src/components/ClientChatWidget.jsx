import React, { useState, useEffect, useRef } from 'react';

const ClientChatWidget = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const ws = useRef(null);

    useEffect(() => {
        // Connect to WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/client`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('Connected to Client Chat');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Hello! How can I help you with your creative project today?'
            }]);
        };

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

        ws.current.onclose = () => {
            console.log('Chat disconnected');
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, []);

    const sendMessage = () => {
        if (!input.trim()) return;

        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: input }]);

        // Send to backend
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(input);
            setIsTyping(true);
            // Prepare streaming placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
        }

        setInput('');
    };

    return (
        <div className="flex flex-col h-[500px] w-full max-w-md bg-stone-900 rounded-xl overflow-hidden border border-stone-800 shadow-2xl">
            <div className="bg-stone-950 p-4 border-b border-stone-800">
                <h3 className="text-stone-200 font-semibold">Studio Assistant</h3>
                <p className="text-xs text-stone-500">Powered by Gemini AI</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                ? 'bg-orange-600 text-white'
                                : 'bg-stone-800 text-stone-300'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-stone-800 text-stone-500 text-xs rounded-lg p-2 animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-stone-950 border-t border-stone-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask about our services..."
                        className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-stone-300 focus:outline-none focus:border-orange-500"
                    />
                    <button
                        onClick={sendMessage}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientChatWidget;

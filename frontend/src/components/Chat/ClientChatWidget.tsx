import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Bot, Mail, X, Moon, Sun, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { VoiceInputButton } from './VoiceInputButton';

interface Message {
    type: 'user' | 'assistant' | 'status';
    content: string;
    timestamp: number;
}

export default function ClientChatWidget() {
    // Theme State
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    // Persistent Messages State
    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = localStorage.getItem('client_chat_history');
        return saved ? JSON.parse(saved) : [
            {
                type: 'assistant',
                content: "Hello! I am the **Studio AI**. I can read code, analyze images, and consult our team of agents. How can I help?",
                timestamp: Date.now()
            }
        ];
    });

    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // File Upload State
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ws = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Inquiry Form State
    const [showInquiryForm, setShowInquiryForm] = useState(false);
    const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [inquiryData, setInquiryData] = useState({ name: '', contact: '', message: '' });

    // Save to LocalStorage
    useEffect(() => {
        localStorage.setItem('client_chat_history', JSON.stringify(messages));
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, selectedImage]);

    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        // Connect to WebSocket - Dynamic URL for Proxy/Prod support
        // Connect to WebSocket - Direct to Backend 8000 to avoid Vite proxy lag
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = '8000'; // Direct backend port
        ws.current = new WebSocket(`${protocol}//${hostname}:${port}/ws/client`);

        ws.current.onopen = () => {
            setIsConnected(true);
            console.log('Connected to Client Service');
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status') {
                setStatus(data.content);
                setIsTyping(true); // Assume typing when status updates
                setTimeout(() => setStatus(''), 3000);

            } else if (data.type === 'response') {
                setStatus('');
                setIsTyping(false);
                setMessages(prev => [...prev, { type: 'assistant', content: data.content, timestamp: Date.now() }]);

            } else if (data.type === 'response_chunk') {
                setStatus('');
                setIsTyping(false);
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.type === 'assistant') {
                        const newContent = lastMsg.content + data.content;
                        return [...prev.slice(0, -1), { ...lastMsg, content: newContent }];
                    } else {
                        return [...prev, { type: 'assistant', content: data.content, timestamp: Date.now() }];
                    }
                });
            } else if (data.type === 'suggest_inquiry') {
                // AI detected lead intent - prompt the inquiry form
                setShowInquiryForm(true);
            }
        };

        ws.current.onclose = () => {
            setIsConnected(false);
            setStatus('');
            setIsTyping(false);
            console.log('Disconnected from Client Service');
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const sendMessage = () => {
        if ((!input.trim() && !selectedImage) || !ws.current) return;

        // Build Payload
        const payload = {
            text: input,
            images: selectedImage ? [selectedImage] : []
        };

        // Add User Message (Text + Image indicator)
        const displayContent = selectedImage
            ? `![Uploaded Image](${selectedImage})\n\n${input}`
            : input;

        setMessages(prev => [...prev, { type: 'user', content: displayContent, timestamp: Date.now() }]);

        // Send JSON
        ws.current.send(JSON.stringify(payload));

        setInput('');
        setSelectedImage(null);
        setIsTyping(true);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Voice input handlers
    const handleVoiceTranscript = useCallback((text: string) => {
        setInput(text);
    }, []);

    const handleVoiceComplete = useCallback((text: string) => {
        if (text.trim() && ws.current) {
            // Auto-send when voice input completes
            const payload = {
                text: text.trim(),
                images: selectedImage ? [selectedImage] : []
            };

            const displayContent = selectedImage
                ? `![Uploaded Image](${selectedImage})\n\n${text.trim()}`
                : text.trim();

            setMessages(prev => [...prev, { type: 'user', content: displayContent, timestamp: Date.now() }]);
            ws.current.send(JSON.stringify(payload));
            setInput('');
            setSelectedImage(null);
            setIsTyping(true);
        }
    }, [selectedImage]);

    // File Handling
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again
        if (e.target.value) e.target.value = '';
    };

    const handleInquirySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setInquiryStatus('sending');

        try {
            const response = await fetch('/api/inquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...inquiryData,
                    history: messages.map(m => `${m.type}: ${m.content}`)
                })
            });

            if (response.ok) {
                setInquiryStatus('success');
                setTimeout(() => {
                    setShowInquiryForm(false);
                    setInquiryStatus('idle');
                    setInquiryData({ name: '', contact: '', message: '' });
                    setMessages(prev => [...prev, { type: 'assistant', content: "Thanks! I've received your inquiry and submitted it to the team. We'll be in touch soon.", timestamp: Date.now() }]);
                }, 2000);
            } else {
                setInquiryStatus('error');
            }
        } catch (error) {
            console.error(error);
            setInquiryStatus('error');
        }
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Dynamic Styles based on Theme
    const isDark = theme === 'dark';
    const bg = isDark ? '#1e1e1e' : '#ffffff';
    const text = isDark ? '#d4d4d4' : '#333333';
    const headerBg = isDark ? '#252526' : '#f0f0f0';
    const border = isDark ? '#333' : '#e0e0e0';
    const inputBg = isDark ? '#1e1e1e' : '#ffffff';

    // Floating Widget Support
    if (isMinimized) {
        return (
            <div className="floating-bubble" onClick={() => setIsMinimized(false)}>
                <Bot size={24} />
                <span className="notification-dot" />
                <style>{`
                    .floating-bubble {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        width: 60px;
                        height: 60px;
                        background: #007acc;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        z-index: 1000;
                        transition: transform 0.2s;
                    }
                    .floating-bubble:hover { transform: scale(1.1); }
                    .notification-dot {
                        position: absolute;
                        top: 0;
                        right: 0;
                        width: 14px;
                        height: 14px;
                        background: #4ec9b0;
                        border-radius: 50%;
                        border: 2px solid #1e1e1e;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className={`client-chat-widget ${theme}`}>
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3>Service Assistant</h3>
                    {status && <span className="status-text">{status}</span>}
                </div>

                <div className="header-actions">
                    <button onClick={toggleTheme} className="icon-btn" title="Toggle Theme">
                        {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <button onClick={() => setIsMinimized(true)} className="icon-btn" title="Minimize">
                        <Minimize2 size={16} />
                    </button>
                    <button
                        className="inquiry-btn"
                        onClick={() => setShowInquiryForm(true)}
                        title="Submit Inquiry to Human"
                    >
                        <Mail size={16} />
                        <span className="btn-text">Contact Us</span>
                    </button>

                    <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`} />
                </div>
            </div>

            {/* Inquiry Modal Overlay */}
            {showInquiryForm && (
                <div className="inquiry-overlay">
                    <div className="inquiry-modal">
                        <div className="modal-header">
                            <h3>Submit Inquiry</h3>
                            <button className="close-btn" onClick={() => setShowInquiryForm(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {inquiryStatus === 'success' ? (
                            <div className="success-message">
                                <p>✅ Inquiry Sent Successfully!</p>
                            </div>
                        ) : (
                            <form onSubmit={handleInquirySubmit}>
                                <div className="form-group">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Your Name"
                                        value={inquiryData.name}
                                        onChange={e => setInquiryData({ ...inquiryData, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Contact (Email/Phone)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="email@example.com"
                                        value={inquiryData.contact}
                                        onChange={e => setInquiryData({ ...inquiryData, contact: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Message / Details</label>
                                    <textarea
                                        required
                                        placeholder="How can we help?"
                                        rows={3}
                                        value={inquiryData.message}
                                        onChange={e => setInquiryData({ ...inquiryData, message: e.target.value })}
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" disabled={inquiryStatus === 'sending'}>
                                        {inquiryStatus === 'sending' ? 'Sending...' : 'Submit Inquiry'}
                                    </button>
                                </div>
                                {inquiryStatus === 'error' && <p className="error-text">Failed to send. Please try again.</p>}
                            </form>
                        )}
                    </div>
                </div>
            )}

            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-row ${msg.type}`}>
                        {msg.type === 'assistant' && (
                            <div className="avatar bot-avatar">
                                <Bot size={18} />
                            </div>
                        )}
                        <div className={`message-bubble ${msg.type}`}>
                            {msg.type === 'assistant' ? (
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            ) : (
                                msg.content
                            )}
                        </div>
                        {msg.type === 'user' && (
                            <div className="avatar user-avatar">
                                <User size={18} />
                            </div>
                        )}
                    </div>
                ))}

                {isTyping && (
                    <div className="message-row assistant">
                        <div className="avatar bot-avatar">
                            <Bot size={18} />
                        </div>
                        <div className="message-bubble assistant typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Actions (Chips) */}
            {messages.length < 3 && (
                <div className="suggestions-area">
                    <button onClick={() => setInput("What are your consulting prices?")}>💰 Pricing?</button>
                    <button onClick={() => setInput("Critique my website design")}>🎨 Critique UI</button>
                    <button onClick={() => setInput("I need to build an AI agent")}>🤖 Build Agent</button>
                    <button onClick={() => setInput("Who is on your team?")}>👥 Team Roster</button>
                </div>
            )}

            {/* Image Preview */}
            {selectedImage && (
                <div className="image-preview-area">
                    <div className="preview-container">
                        <img src={selectedImage} alt="Preview" />
                        <button className="remove-btn" onClick={() => setSelectedImage(null)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            <div className="chat-input-area">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                />

                <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Upload Image for Vision Analysis">
                    <span style={{ fontSize: '1.2rem', transform: 'rotate(45deg)', display: 'block' }}>📎</span>
                </button>

                <VoiceInputButton
                    onTranscript={handleVoiceTranscript}
                    onComplete={handleVoiceComplete}
                    isDark={isDark}
                    disabled={!isConnected}
                />

                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask for strategy, code, or upload an image..."
                    rows={1}
                />
                <button onClick={sendMessage} disabled={!isConnected || (!input.trim() && !selectedImage)}>
                    <Send size={20} />
                </button>
            </div>

            <style>{`
                .client-chat-widget {
                    background: ${bg};
                    color: ${text};
                    border: 1px solid ${border};
                    border-radius: 12px;
                    width: 100%;
                    max-width: 800px; /* Wider for rich content */
                    height: 70vh; /* Responsive height */
                    min-height: 500px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    position: relative;
                    transition: all 0.3s ease;
                }
                
                .image-preview-area {
                    padding: 0 1rem;
                    background: ${headerBg};
                    border-top: 1px solid ${border};
                }
                
                .suggestions-area {
                    padding: 0.8rem 1rem;
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    background: ${headerBg};
                    border-top: 1px solid ${border};
                }
                
                .suggestions-area button {
                    background: ${isDark ? '#2d2d2d' : '#fff'};
                    border: 1px solid ${border};
                    color: ${text};
                    padding: 6px 12px;
                    border-radius: 16px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                
                .suggestions-area button:hover {
                    background: #007acc;
                    color: white;
                    border-color: #007acc;
                    transform: translateY(-1px);
                }
                
                .preview-container {
                    position: relative;
                    display: inline-block;
                    margin-top: 0.5rem;
                }
                
                .preview-container img {
                    height: 60px;
                    border-radius: 6px;
                    border: 1px solid ${border};
                }
                
                .remove-btn {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    background: #f14c4c;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .chat-header {
                    background: ${headerBg};
                    padding: 1rem;
                    border-bottom: 1px solid ${border};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .chat-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }
                
                .status-text {
                    font-size: 0.75rem;
                    color: #888;
                    font-style: italic;
                    animation: fadeIn 0.5s;
                }
                
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }
                
                .icon-btn {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                }
                
                .icon-btn:hover {
                    background: rgba(0,0,0,0.1);
                    color: ${text};
                }

                .inquiry-btn {
                    background: rgba(0,0,0,0.05);
                    border: 1px solid ${border};
                    color: ${text};
                    padding: 0.3rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s;
                }

                .inquiry-btn:hover {
                    background: rgba(0,0,0,0.1);
                }
                
                @media (max-width: 480px) {
                    .btn-text { display: none; }
                    .client-chat-widget { height: 100vh; border-radius: 0; border: none; }
                    .floating-bubble { bottom: 10px; right: 10px; }
                    .chat-input-area { gap: 0.5rem; padding: 0.75rem; }
                    .chat-input-area textarea { font-size: 16px; } /* Prevent iOS zoom */
                    .attach-btn { width: 44px; height: 44px; }
                }

                /* Modal Styles - Adapted for Theme */
                .inquiry-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    backdrop-filter: blur(2px);
                }

                .inquiry-modal {
                    background: ${bg};
                    width: 90%;
                    max-width: 400px;
                    border-radius: 12px;
                    border: 1px solid ${border};
                    padding: 1.5rem;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    color: ${text};
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .modal-header h3 {
                    margin: 0;
                    color: ${text};
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    padding: 4px;
                }

                .close-btn:hover { color: ${text}; }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    color: #888;
                    font-size: 0.85rem;
                    margin-bottom: 0.4rem;
                }

                .form-group input, 
                .form-group textarea {
                    width: 100%;
                    background: ${isDark ? '#2d2d2d' : '#f5f5f5'};
                    border: 1px solid ${border};
                    border-radius: 6px;
                    padding: 0.8rem;
                    color: ${text};
                    font-family: inherit;
                    margin-bottom: 1rem;
                }

                .form-group input:focus, 
                .form-group textarea:focus {
                    border-color: #007acc;
                    outline: none;
                }

                .form-actions button {
                    width: 100%;
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 0.8rem;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 0.5rem;
                }

                .form-actions button:hover:not(:disabled) {
                    background: #0062a3;
                }

                .form-actions button:disabled {
                    background: #333;
                    color: #666;
                    cursor: wait;
                }
                
                .success-message {
                    text-align: center;
                    color: #4ec9b0;
                    padding: 2rem 0;
                    font-size: 1.1rem;
                }
                
                .error-text {
                    color: #f14c4c;
                    font-size: 0.85rem;
                    text-align: center;
                    margin-top: 0.5rem;
                }

                /* Chat Area */
                .chat-messages {
                    flex: 1;
                    padding: 1rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    background: ${isDark ? '#1e1e1e' : '#fff'};
                }

                .message-row {
                    display: flex;
                    gap: 0.8rem;
                    align-items: flex-start;
                }
                
                .message-row.user {
                    flex-direction: row-reverse;
                }

                .avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .bot-avatar { background: #007acc; color: white; }
                .user-avatar { background: #4ec9b0; color: #1e1e1e; }

                .message-bubble {
                    background: ${isDark ? '#2d2d2d' : '#f0f0f0'};
                    padding: 0.8rem 1rem;
                    border-radius: 12px;
                    color: ${text};
                    max-width: 80%;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                
                .message-bubble.user {
                    background: #007acc;
                    color: white;
                    border-top-right-radius: 2px;
                }
                
                .message-bubble.assistant {
                    border-top-left-radius: 2px;
                }
                
                .message-bubble img {
                    max-width: 100%;
                    border-radius: 8px;
                    margin-bottom: 0.5rem;
                }

                /* Markdown Styling */
                .message-bubble p { margin: 0 0 0.5rem 0; }
                .message-bubble p:last-child { margin-bottom: 0; }
                .message-bubble ul { padding-left: 1.2rem; margin: 0.5rem 0; }
                .message-bubble strong { font-weight: 600; color: ${isDark ? '#fff' : '#000'}; }
                .message-bubble code { background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; font-size: 0.85em; }

                /* Typing Indicator */
                .typing-indicator {
                    display: flex;
                    gap: 4px;
                    padding: 12px 16px;
                    background: ${isDark ? '#2d2d2d' : '#f0f0f0'};
                }
                .typing-indicator span {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    background: #bbb;
                    border-radius: 50%;
                    margin: 0 2px;
                    animation: bounce 1.4s infinite ease-in-out;
                }
                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
                
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }

                .chat-input-area {
                    padding: 1rem;
                    background: ${headerBg};
                    display: flex;
                    gap: 1rem;
                    border-top: 1px solid ${border};
                    align-items: flex-end;
                }

                .chat-input-area textarea {
                    flex: 1;
                    background: ${inputBg};
                    border: 1px solid ${border};
                    border-radius: 8px;
                    padding: 0.8rem;
                    color: ${text};
                    resize: none;
                    font-family: inherit;
                    outline: none;
                }
                
                .chat-input-area textarea:focus {
                    border-color: #007acc;
                }
                
                .attach-btn {
                   background: none;
                   border: 1px solid ${border};
                   color: ${text};
                   width: 40px;
                   height: 40px;
                   border-radius: 8px;
                   cursor: pointer;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                }
                
                .attach-btn:hover {
                    background: rgba(0,0,0,0.05);
                }

                .chat-input-area button {
                    background: #007acc;
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                
                .chat-input-area button:hover:not(:disabled) {
                    background: #0062a3;
                }
                
                .chat-input-area button:disabled {
                    background: #333;
                    color: #666;
                    cursor: not-allowed;
                }
                }
                
                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    background: #007acc;
                    border-radius: 50%;
                    animation: typing-bounce 1.4s infinite ease-in-out;
                }
                
                .typing-indicator span:nth-child(1) { animation-delay: 0s; }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                
                @keyframes typing-bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
                    40% { transform: scale(1); opacity: 1; }
                }

                /* Quick Action Buttons */
                .quick-actions {
                    display: flex;
                    gap: 8px;
                    padding: 0 1rem 1rem;
                    flex-wrap: wrap;
                }
                
                .quick-actions button {
                    background: #252526;
                    border: 1px solid #444;
                    color: #4ec9b0;
                    padding: 6px 12px;
                    border-radius: 16px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .quick-actions button:hover {
                    background: #333;
                    border-color: #4ec9b0;
                }
            `}</style>
        </div>
    );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import ProseContainer from '../components/layout/ProseContainer';
import './StudioChat.css';

// Types
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  citations?: Array<{ title: string; url: string }>;
};

type StreamEvent =
  | { type: 'status'; content: string }
  | { type: 'thought'; content: string }
  | { type: 'result'; agent: string; content: string; citations?: Array<{ title: string; url: string }> }
  | { type: 'done' };

function StudioChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to The Studio. The Frontier Team is online. What would you like to build?"
    }
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, status]);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const host = window.location.hostname;
    const isProd = host !== 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = isProd ? '' : ':8000';
    const wsUrl = `${protocol}//${host}${port}/ws/chat`;

    function connect() {
      setIsConnecting(true);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => setIsConnecting(false);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as StreamEvent;
        if (data.type === 'status' || data.type === 'thought') {
          setStatus(data.content);
        } else if (data.type === 'result') {
          setStatus('');
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content,
            agent: data.agent,
            citations: data.citations
          });
        } else if (data.type === 'done') {
          setStatus('');
        }
      };

      ws.onclose = () => {
        setIsConnecting(true);
        setTimeout(connect, 3000);
      };

      socketRef.current = ws;
    }

    connect();
    return () => socketRef.current?.close();
  }, [addMessage]);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    addMessage({ id: crypto.randomUUID(), role: 'user', content: input });
    socketRef.current.send(input);
    setInput('');
  };

  return (
    <ProseContainer className="studio-chat-container">
      <header className="chat-header">
        <h1>Studio Interface</h1>
        <div className="connection-status">
          {isConnecting ? 'Connecting...' : 'Online'}
        </div>
      </header>

      <div className="chat-log" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-meta">
              {msg.role === 'user' ? 'You' : msg.agent || 'System'}
            </div>
            <div className="message-content">
              {msg.content}
            </div>
            {msg.citations && msg.citations.length > 0 && (
              <div className="citations">
                {msg.citations.map((c, i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer">[{i + 1}] {c.title}</a>
                ))}
              </div>
            )}
          </div>
        ))}
        {status && (
          <div className="status-message">
            <span className="blinking-cursor">_</span> {status}
          </div>
        )}
      </div>

      <div className="chat-input-wrapper">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Enter command..."
          autoFocus
        />
        <button className="chat-send-btn" onClick={sendMessage}>→</button>
      </div>
    </ProseContainer>
  );
}

export default StudioChat;

import { useState, useEffect, useRef, useCallback } from 'react';


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
  const [fri, setFri] = useState<{ score: number, label: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to The Studio. The Frontier Team is online and connected to your infrastructure. What would you like to build?"
    }
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Fetch FRI
  const fetchFRI = async () => {
    try {
      const resp = await fetch(`http://${window.location.hostname}:8000/api/studio/fri`);
      const data = await resp.json();
      setFri(data);
    } catch (e) {
      console.error("Failed to fetch FRI", e);
    }
  };

  useEffect(() => {
    fetchFRI();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchFRI, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
    if (msg.role === 'user') fetchFRI(); // Refresh on user action
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const host = window.location.hostname;
    // Use the backend port (8000)
    const wsUrl = `ws://${host}:8000/ws/chat`;

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
            id: crypto.randomUUID(), // Use secure random ID
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
    <div className="flex flex-col h-full relative">
      {/* Dynamic Background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '30vh',
        background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15), transparent 70%)',
        zIndex: 0
      }} />

      {/* Header */}
      <header className="glass-panel" style={{
        padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 900, fontSize: '20px' }}>S</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>The Studio</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Frontier Team Active</div>
            </div>
          </div>

          {/* Sovereignty Index (FRI) */}
          {fri && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              borderLeft: '1px solid var(--glass-border)', paddingLeft: '24px'
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sovereignty Index</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>{fri.score}%</span>
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>• {fri.label}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            fontSize: '12px', padding: '6px 12px', borderRadius: '20px',
            background: isConnecting ? 'rgba(234, 179, 8, 0.1)' : 'rgba(74, 222, 128, 0.1)',
            color: isConnecting ? '#EAB308' : '#4ADE80',
            border: '1px solid currentColor'
          }}>
            {isConnecting ? 'CONNECTING...' : '● SYSTEM ONLINE'}
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 0', zIndex: 1 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {messages.map(msg => (
            <div key={msg.id} className="chat-bubble" style={{
              display: 'flex', gap: '16px',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
            }}>
              {/* Avatar */}
              <div className="agent-avatar" style={{
                background: msg.role === 'user' ? '#52525b' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                {msg.role === 'user' ? 'U' : (msg.agent?.[0] || 'A')}
              </div>

              {/* Content */}
              <div style={{ maxWidth: '80%' }}>
                {msg.role === 'assistant' && (
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', marginBottom: '8px' }}>
                    {msg.agent || 'Assistant'}
                  </div>
                )}

                <div style={{
                  lineHeight: '1.7', fontSize: '16px', color: 'var(--text-main)', whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {msg.citations.map((c, i) => (
                      <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '13px', color: '#a1a1aa',
                        transition: 'background 0.2s'
                      }}>
                        <span style={{ opacity: 0.5 }}>{i + 1}.</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking State */}
          {status && (
            <div style={{ display: 'flex', gap: '16px', paddingLeft: '8px', animation: 'fadeInUp 0.3s ease' }}>
              <div style={{ width: '2px', height: '24px', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                {status}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div style={{ padding: '32px 0', zIndex: 10 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px', position: 'relative' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Send a message to the team..."
            className="glass-panel input-glow"
            style={{
              width: '100%', padding: '20px 24px', paddingRight: '60px', borderRadius: '16px',
              background: 'rgba(24, 24, 27, 0.8)', color: 'white', fontSize: '16px', outline: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease'
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              position: 'absolute', right: '32px', top: '50%', transform: 'translateY(-50%)',
              background: 'var(--primary)', border: 'none', width: '36px', height: '36px', borderRadius: '10px',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ➤
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#52525b', marginTop: '12px' }}>
          Powered by Frontier Team & Studio Node
        </div>
      </div>
    </div>
  );
}

export default StudioChat;

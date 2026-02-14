import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useKernelAgentContext } from './KernelAgentProvider';
import { KERNEL_TOPICS } from '../../agents/kernel';

export function KernelAgentChat() {
  const { messages, isStreaming, sendMessage } = useKernelAgentContext();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleTopic = (prompt: string) => {
    if (isStreaming) return;
    sendMessage(prompt);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="kernel-chat">
      <div className="kernel-chat-messages" ref={scrollRef}>
        {isEmpty && (
          <div className="kernel-chat-empty">
            <p className="kernel-chat-empty-title">Ask the Kernel Agent</p>
            <p className="kernel-chat-empty-subtitle">
              It sees everything the engine sees.
            </p>
            <div className="kernel-chat-topics">
              {KERNEL_TOPICS.map(topic => (
                <button
                  key={topic.label}
                  className="kernel-chat-topic"
                  onClick={() => handleTopic(topic.prompt)}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <motion.div
            key={msg.id}
            className={`kernel-chat-msg kernel-chat-msg--${msg.role}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="kernel-chat-msg-content">
              {msg.content || (
                <span className="kernel-chat-typing">
                  <span /><span /><span />
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <form className="kernel-chat-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the Kernel..."
          disabled={isStreaming}
          className="kernel-chat-input-field"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="kernel-chat-send"
        >
          &rarr;
        </button>
      </form>
    </div>
  );
}

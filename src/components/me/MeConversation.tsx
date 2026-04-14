// ─── Me Conversation ───────────────────────────────────────────
//
// Editorial correspondence-style chat. No bubbles, no chrome.
// Visitor lines appear italic serif, indented. The agent replies
// flush-left in prose. Designed to read like a letter exchange.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from 'react'
import { useMeAgent } from '../../hooks/useMeAgent'
import type { MeAgentContext } from '../../agents/me-agent'

interface Props {
  ctx: MeAgentContext
  name: string
}

export interface MeConversationHandle {
  ask: (question: string) => void
}

export const MeConversation = forwardRef<MeConversationHandle, Props>(function MeConversation(
  { ctx, name },
  ref,
) {
  const { turns, send, isStreaming, error, reset } = useMeAgent(ctx)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [turns])

  useImperativeHandle(ref, () => ({
    ask: (question: string) => {
      if (!question.trim() || isStreaming) return
      void send(question)
    },
  }), [send, isStreaming])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    const msg = input
    setInput('')
    await send(msg)
  }

  const firstName = name.split(' ')[0]

  return (
    <div className="ka-me-converse">
      <div className="ka-me-converse-epigraph">
        <p>
          Speak with the agent of <em>{name}</em>. It answers from what has been
          published here — influences, timeline, studio log, posts. What isn't
          in the record, it won't pretend to know.
        </p>
      </div>

      <div className="ka-me-converse-thread" ref={scrollRef}>
        {turns.length === 0 && (
          <div className="ka-me-converse-prompts">
            <SuggestionButton text={`What is ${firstName} shaped by lately?`} onClick={send} />
            <SuggestionButton text={`What has ${firstName} been working on?`} onClick={send} />
            <SuggestionButton text={`Describe ${firstName}'s studio practice.`} onClick={send} />
          </div>
        )}

        {turns.map(turn => (
          <div
            key={turn.id}
            className={`ka-me-converse-turn ka-me-converse-turn--${turn.role}`}
          >
            {turn.role === 'visitor' ? (
              <>
                <span className="ka-me-converse-marker">Asked</span>
                <p className="ka-me-converse-text">{turn.text}</p>
              </>
            ) : (
              <>
                <span className="ka-me-converse-marker">— {firstName}</span>
                <p className="ka-me-converse-text">
                  {turn.text || <span className="ka-me-converse-thinking">thinking…</span>}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {error && <div className="ka-me-converse-error">{error}</div>}

      <form className="ka-me-converse-form" onSubmit={handleSubmit}>
        <input
          className="ka-me-converse-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask ${firstName} something…`}
          disabled={isStreaming}
          aria-label="Ask a question"
        />
        <button
          type="submit"
          className="ka-me-converse-send"
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? 'sending' : 'send'}
        </button>
        {turns.length > 0 && (
          <button
            type="button"
            className="ka-me-converse-reset"
            onClick={reset}
            disabled={isStreaming}
          >
            clear
          </button>
        )}
      </form>
    </div>
  )
})

function SuggestionButton({ text, onClick }: { text: string; onClick: (t: string) => void }) {
  return (
    <button
      type="button"
      className="ka-me-converse-suggestion"
      onClick={() => onClick(text)}
    >
      {text}
    </button>
  )
}

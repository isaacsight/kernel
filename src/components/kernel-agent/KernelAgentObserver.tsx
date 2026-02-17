import { useState } from 'react';
import { motion } from 'framer-motion';
import { useKernelAgentContext } from './KernelAgentProvider';
import type { CognitivePhase } from '../../engine/AIEngine';

const PHASES: CognitivePhase[] = ['perceiving', 'attending', 'deciding', 'acting', 'reflecting'];

function Section({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="kernel-obs-section">
      <button className="kernel-obs-section-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="kernel-obs-chevron">{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && <div className="kernel-obs-section-body">{children}</div>}
    </div>
  );
}

function MiniBar({ value, color = '#6366F1' }: { value: number; color?: string }) {
  return (
    <div className="kernel-obs-minibar">
      <motion.div
        className="kernel-obs-minibar-fill"
        style={{ background: color }}
        animate={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

export function KernelAgentObserver() {
  const { engineState, events } = useKernelAgentContext();
  const { phase, ephemeral, worldModel, lasting } = engineState;

  const conviction = worldModel.convictions;
  const perception = ephemeral.perception;
  const attention = ephemeral.attention;
  const lastReflection = lasting.reflections[lasting.reflections.length - 1];

  return (
    <div className="kernel-observer">
      {/* Phase Pipeline */}
      <Section title="Phase Pipeline">
        <div className="kernel-obs-phases">
          {PHASES.map(p => (
            <div key={p} className={`kernel-obs-phase ${phase === p ? 'kernel-obs-phase--active' : ''}`}>
              <span className="kernel-obs-phase-dot" />
              <span className="kernel-obs-phase-label">{p}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Perception */}
      <Section title="Perception" defaultOpen={!!perception}>
        {perception ? (
          <div className="kernel-obs-grid">
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Intent</span>
              <span className="kernel-obs-value">{perception.intent.type}</span>
            </div>
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Urgency</span>
              <MiniBar value={perception.urgency} />
            </div>
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Complexity</span>
              <MiniBar value={perception.complexity} />
            </div>
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Sentiment</span>
              <span className="kernel-obs-value">{perception.sentiment > 0 ? '+' : ''}{perception.sentiment.toFixed(2)}</span>
            </div>
            <div className="kernel-obs-item kernel-obs-item--full">
              <span className="kernel-obs-label">Implied Need</span>
              <span className="kernel-obs-value kernel-obs-value--italic">{perception.impliedNeed}</span>
            </div>
          </div>
        ) : (
          <p className="kernel-obs-empty">No active perception</p>
        )}
      </Section>

      {/* Attention */}
      <Section title="Attention" defaultOpen={!!attention}>
        {attention ? (
          <div className="kernel-obs-attention">
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Focus</span>
              <span className="kernel-obs-value">{attention.primaryFocus}</span>
            </div>
            <div className="kernel-obs-item">
              <span className="kernel-obs-label">Depth</span>
              <span className={`kernel-obs-badge kernel-obs-badge--${attention.depth}`}>{attention.depth}</span>
            </div>
            {Object.entries(attention.salience).length > 0 && (
              <div className="kernel-obs-salience">
                {Object.entries(attention.salience).map(([key, val]) => (
                  <div key={key} className="kernel-obs-salience-row">
                    <span className="kernel-obs-salience-key">{key}</span>
                    <MiniBar value={val} color="#7B68EE" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="kernel-obs-empty">No active attention</p>
        )}
      </Section>

      {/* Conviction */}
      <Section title="Conviction">
        <div className="kernel-obs-conviction">
          <div className="kernel-obs-conviction-bar">
            <motion.div
              className="kernel-obs-conviction-fill"
              animate={{ width: `${conviction.overall * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="kernel-obs-conviction-meta">
            <span>{(conviction.overall * 100).toFixed(1)}%</span>
            <span className="kernel-obs-conviction-trend">
              {conviction.trend === 'rising' ? '\u2197' : conviction.trend === 'falling' ? '\u2198' : '\u2192'}
              {' '}{conviction.trend}
            </span>
          </div>
        </div>
      </Section>

      {/* Beliefs */}
      <Section title={`Beliefs (${worldModel.beliefs.length})`} defaultOpen={worldModel.beliefs.length > 0}>
        {worldModel.beliefs.length === 0 ? (
          <p className="kernel-obs-empty">No beliefs formed</p>
        ) : (
          <div className="kernel-obs-beliefs">
            {worldModel.beliefs.map(b => (
              <div key={b.id} className="kernel-obs-belief">
                <span className="kernel-obs-belief-text">{b.content}</span>
                <div className="kernel-obs-belief-meta">
                  <MiniBar value={b.confidence} />
                  <span className="kernel-obs-belief-source">{b.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Event Feed */}
      <Section title="Event Feed" defaultOpen={events.length > 0}>
        {events.length === 0 ? (
          <p className="kernel-obs-empty">No events yet</p>
        ) : (
          <div className="kernel-obs-events">
            {[...events].reverse().slice(0, 20).map((event, i) => (
              <div key={i} className="kernel-obs-event">
                <span className="kernel-obs-event-time">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="kernel-obs-event-type">{event.type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Last Reflection */}
      <Section title="Last Reflection" defaultOpen={!!lastReflection}>
        {lastReflection ? (
          <div className="kernel-obs-reflection">
            <div className="kernel-obs-grid">
              {Object.entries(lastReflection.scores).map(([key, val]) => (
                <div key={key} className="kernel-obs-item">
                  <span className="kernel-obs-label">{key}</span>
                  <MiniBar value={val} />
                </div>
              ))}
            </div>
            <p className="kernel-obs-reflection-lesson">{lastReflection.lesson}</p>
          </div>
        ) : (
          <p className="kernel-obs-empty">No reflections yet</p>
        )}
      </Section>
    </div>
  );
}

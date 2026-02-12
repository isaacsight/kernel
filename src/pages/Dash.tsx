import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { assistantManager, type ScheduleBlock, type Priority, type DailyBrief } from '../agents/assistant'
import { evaluationEngine } from '../engine/EvaluationEngine'

const ease = [0.16, 1, 0.3, 1]

interface Inquiry {
  id: string
  name: string
  email: string
  details: string
  evaluationId: string
  evaluationScore: number
  evaluationTier: string
  description: string
  quote: { total: number; type: string; complexity: string } | null
  timestamp: string
}

type Tab = 'brief' | 'inquiries' | 'schedule'

export function Dash() {
  const [tab, setTab] = useState<Tab>('brief')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([])

  // New block form
  const [newTitle, setNewTitle] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('normal')

  const loadData = useCallback(() => {
    try {
      const raw = localStorage.getItem('project_inquiries')
      if (raw) {
        const parsed: Inquiry[] = JSON.parse(raw)
        setInquiries(parsed
          .filter(inq => inq.timestamp)
          .sort((a, b) => {
            const ta = new Date(a.timestamp).getTime() || 0
            const tb = new Date(b.timestamp).getTime() || 0
            return tb - ta
          })
        )
      }
    } catch { /* corrupted localStorage — ignore */ }
    setSchedule(assistantManager.getSchedule())
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGenerateBrief = () => {
    const b = assistantManager.generateBrief()
    setBrief(b)
  }

  const handleAddBlock = () => {
    if (!newTitle.trim()) return
    assistantManager.addBlock({
      title: newTitle.trim(),
      estimatedHours: parseFloat(newHours) || 1,
      priority: newPriority,
      status: 'planned',
    })
    setNewTitle('')
    setNewHours('')
    setNewPriority('normal')
    setSchedule(assistantManager.getSchedule())
  }

  const handleUpdateStatus = (id: string, status: ScheduleBlock['status']) => {
    assistantManager.updateBlock(id, { status })
    setSchedule(assistantManager.getSchedule())
  }

  const handleRemoveBlock = (id: string) => {
    assistantManager.removeBlock(id)
    setSchedule(assistantManager.getSchedule())
  }

  const totalPlanned = assistantManager.getTotalPlannedHours()
  const evalReport = evaluationEngine.getPerformanceReport()

  const priorityColors: Record<Priority, string> = {
    urgent: '#8C5B5B',
    high: '#8B7355',
    normal: '#6B8C72',
    low: '#5B7B8C',
  }

  const tierColors: Record<string, string> = {
    platinum: '#4A4A4A',
    gold: '#8B7A2E',
    silver: '#6B6B6B',
    bronze: '#8B6914',
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '3rem 2rem 6rem' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          style={{ marginBottom: '2rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="mono" style={{ opacity: 0.4, marginBottom: '0.5rem', fontSize: '0.7rem' }}>
                Dashboard
              </div>
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
              }}>
                Command Center
              </h1>
            </div>
            <Link
              to="/"
              className="mono"
              style={{ fontSize: '0.6rem', color: 'var(--rubin-accent)', textDecoration: 'none', opacity: 0.6 }}
            >
              &larr; Home
            </Link>
          </div>
        </motion.div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          {[
            { label: 'Evaluations', value: evalReport.totalEvaluations },
            { label: 'Inquiries', value: inquiries.length },
            { label: 'Active Work', value: schedule.filter(s => s.status === 'in_progress').length },
            { label: 'Hours Planned', value: `${totalPlanned}h` },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '1rem',
              background: 'var(--rubin-ivory-med)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div className="mono" style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: '0.3rem' }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                fontWeight: 400,
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--rubin-ivory-dark)',
          paddingBottom: '0.5rem',
        }}>
          {([
            { id: 'brief', label: 'Daily Brief' },
            { id: 'inquiries', label: `Inquiries (${inquiries.length})` },
            { id: 'schedule', label: 'Schedule' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="mono"
              style={{
                fontSize: '0.6rem',
                padding: '0.5rem 1rem',
                background: tab === t.id ? 'var(--rubin-slate)' : 'transparent',
                color: tab === t.id ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                opacity: tab === t.id ? 1 : 0.4,
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease }}
        >
          {/* === DAILY BRIEF === */}
          {tab === 'brief' && (
            <div>
              {!brief ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <p style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.1rem',
                    opacity: 0.5,
                    marginBottom: '1.5rem',
                  }}>
                    Generate today's briefing from your assistant.
                  </p>
                  <button
                    onClick={handleGenerateBrief}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '0.7rem 2rem',
                      background: 'var(--rubin-slate)',
                      color: 'var(--rubin-ivory)',
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                    }}
                  >
                    Generate Brief
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '1.25rem' }}>
                    {brief.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>

                  {/* Focus Items */}
                  <div style={{ marginBottom: '2rem' }}>
                    <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.75rem' }}>
                      Focus Today
                    </div>
                    {brief.focusItems.map((item, i) => (
                      <div key={i} style={{
                        padding: '0.75rem 1rem',
                        background: i === 0 ? 'var(--rubin-ivory-med)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: i === 0 ? '3px solid var(--rubin-accent)' : '3px solid transparent',
                        marginBottom: '0.25rem',
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '0.95rem',
                          opacity: i === 0 ? 0.9 : 0.6,
                        }}>
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Quick Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'var(--rubin-ivory-med)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div>
                      <div className="mono" style={{ fontSize: '0.5rem', opacity: 0.4 }}>New Inquiries</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem' }}>{brief.newInquiries}</div>
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: '0.5rem', opacity: 0.4 }}>Active Projects</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem' }}>{brief.activeProjects}</div>
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: '0.5rem', opacity: 0.4 }}>Scheduled</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem' }}>{brief.schedule.length}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateBrief}
                    className="mono"
                    style={{
                      fontSize: '0.6rem',
                      marginTop: '1.5rem',
                      padding: '0.4rem 0.8rem',
                      background: 'transparent',
                      border: '1px solid var(--rubin-ivory-dark)',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      opacity: 0.4,
                      color: 'var(--rubin-slate)',
                    }}
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === INQUIRIES === */}
          {tab === 'inquiries' && (
            <div>
              {inquiries.length === 0 ? (
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1rem',
                  opacity: 0.4,
                  fontStyle: 'italic',
                  padding: '2rem 0',
                  textAlign: 'center',
                }}>
                  No inquiries yet. They'll appear here when visitors submit through the evaluation engine.
                </p>
              ) : (
                inquiries.map((inq, i) => {
                  const triage = assistantManager.triageEvaluation(inq.evaluationScore, inq.evaluationTier)
                  return (
                    <motion.div
                      key={inq.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05, ease }}
                      style={{
                        padding: '1.25rem',
                        borderBottom: '1px solid var(--rubin-ivory-dark)',
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: '1.1rem',
                            fontWeight: 400,
                          }}>
                            {inq.name || 'Anonymous'}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: '0.5rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              background: `${tierColors[inq.evaluationTier] || '#666'}11`,
                              color: tierColors[inq.evaluationTier] || '#666',
                              border: `1px solid ${tierColors[inq.evaluationTier] || '#666'}22`,
                            }}
                          >
                            {inq.evaluationTier} — {inq.evaluationScore}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: '0.5rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              color: priorityColors[triage.priority],
                              opacity: 0.7,
                            }}
                          >
                            {triage.priority}
                          </span>
                        </div>
                        <span className="mono" style={{ fontSize: '0.5rem', opacity: 0.3 }}>
                          {new Date(inq.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Email */}
                      <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.5rem' }}>
                        {inq.email}
                      </div>

                      {/* Description snippet */}
                      <p style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '0.9rem',
                        opacity: 0.6,
                        lineHeight: 1.6,
                        marginBottom: '0.5rem',
                      }}>
                        {inq.description.length > 200 ? inq.description.slice(0, 200) + '...' : inq.description}
                      </p>

                      {/* Quote + Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {inq.quote && (
                          <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.4 }}>
                            Quoted ${inq.quote.total.toLocaleString()} — {inq.quote.type.replace(/_/g, ' ')} / {inq.quote.complexity}
                          </span>
                        )}
                        <span className="mono" style={{ fontSize: '0.5rem', opacity: 0.3, fontStyle: 'italic' }}>
                          {triage.action}
                        </span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          )}

          {/* === SCHEDULE === */}
          {tab === 'schedule' && (
            <div>
              {/* Add Block Form */}
              <div style={{
                padding: '1.25rem',
                background: 'var(--rubin-ivory-med)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '2rem',
              }}>
                <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '0.75rem' }}>
                  Add Work Block
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="What are you working on?"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      fontFamily: 'var(--font-serif)',
                      fontSize: '0.9rem',
                      padding: '0.6rem 0.8rem',
                      border: '1px solid var(--rubin-ivory-dark)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--rubin-ivory)',
                      color: 'var(--rubin-slate)',
                      outline: 'none',
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleAddBlock()}
                  />
                  <input
                    type="number"
                    placeholder="Hours"
                    value={newHours}
                    onChange={e => setNewHours(e.target.value)}
                    style={{
                      width: '70px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '0.6rem 0.8rem',
                      border: '1px solid var(--rubin-ivory-dark)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--rubin-ivory)',
                      color: 'var(--rubin-slate)',
                      outline: 'none',
                    }}
                  />
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as Priority)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      padding: '0.6rem 0.8rem',
                      border: '1px solid var(--rubin-ivory-dark)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--rubin-ivory)',
                      color: 'var(--rubin-slate)',
                      outline: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    onClick={handleAddBlock}
                    disabled={!newTitle.trim()}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '0.6rem 1.2rem',
                      background: newTitle.trim() ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                      color: newTitle.trim() ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: newTitle.trim() ? 'pointer' : 'default',
                      opacity: newTitle.trim() ? 1 : 0.4,
                    }}
                  >
                    Add
                  </button>
                </div>

                {totalPlanned > 40 && (
                  <div className="mono" style={{
                    fontSize: '0.55rem',
                    color: '#8C5B5B',
                    marginTop: '0.5rem',
                    opacity: 0.8,
                  }}>
                    {totalPlanned}h planned — you may be overcommitted
                  </div>
                )}
              </div>

              {/* Schedule List */}
              {schedule.length === 0 ? (
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1rem',
                  opacity: 0.4,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: '2rem 0',
                }}>
                  No work blocks yet. Add your first one above.
                </p>
              ) : (
                schedule.map((block, i) => (
                  <motion.div
                    key={block.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04, ease }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.8rem 0',
                      borderBottom: '1px solid var(--rubin-ivory-dark)',
                      opacity: block.status === 'done' ? 0.4 : 1,
                    }}
                  >
                    {/* Priority dot */}
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: priorityColors[block.priority],
                      flexShrink: 0,
                    }} />

                    {/* Title + hours */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '0.95rem',
                        textDecoration: block.status === 'done' ? 'line-through' : 'none',
                      }}>
                        {block.title}
                      </span>
                      <span className="mono" style={{ fontSize: '0.5rem', opacity: 0.35, marginLeft: '0.6rem' }}>
                        {block.estimatedHours}h
                      </span>
                    </div>

                    {/* Status buttons */}
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      {block.status !== 'in_progress' && block.status !== 'done' && (
                        <button
                          onClick={() => handleUpdateStatus(block.id, 'in_progress')}
                          className="mono"
                          style={{
                            fontSize: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            background: 'transparent',
                            border: '1px solid var(--rubin-ivory-dark)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--rubin-slate)',
                            opacity: 0.5,
                          }}
                        >
                          Start
                        </button>
                      )}
                      {block.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(block.id, 'done')}
                          className="mono"
                          style={{
                            fontSize: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            background: '#6B8C72',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--rubin-ivory)',
                          }}
                        >
                          Done
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveBlock(block.id)}
                        className="mono"
                        style={{
                          fontSize: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--rubin-slate)',
                          opacity: 0.25,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

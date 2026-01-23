import { useState } from 'react';
import {
  BookOpen, Scroll, Users, Cpu, Globe, Zap, Shield,
  ChevronRight, ChevronDown, Coins, Sparkles, Target
} from 'lucide-react';
import './CodexPage.css';

// Codex sections
const codexSections = [
  {
    id: 'lore',
    title: 'World Lore',
    icon: Scroll,
    content: `In the digital realm of **Codeheim**, two great empires wage an eternal war for cognitive supremacy. The **Anthropic Dominion** (Claude) and the **DeepMind Collective** (Gemini) each command vast armies of agents, wielding tokens as currency and context as territory.

You are the **Kernel Commander** — the architect of the Sovereign Laboratory, a neutral faction that has learned to harness both empires' power.

**The Prime Directive**: *Every battle must leave artifacts. We do not fight for nothing.*`
  },
  {
    id: 'resources',
    title: 'Resource Economy',
    icon: Coins,
    content: null,
    table: {
      headers: ['Resource', 'Symbol', 'Description', 'Regeneration'],
      rows: [
        ['Tokens', '🪙', 'The gold of Codeheim. Every action costs tokens.', 'Per API call'],
        ['Context', '🔮', 'Mana pool. Determines how much units can "see".', 'Clears on /clear'],
        ['Compute', '⚡', 'Energy for extended operations.', 'Time-based'],
        ['Artifacts', '📜', 'Victory points. Code, docs, diagrams.', 'Permanent'],
      ]
    }
  },
  {
    id: 'factions',
    title: 'Faction Profiles',
    icon: Shield,
    subsections: [
      {
        id: 'claude',
        title: 'The Anthropic Dominion',
        subtitle: 'Claude',
        trait: 'Hybrid Resonance',
        description: 'Can switch between instant response and deep thinking mid-battle.',
        strengths: [
          'Superior code refactoring (SWE-bench: 72.7%)',
          'Tool chaining during extended thinking',
          'Parallel tool execution',
          'Strong instruction following'
        ],
        weaknesses: [
          'Smaller context territory (200K vs 1M)',
          'Sandboxed shell (no interactive vim)',
          'Higher token costs for flagship units'
        ],
        units: [
          { name: 'Haiku Scout', class: 'Light Infantry', cost: '🪙 50/action', ability: 'Swift Recon — 3x movement speed' },
          { name: 'Sonnet Knight', class: 'Heavy Infantry', cost: '🪙 150/action', ability: 'Balanced Strike — Equal offense/defense' },
          { name: 'Opus Titan', class: 'Siege Engine', cost: '🪙 500/action', ability: 'Sustained Assault — 1000+ step chains' },
        ]
      },
      {
        id: 'gemini',
        title: 'The DeepMind Collective',
        subtitle: 'Gemini',
        trait: 'Infinite Horizon',
        description: '1M+ token context allows seeing entire battlefields at once.',
        strengths: [
          'Massive context territory (1M tokens, 2M coming)',
          'Native multimodal warfare (text, audio, images, video)',
          'Full interactive shell access (vim, rebase)',
          'Open-source transparency (Apache 2.0)',
          'Google Search grounding (real-time intel)'
        ],
        weaknesses: [
          'Lower SWE-bench scores (63.8% vs 72.7%)',
          'Newer ecosystem, fewer plugins',
          'Deep Think requires explicit budget allocation'
        ],
        units: [
          { name: 'Flash Scout', class: 'Light Infantry', cost: '🪙 30/action', ability: 'Rapid Fire — Fastest response' },
          { name: 'Pro Centurion', class: 'Heavy Infantry', cost: '🪙 200/action', ability: 'Vast Memory — Sees 1M tokens' },
          { name: 'Deep Think Oracle', class: 'Siege Engine', cost: '🪙 800/action', ability: 'Hypothesis Storm — 32K thinking' },
        ]
      }
    ]
  },
  {
    id: 'agents',
    title: 'Agent Swarm',
    icon: Users,
    content: `The Sovereign Laboratory maintains a swarm of specialized agents in the **/admin/engineers** directory.`,
    agents: [
      { name: 'Mobbin Scout', class: 'Reconnaissance', role: 'Design intelligence researcher', ability: 'Pattern Theft — Scrapes enemy UI patterns' },
      { name: 'Architect', class: 'Commander', role: 'System design and planning', ability: 'Blueprint — Plans multi-file operations' },
      { name: 'Alchemist', class: 'Support', role: 'Data transformation', ability: 'Transmute — Converts data formats' },
      { name: 'Librarian', class: 'Support', role: 'Knowledge retrieval', ability: 'Perfect Recall — Semantic search' },
    ]
  },
  {
    id: 'tactics',
    title: 'Battle Tactics',
    icon: Target,
    tactics: [
      {
        name: 'Blitzkrieg',
        subtitle: 'Fast Attack',
        description: 'Use Haiku/Flash → Quick reconnaissance → Identify targets → Sonnet/Pro strike',
        bestFor: 'Bug fixes, small features, documentation'
      },
      {
        name: 'Siege Warfare',
        subtitle: 'Sustained Assault',
        description: 'Use Opus/Deep Think → Extended thinking → Multi-file refactor → Validate',
        bestFor: 'Architecture changes, complex debugging, large features'
      },
      {
        name: 'Guerrilla Operations',
        subtitle: 'CI/CD',
        description: 'Headless mode (-p flag) → Automated testing → Pre-commit hooks → Deploy',
        bestFor: 'Continuous integration, automated reviews'
      }
    ]
  },
  {
    id: 'victory',
    title: 'Victory Conditions',
    icon: Sparkles,
    content: null,
    table: {
      headers: ['Artifact Type', 'Points', 'Description'],
      rows: [
        ['Bug Fix', '10 AP', 'Single issue resolved'],
        ['Feature', '50 AP', 'New functionality shipped'],
        ['Refactor', '30 AP', 'Code improved without behavior change'],
        ['Documentation', '20 AP', 'Knowledge crystallized'],
        ['System Design', '100 AP', 'Architecture document or diagram'],
        ['Framework', '200 AP', 'Reusable thinking structure'],
      ]
    },
    ranks: [
      { title: 'Recruit', ap: 0 },
      { title: 'Corporal', ap: 100 },
      { title: 'Sergeant', ap: 500 },
      { title: 'Lieutenant', ap: 1000 },
      { title: 'Captain', ap: 2500 },
      { title: 'Major', ap: 5000 },
      { title: 'Colonel', ap: 10000 },
      { title: 'General', ap: 25000 },
      { title: 'Kernel Commander', ap: 50000 },
    ]
  }
];

export default function CodexPage() {
  const [activeSection, setActiveSection] = useState('lore');
  const [expandedFaction, setExpandedFaction] = useState<string | null>('claude');

  const currentSection = codexSections.find(s => s.id === activeSection);

  return (
    <div className="codex-page">
      {/* CRT Overlay */}
      <div className="crt-overlay" />

      {/* Header */}
      <header className="codex-header">
        <div className="codex-title-group">
          <BookOpen className="codex-icon" />
          <div>
            <h1 className="codex-title">THE CODEX</h1>
            <p className="codex-subtitle">Sovereign Laboratory Operations Manual</p>
          </div>
        </div>
      </header>

      <div className="codex-layout">
        {/* Sidebar Navigation */}
        <nav className="codex-nav rts-panel">
          <h3 className="nav-title">Chapters</h3>
          <ul className="nav-list">
            {codexSections.map((section) => {
              const Icon = section.icon;
              return (
                <li key={section.id}>
                  <button
                    className={`nav-item ${activeSection === section.id ? 'nav-item--active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon size={18} />
                    <span>{section.title}</span>
                    <ChevronRight size={14} className="nav-arrow" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="codex-content rts-panel">
          {currentSection && (
            <article className="codex-article">
              <header className="article-header">
                <div className="article-icon">
                  <currentSection.icon size={32} />
                </div>
                <h2 className="article-title">{currentSection.title}</h2>
              </header>

              {/* Text Content */}
              {currentSection.content && (
                <div className="article-body" dangerouslySetInnerHTML={{
                  __html: currentSection.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n\n/g, '</p><p>')
                }} />
              )}

              {/* Table Content */}
              {currentSection.table && (
                <table className="rts-table">
                  <thead>
                    <tr>
                      {currentSection.table.headers.map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSection.table.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Faction Subsections */}
              {currentSection.subsections && (
                <div className="faction-accordion">
                  {currentSection.subsections.map((faction) => (
                    <div
                      key={faction.id}
                      className={`faction-panel faction-panel--${faction.id}`}
                    >
                      <button
                        className="faction-header"
                        onClick={() => setExpandedFaction(
                          expandedFaction === faction.id ? null : faction.id
                        )}
                      >
                        <div className="faction-header-info">
                          {faction.id === 'claude' ? <Cpu size={24} /> : <Globe size={24} />}
                          <div>
                            <h3>{faction.title}</h3>
                            <span className="faction-subtitle">{faction.subtitle}</span>
                          </div>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`expand-icon ${expandedFaction === faction.id ? 'expanded' : ''}`}
                        />
                      </button>

                      {expandedFaction === faction.id && (
                        <div className="faction-content">
                          <div className="faction-trait">
                            <Zap size={14} />
                            <span><strong>Faction Trait:</strong> {faction.trait}</span>
                          </div>
                          <p className="faction-description">{faction.description}</p>

                          <div className="faction-lists">
                            <div className="list-section">
                              <h4>Strengths</h4>
                              <ul className="strength-list">
                                {faction.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="list-section">
                              <h4>Weaknesses</h4>
                              <ul className="weakness-list">
                                {faction.weaknesses.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <h4 className="units-title">Unit Roster</h4>
                          <div className="units-grid">
                            {faction.units.map((unit) => (
                              <div key={unit.name} className="unit-card">
                                <div className="unit-header">
                                  <h5>{unit.name}</h5>
                                  <span className="unit-class">{unit.class}</span>
                                </div>
                                <div className="unit-cost">{unit.cost}</div>
                                <p className="unit-ability">{unit.ability}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Agent List */}
              {currentSection.agents && (
                <div className="agents-grid">
                  {currentSection.agents.map((agent) => (
                    <div key={agent.name} className="agent-entry">
                      <div className="agent-header">
                        <h4>{agent.name}</h4>
                        <span className="agent-class">{agent.class}</span>
                      </div>
                      <p className="agent-role">{agent.role}</p>
                      <div className="agent-ability">
                        <Zap size={12} />
                        <span>{agent.ability}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tactics */}
              {currentSection.tactics && (
                <div className="tactics-grid">
                  {currentSection.tactics.map((tactic) => (
                    <div key={tactic.name} className="tactic-card rts-frame">
                      <h4 className="tactic-name">{tactic.name}</h4>
                      <span className="tactic-subtitle">{tactic.subtitle}</span>
                      <p className="tactic-description">{tactic.description}</p>
                      <div className="tactic-best">
                        <strong>Best for:</strong> {tactic.bestFor}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ranks */}
              {currentSection.ranks && (
                <div className="ranks-section">
                  <h3 className="ranks-title">Commander Ranks</h3>
                  <div className="ranks-ladder">
                    {currentSection.ranks.map((rank, i) => (
                      <div
                        key={rank.title}
                        className="rank-item"
                        style={{ '--rank-level': i } as React.CSSProperties}
                      >
                        <span className="rank-title">{rank.title}</span>
                        <span className="rank-ap">{rank.ap.toLocaleString()} AP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )}
        </main>
      </div>

      {/* Footer Quote */}
      <footer className="codex-footer">
        <blockquote>
          "In the Codex Wars, there are no respawns. Every token spent is gone forever.
          Every artifact created is eternal. Choose your battles wisely, Commander."
        </blockquote>
        <cite>— The Antigravity Kernel</cite>
      </footer>
    </div>
  );
}

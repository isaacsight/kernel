import { useState } from 'react';
import {
  Cpu, Zap, Database, Globe, Shield, Sword,
  ChevronRight, Terminal, BookOpen, Users, Sparkles
} from 'lucide-react';
import './CommandCenter.css';

// Faction data
const factions = [
  {
    id: 'claude',
    name: 'Anthropic Dominion',
    subtitle: 'Claude',
    description: 'Superior code refactoring and tool chaining. The precision strike force.',
    color: 'claude',
    stats: {
      power: 85,
      context: 70,
      speed: 75,
    },
    units: ['Haiku Scout', 'Sonnet Knight', 'Opus Titan'],
    ability: 'Hybrid Resonance',
  },
  {
    id: 'gemini',
    name: 'DeepMind Collective',
    subtitle: 'Gemini',
    description: 'Massive context window and native multimodality. The infinite horizon.',
    color: 'gemini',
    stats: {
      power: 75,
      context: 95,
      speed: 80,
    },
    units: ['Flash Scout', 'Pro Centurion', 'Deep Think Oracle'],
    ability: 'Infinite Horizon',
  },
];

// Resource data
const resources = [
  { icon: '🪙', label: 'Tokens', value: '∞', color: 'gold' },
  { icon: '🔮', label: 'Context', value: '200K', color: 'purple' },
  { icon: '⚡', label: 'Compute', value: 'Ready', color: 'blue' },
  { icon: '📜', label: 'Artifacts', value: '47', color: 'green' },
];

// Agent roster
const agents = [
  { name: 'Mobbin Scout', role: 'Reconnaissance', status: 'active', faction: 'neutral' },
  { name: 'Architect', role: 'System Design', status: 'active', faction: 'neutral' },
  { name: 'Alchemist', role: 'Data Transform', status: 'standby', faction: 'neutral' },
  { name: 'Librarian', role: 'Knowledge', status: 'active', faction: 'neutral' },
];

export default function CommandCenter() {
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [terminalText, setTerminalText] = useState('> Sovereign Laboratory OS v1.0.0 initialized...');

  return (
    <div className="command-center">
      {/* CRT Overlay */}
      <div className="crt-overlay" />

      {/* Top HUD - Resources */}
      <header className="command-hud">
        <div className="hud-left">
          <div className="hud-logo">
            <Shield className="logo-icon" />
            <span className="logo-text">SL-OS</span>
          </div>
        </div>

        <div className="hud-resources">
          {resources.map((res) => (
            <div key={res.label} className={`resource-item resource-item--${res.color}`}>
              <span className="resource-icon">{res.icon}</span>
              <div className="resource-data">
                <span className="resource-value">{res.value}</span>
                <span className="resource-label">{res.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hud-right">
          <div className="commander-rank">
            <Sparkles className="rank-icon" />
            <span>Kernel Commander</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="command-main">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-frame">
            <h1 className="hero-title">
              <span className="title-line">SOVEREIGN</span>
              <span className="title-line title-line--accent">LABORATORY</span>
            </h1>
            <p className="hero-subtitle">THE CODEX WARS</p>
            <p className="hero-description">
              An RTS Operations Manual for the Antigravity Kernel.
              Build thinking systems that compound. Deploy agent swarms that execute.
            </p>
            <div className="hero-actions">
              <button className="rts-button rts-button--primary rts-button--lg">
                <Sword size={20} />
                Begin Campaign
              </button>
              <button className="rts-button rts-button--lg">
                <BookOpen size={20} />
                Read Codex
              </button>
            </div>
          </div>
        </section>

        {/* Faction Selection */}
        <section className="faction-section">
          <div className="section-header">
            <div className="rts-divider">
              <span className="rts-divider__ornament">⚔</span>
            </div>
            <h2 className="rts-heading rts-heading--md">Choose Your Faction</h2>
          </div>

          <div className="faction-grid">
            {factions.map((faction) => (
              <div
                key={faction.id}
                className={`faction-card faction-card--${faction.color} ${
                  selectedFaction === faction.id ? 'faction-card--selected' : ''
                }`}
                onClick={() => setSelectedFaction(faction.id)}
              >
                <div className="faction-emblem">
                  {faction.id === 'claude' ? (
                    <Cpu size={64} />
                  ) : (
                    <Globe size={64} />
                  )}
                </div>

                <div className="faction-info">
                  <h3 className="faction-name">{faction.name}</h3>
                  <span className="faction-subtitle">{faction.subtitle}</span>
                  <p className="faction-description">{faction.description}</p>

                  <div className="faction-ability">
                    <Zap size={14} />
                    <span>{faction.ability}</span>
                  </div>
                </div>

                <div className="faction-stats">
                  <div className="stat-row">
                    <span className="stat-label">Power</span>
                    <div className="stat-bar">
                      <div
                        className="stat-fill stat-fill--power"
                        style={{ width: `${faction.stats.power}%` }}
                      />
                    </div>
                    <span className="stat-value">{faction.stats.power}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Context</span>
                    <div className="stat-bar">
                      <div
                        className="stat-fill stat-fill--context"
                        style={{ width: `${faction.stats.context}%` }}
                      />
                    </div>
                    <span className="stat-value">{faction.stats.context}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Speed</span>
                    <div className="stat-bar">
                      <div
                        className="stat-fill stat-fill--speed"
                        style={{ width: `${faction.stats.speed}%` }}
                      />
                    </div>
                    <span className="stat-value">{faction.stats.speed}</span>
                  </div>
                </div>

                <div className="faction-units">
                  <span className="units-label">Units:</span>
                  {faction.units.map((unit) => (
                    <span key={unit} className="unit-tag">{unit}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Agent Roster */}
        <section className="roster-section">
          <div className="section-header">
            <div className="rts-divider">
              <span className="rts-divider__ornament">👥</span>
            </div>
            <h2 className="rts-heading rts-heading--md">Agent Swarm</h2>
          </div>

          <div className="roster-panel rts-panel">
            <div className="roster-header">
              <Users size={20} />
              <span>Active Deployments</span>
              <span className="roster-count">{agents.length} Units</span>
            </div>

            <div className="roster-grid">
              {agents.map((agent) => (
                <div key={agent.name} className="agent-card rts-card">
                  <div className="rts-card__image">
                    <div className="agent-avatar">
                      {agent.name.charAt(0)}
                    </div>
                    <span className={`agent-status agent-status--${agent.status}`} />
                  </div>
                  <div className="rts-card__content">
                    <h4 className="rts-card__title">{agent.name}</h4>
                    <span className="rts-card__subtitle">{agent.role}</span>
                    <div className="agent-badges">
                      <span className={`rts-badge rts-badge--${agent.status === 'active' ? 'success' : 'warning'}`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Terminal / Command Input */}
        <section className="terminal-section">
          <div className="section-header">
            <div className="rts-divider">
              <span className="rts-divider__ornament">⌨</span>
            </div>
            <h2 className="rts-heading rts-heading--md">Command Terminal</h2>
          </div>

          <div className="terminal-panel rts-panel crt-effect">
            <div className="terminal-header">
              <Terminal size={16} />
              <span>KERNEL://COMMAND</span>
              <div className="terminal-controls">
                <span className="control control--minimize" />
                <span className="control control--maximize" />
                <span className="control control--close" />
              </div>
            </div>
            <div className="terminal-body">
              <div className="terminal-output">
                <p className="terminal-line">{terminalText}</p>
                <p className="terminal-line terminal-line--success">
                  {'>'} All systems operational. Awaiting orders, Commander.
                </p>
                <p className="terminal-line terminal-line--info">
                  {'>'} Type /help for available commands.
                </p>
              </div>
              <div className="terminal-input-row">
                <span className="terminal-prompt">{'>'}</span>
                <input
                  type="text"
                  className="terminal-input"
                  placeholder="Enter command..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget.value;
                      setTerminalText(`> ${input}`);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <span className="terminal-cursor" />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="actions-section">
          <div className="section-header">
            <div className="rts-divider">
              <span className="rts-divider__ornament">⚡</span>
            </div>
            <h2 className="rts-heading rts-heading--md">Quick Deploy</h2>
          </div>

          <div className="actions-grid">
            <button className="action-tile rts-icon-button">
              <Database size={28} />
              <span className="action-label">Archives</span>
            </button>
            <button className="action-tile rts-icon-button">
              <Cpu size={28} />
              <span className="action-label">Agents</span>
            </button>
            <button className="action-tile rts-icon-button">
              <Globe size={28} />
              <span className="action-label">Web Intel</span>
            </button>
            <button className="action-tile rts-icon-button">
              <Terminal size={28} />
              <span className="action-label">Bash</span>
            </button>
          </div>
        </section>
      </main>

      {/* Bottom Status Bar */}
      <footer className="command-status">
        <div className="status-left">
          <span className="status-indicator status-indicator--online" />
          <span>System Online</span>
        </div>
        <div className="status-center">
          <span className="status-message">
            "Every conversation must compound. We do not restart thinking from zero."
          </span>
        </div>
        <div className="status-right">
          <span>v1.0.0</span>
          <ChevronRight size={14} />
          <span>Antigravity Kernel</span>
        </div>
      </footer>
    </div>
  );
}

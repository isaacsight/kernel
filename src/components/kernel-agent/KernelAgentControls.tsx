import { useState } from 'react';
import { useKernelAgentContext } from './KernelAgentProvider';
import { KERNEL_AGENTS } from '../../agents';
import { SWARM_AGENTS } from '../../agents/swarm';

const ALL_AGENTS = [...KERNEL_AGENTS, ...SWARM_AGENTS];

export function KernelAgentControls() {
  const {
    engineState,
    stopEngine,
    resetEngine,
    overrideAgent,
    setConviction,
    addBelief,
    challengeBelief,
    removeBelief,
    pruneReflections,
  } = useKernelAgentContext();

  const { worldModel, lasting } = engineState;
  const conviction = worldModel.convictions.overall;

  // Local state for inputs
  const [selectedAgentId, setSelectedAgentId] = useState(ALL_AGENTS[0]?.id || '');
  const [newBelief, setNewBelief] = useState('');
  const [newBeliefConf, setNewBeliefConf] = useState(0.7);
  const [pruneThreshold, setPruneThreshold] = useState(0.4);
  const [pruneResult, setPruneResult] = useState<number | null>(null);

  const handleOverride = () => {
    const agent = ALL_AGENTS.find(a => a.id === selectedAgentId);
    if (agent) overrideAgent(agent);
  };

  const handleAddBelief = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBelief.trim()) return;
    addBelief(newBelief.trim(), newBeliefConf);
    setNewBelief('');
  };

  const handlePrune = () => {
    const removed = pruneReflections(pruneThreshold);
    setPruneResult(removed);
    setTimeout(() => setPruneResult(null), 3000);
  };

  // Agent performance ranking
  const perfEntries = Object.entries(lasting.agentPerformance)
    .sort((a, b) => b[1].avgQuality - a[1].avgQuality);

  return (
    <div className="kernel-controls">
      {/* Engine Controls */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">Engine</h3>
        <div className="kernel-ctrl-row">
          <button className="kernel-ctrl-btn kernel-ctrl-btn--stop" onClick={stopEngine}>
            Stop
          </button>
          <button className="kernel-ctrl-btn kernel-ctrl-btn--reset" onClick={resetEngine}>
            Reset
          </button>
        </div>
      </div>

      {/* Agent Override */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">Agent Override</h3>
        <div className="kernel-ctrl-row">
          <select
            className="kernel-ctrl-select"
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
          >
            {ALL_AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button className="kernel-ctrl-btn" onClick={handleOverride}>
            Override Next
          </button>
        </div>
      </div>

      {/* Conviction */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">
          Conviction
          <span className="kernel-ctrl-value">{(conviction * 100).toFixed(1)}%</span>
        </h3>
        <input
          type="range"
          className="kernel-ctrl-slider"
          min={0}
          max={1}
          step={0.01}
          value={conviction}
          onChange={e => setConviction(parseFloat(e.target.value))}
        />
        <div className="kernel-ctrl-row kernel-ctrl-row--fine">
          <button className="kernel-ctrl-btn kernel-ctrl-btn--sm" onClick={() => setConviction(Math.max(0, conviction - 0.05))}>
            -0.05
          </button>
          <button className="kernel-ctrl-btn kernel-ctrl-btn--sm" onClick={() => setConviction(Math.min(1, conviction + 0.05))}>
            +0.05
          </button>
        </div>
      </div>

      {/* Beliefs */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">Beliefs ({worldModel.beliefs.length})</h3>
        {worldModel.beliefs.map(b => (
          <div key={b.id} className="kernel-ctrl-belief">
            <span className="kernel-ctrl-belief-text">{b.content}</span>
            <div className="kernel-ctrl-belief-actions">
              <button
                className="kernel-ctrl-btn kernel-ctrl-btn--xs"
                onClick={() => challengeBelief(b.id)}
                title="Challenge"
              >
                ?
              </button>
              <button
                className="kernel-ctrl-btn kernel-ctrl-btn--xs kernel-ctrl-btn--danger"
                onClick={() => removeBelief(b.id)}
                title="Remove"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
        <form className="kernel-ctrl-add-belief" onSubmit={handleAddBelief}>
          <input
            type="text"
            className="kernel-ctrl-input"
            value={newBelief}
            onChange={e => setNewBelief(e.target.value)}
            placeholder="New belief..."
          />
          <input
            type="number"
            className="kernel-ctrl-input kernel-ctrl-input--sm"
            min={0}
            max={1}
            step={0.1}
            value={newBeliefConf}
            onChange={e => setNewBeliefConf(parseFloat(e.target.value))}
          />
          <button type="submit" className="kernel-ctrl-btn kernel-ctrl-btn--sm" disabled={!newBelief.trim()}>
            Add
          </button>
        </form>
      </div>

      {/* Reflections */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">Reflections ({lasting.reflections.length})</h3>
        <div className="kernel-ctrl-row">
          <span className="kernel-ctrl-label">Prune below quality:</span>
          <input
            type="number"
            className="kernel-ctrl-input kernel-ctrl-input--sm"
            min={0}
            max={1}
            step={0.1}
            value={pruneThreshold}
            onChange={e => setPruneThreshold(parseFloat(e.target.value))}
          />
          <button className="kernel-ctrl-btn kernel-ctrl-btn--sm" onClick={handlePrune}>
            Prune
          </button>
        </div>
        {pruneResult !== null && (
          <p className="kernel-ctrl-result">Removed {pruneResult} reflection{pruneResult !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Agent Performance */}
      <div className="kernel-ctrl-section">
        <h3 className="kernel-ctrl-title">Agent Performance</h3>
        {perfEntries.length === 0 ? (
          <p className="kernel-ctrl-empty">No performance data yet</p>
        ) : (
          <div className="kernel-ctrl-perf">
            {perfEntries.map(([id, perf]) => (
              <div key={id} className="kernel-ctrl-perf-row">
                <span className="kernel-ctrl-perf-name">{id}</span>
                <div className="kernel-ctrl-perf-bar">
                  <div style={{ width: `${perf.avgQuality * 100}%` }} />
                </div>
                <span className="kernel-ctrl-perf-stat">
                  {(perf.avgQuality * 100).toFixed(0)}% / {perf.uses}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

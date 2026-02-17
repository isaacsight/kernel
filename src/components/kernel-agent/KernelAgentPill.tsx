import { motion } from 'framer-motion';
import { useKernelAgentContext } from './KernelAgentProvider';

const PHASE_LABELS: Record<string, string> = {
  idle: 'idle',
  perceiving: 'perceiving',
  attending: 'attending',
  deciding: 'deciding',
  acting: 'acting',
  reflecting: 'reflecting',
};

export function KernelAgentPill() {
  const { engineState, openDrawer, isOpen } = useKernelAgentContext();
  const { phase, worldModel } = engineState;
  const conviction = worldModel.convictions.overall;
  const isActive = phase !== 'idle';

  if (isOpen) return null;

  return (
    <motion.button
      className={`kernel-pill ${isActive ? 'kernel-pill--active' : ''}`}
      onClick={openDrawer}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      title="Open Kernel Agent"
    >
      <span className="kernel-pill-icon">K</span>
      <span className="kernel-pill-phase">{PHASE_LABELS[phase] || phase}</span>
      <span className="kernel-pill-divider" />
      <span className="kernel-pill-conviction-wrap">
        <span className="kernel-pill-conviction-bar">
          <motion.span
            className="kernel-pill-conviction-fill"
            animate={{ width: `${conviction * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </span>
        <span className="kernel-pill-conviction-pct">{(conviction * 100).toFixed(0)}%</span>
      </span>
      {isActive && (
        <motion.span
          className="kernel-pill-pulse"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

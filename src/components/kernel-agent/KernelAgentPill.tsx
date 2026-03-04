import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { SPRING, TRANSITION } from '../../constants/motion';
import { useKernelAgentContext } from './KernelAgentProvider';

export function KernelAgentPill() {
  const { t } = useTranslation('kernel');
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
      transition={SPRING.GENTLE}
      aria-label={t('pill.openKernel')}
    >
      <span className="kernel-pill-icon">K</span>
      <span className="kernel-pill-phase">{t(`pill.phases.${phase}`, { defaultValue: phase })}</span>
      <span className="kernel-pill-divider" />
      <span className="kernel-pill-conviction-wrap">
        <span className="kernel-pill-conviction-bar">
          <motion.span
            className="kernel-pill-conviction-fill"
            animate={{ width: `${conviction * 100}%` }}
            transition={TRANSITION.BAR_FILL}
          />
        </span>
        <span className="kernel-pill-conviction-pct">{(conviction * 100).toFixed(0)}%</span>
      </span>
      {isActive && (
        <motion.span
          className="kernel-pill-pulse"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={TRANSITION.PULSE}
        />
      )}
    </motion.button>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import { useKernelAgentContext } from './KernelAgentProvider';
import { KernelAgentChat } from './KernelAgentChat';
import { KernelAgentObserver } from './KernelAgentObserver';
import { KernelAgentControls } from './KernelAgentControls';
import { KernelAgentGate } from './KernelAgentGate';
import type { KernelTab } from '../../hooks/useKernelAgent';

const TABS: { id: KernelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'observe', label: 'Observe' },
  { id: 'control', label: 'Control' },
];

export function KernelAgentDrawer() {
  const { isOpen, closeDrawer, activeTab, setActiveTab, isSubscribed } = useKernelAgentContext();

  const needsGate = !isSubscribed && (activeTab === 'chat' || activeTab === 'control');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="kernel-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="kernel-drawer-header">
            <span className="kernel-drawer-title">
              <span className="kernel-drawer-icon">K</span>
              Kernel Agent
            </span>
            <button className="kernel-drawer-close" onClick={closeDrawer} aria-label="Close">
              &times;
            </button>
          </div>

          {/* Tabs */}
          <div className="kernel-drawer-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`kernel-drawer-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="kernel-drawer-body custom-scrollbar">
            {needsGate ? (
              <KernelAgentGate />
            ) : activeTab === 'chat' ? (
              <KernelAgentChat />
            ) : activeTab === 'observe' ? (
              <KernelAgentObserver />
            ) : (
              <KernelAgentControls />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

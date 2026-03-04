import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING } from '../../constants/motion';
import { useKernelAgentContext } from './KernelAgentProvider';
import type { KernelTab } from '../../hooks/useKernelAgent';

// Lazy-load drawer tab content — only parsed when drawer opens
const KernelAgentChat = lazy(() => import('./KernelAgentChat').then(m => ({ default: m.KernelAgentChat })));
const KernelAgentObserver = lazy(() => import('./KernelAgentObserver').then(m => ({ default: m.KernelAgentObserver })));
const KernelAgentControls = lazy(() => import('./KernelAgentControls').then(m => ({ default: m.KernelAgentControls })));
const KernelAgentGate = lazy(() => import('./KernelAgentGate').then(m => ({ default: m.KernelAgentGate })));

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
          transition={SPRING.DEFAULT}
        >
          {/* Header */}
          <div className="kernel-drawer-header">
            <span className="kernel-drawer-title">
              <span className="kernel-drawer-icon">K</span>
              kernel.chat
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
            <Suspense fallback={null}>
              {needsGate ? (
                <KernelAgentGate />
              ) : activeTab === 'chat' ? (
                <KernelAgentChat />
              ) : activeTab === 'observe' ? (
                <KernelAgentObserver />
              ) : (
                <KernelAgentControls />
              )}
            </Suspense>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

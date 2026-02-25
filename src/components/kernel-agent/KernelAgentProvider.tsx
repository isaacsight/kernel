import { createContext, useContext } from 'react';
import { useKernelAgent, type KernelAgentState } from '../../hooks/useKernelAgent';
import { KernelAgentDrawer } from './KernelAgentDrawer';

const KernelAgentContext = createContext<KernelAgentState | null>(null);

export function useKernelAgentContext(): KernelAgentState {
  const ctx = useContext(KernelAgentContext);
  if (!ctx) throw new Error('useKernelAgentContext must be inside KernelAgentProvider');
  return ctx;
}

export function KernelAgentProvider({ children }: { children: React.ReactNode }) {
  const state = useKernelAgent();

  return (
    <KernelAgentContext.Provider value={state}>
      {children}
      <KernelAgentDrawer />
    </KernelAgentContext.Provider>
  );
}

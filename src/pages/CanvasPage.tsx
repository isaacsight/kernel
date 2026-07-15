import { Suspense, useState, useEffect } from 'react'
import { MagazineFrame } from '../components/MagazineFrame'
import { CanvasWorkflowBuilder } from '../components/CanvasWorkflowBuilder'
import { useAuthContext } from '../providers/AuthProvider'
import { KernelLoading } from '../components/KernelLoading'
import { lazyRetry } from '../utils/lazyRetry'
import './CanvasPage.css'

const LoginGate = lazyRetry(() => import('../components/LoginGate').then(m => ({ default: m.LoginGate })))

// Dev builds skip the gate: the canvas is a personal local work surface.
const LOCAL_CANVAS = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

export function CanvasPage() {
  const { isLoading, isAuthenticated } = useAuthContext()

  if (LOCAL_CANVAS) {
    return <CanvasClassic />
  }

  if (isLoading) {
    return <KernelLoading showLogo />
  }

  if (!isAuthenticated) {
    return <Suspense fallback={null}><LoginGate /></Suspense>
  }

  return <CanvasClassic />
}

function CanvasClassic() {
  const [simulationMode, setSimulationMode] = useState(true)
  const [status, setStatus] = useState<'Idle' | 'Workflow active'>('Idle')

  // Opt-out of the default body scroll behavior, since the canvas has its own scroll/drag interface.
  useEffect(() => {
    document.body.classList.remove('ka-scrollable-page')
    return () => {
      document.body.classList.add('ka-scrollable-page')
    }
  }, [])

  return (
    <MagazineFrame
      kicker={`★ CANVAS · 設計 [${status.toUpperCase()}]`}
      stock="ledger"
    >
      <CanvasWorkflowBuilder
        onProgress={(msg) => setStatus(msg as any)}
        simulationMode={simulationMode}
        setSimulationMode={setSimulationMode}
      />
    </MagazineFrame>
  )
}
export default CanvasPage

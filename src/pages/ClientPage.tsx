import { ProjectFlow } from '../components/ProjectFlow'

export function ClientPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="text-center py-8 border-b border-[--rubin-ivory-dark]">
        <h1 className="text-4xl mb-2">Sovereign Swarm</h1>
        <p className="opacity-60 italic">Autonomous AI agents that build what you need</p>
      </div>
      <ProjectFlow />
    </div>
  )
}

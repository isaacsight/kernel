import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Users, LayoutDashboard, TrendingUp, BookOpen } from 'lucide-react'
import { useKernel } from '../hooks/useKernel'
import { KERNEL_AGENTS } from '../agents'
import { treasury } from '../engine/Treasury'

const NAV_ITEMS = [
  { to: '/client', icon: Zap, title: 'Get a Quote' },
  { to: '/observer', icon: Users, title: 'Observer Mode' },
  { to: '/dashboard', icon: LayoutDashboard, title: 'Treasury Dashboard' },
  { to: '/trading', icon: TrendingUp, title: 'Trading & AI Income' },
  { to: '/blog', icon: BookOpen, title: 'Blog' },
] as const

export function Layout() {
  const location = useLocation()
  const { swarm, isGenerating } = useKernel()
  const treasuryState = treasury.getState()
  const isObserver = location.pathname === '/observer'

  return (
    <>
      {/* Sidebar - Mode Selector */}
      <aside className="sidebar-servers">
        {NAV_ITEMS.map(({ to, icon: Icon, title }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `server-icon ${isActive ? 'active' : 'opacity-30'}`
            }
            title={title}
          >
            <Icon size={20} />
          </NavLink>
        ))}

        {/* Revenue indicator */}
        <div className="mt-auto mb-4 text-center">
          <div className="mono text-[10px] opacity-40">REVENUE</div>
          <div className="text-sm font-medium text-green-600">
            ${treasuryState.totalRevenue.toFixed(0)}
          </div>
        </div>
      </aside>

      {/* Channel Sidebar - Only show in observer mode */}
      {isObserver && (
        <aside className="sidebar-channels">
          <section>
            <div className="mono opacity-40 mb-4 px-2">Agents Online</div>
            <nav className="space-y-3">
              {KERNEL_AGENTS.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 px-2"
                  style={{ opacity: swarm.currentSpeaker === agent.id ? 1 : 0.5 }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ backgroundColor: agent.color, color: '#FAF9F6' }}
                  >
                    {agent.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-xs opacity-60 font-mono">
                      {swarm.currentSpeaker === agent.id && isGenerating
                        ? 'thinking...'
                        : swarm.currentSpeaker === agent.id
                          ? 'speaking'
                          : 'observing'}
                    </div>
                  </div>
                </div>
              ))}
            </nav>
          </section>

          <div className="mt-auto p-4 border-t border-[--rubin-ivory-dark]">
            <div className="mono text-[10px] opacity-40">Observer</div>
            <div className="font-serif text-sm">Isaac Hernandez</div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`chat-container ${!isObserver ? 'full-width' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--rubin-ivory-dark); }
        .server-icon.active { background: var(--rubin-slate); color: var(--rubin-ivory); }
        .full-width { grid-column: 2 / -1; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>
    </>
  )
}

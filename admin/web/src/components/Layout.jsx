import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    MessageSquare, Network, LayoutGrid, FileText,
    Palette, DollarSign, Briefcase, Settings, Zap
} from 'lucide-react';

const Layout = ({ children }) => {
    const navItems = [
        { id: 'chat', icon: MessageSquare, path: '/', label: 'Conversation' },
        { id: 'galaxy', icon: Network, path: '/galaxy', label: 'Neural Web' },
        { id: 'legacy', icon: LayoutGrid, path: '/legacy-dashboard', label: 'Monitoring' },
        { id: 'content', icon: FileText, path: '/content', label: 'Publishing' },
        { id: 'design', icon: Palette, path: '/design', label: 'Architect' },
        { id: 'revenue', icon: DollarSign, path: '/revenue', label: 'Financials' },
        { id: 'consulting', icon: Briefcase, path: '/consulting', label: 'Clients' },
        { id: 'settings', icon: Settings, path: '/settings', label: 'System' },
    ];

    return (
        <div className="flex h-screen bg-black overflow-hidden font-sans">
            {/* Minimal Side Rail */}
            <aside className="w-[72px] flex flex-col items-center py-6 border-r border-white/5 bg-black z-50">
                <div className="mb-10">
                    <Zap size={22} className="text-primary animate-pulse" />
                </div>

                <nav className="flex-1 flex flex-col gap-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) => `
                                sidebar-rail-item relative group
                                ${isActive ? 'active' : ''}
                            `}
                        >
                            <item.icon size={20} strokeWidth={2} />

                            {/* Pro Tooltip */}
                            <div className="absolute left-full ml-4 px-2 py-1 rounded bg-[#111] border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                                {item.label}
                            </div>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Content Viewport */}
            <main className="flex-1 overflow-hidden relative">
                {children}
            </main>
        </div>
    );
};

export default Layout;

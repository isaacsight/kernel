import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    MessageSquare, Network, LayoutGrid, FileText,
    Palette, DollarSign, Briefcase, Settings, Zap, Menu, X
} from 'lucide-react';

const Layout = ({ children }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            {/* Desktop Side Rail - Hidden on Mobile */}
            <aside className="hidden md:flex w-[72px] flex-col items-center py-6 border-r border-white/5 bg-black z-50">
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

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-lg border-b border-white/5 z-[60] flex items-center justify-between px-6">
                <Zap size={20} className="text-primary" />
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-white/70 hover:text-white transition-colors"
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 bg-black z-[55] flex flex-col pt-24 px-8 gap-6 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-4 py-3 text-lg font-medium
                                ${isActive ? 'text-primary' : 'text-white/60'}
                            `}
                        >
                            <item.icon size={24} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            )}

            {/* Content Viewport */}
            <main className="flex-1 overflow-hidden relative pt-16 md:pt-0">
                {children}
            </main>
        </div>
    );
};

export default Layout;

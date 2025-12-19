import React from 'react';
import { NavLink } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { LayoutDashboard, FileText, Settings, Rocket, Palette, DollarSign } from 'lucide-react';

const Layout = ({ children }) => {
    const { mode, toggleMode } = useMode();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const navItems = [
        { icon: LayoutDashboard, label: 'Mission Control', path: '/' },
        { icon: Rocket, label: 'Galaxy View', path: '/galaxy' }, // Replaced Rocket here for clear distinction or we can keep it
        { icon: FileText, label: 'Content Studio', path: '/content' },
        { icon: Palette, label: 'Design Studio', path: '/design' },
        { icon: DollarSign, label: 'Revenue', path: '/revenue' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    // Liquid UI Classes
    const getContainerClass = () => {
        switch (mode) {
            case 'eco': return 'flex min-h-screen bg-black text-green-500 font-mono';
            case 'spatial': return 'flex min-h-screen bg-[#0f172a] text-white';
            default: return 'flex min-h-screen bg-background text-foreground font-sans';
        }
    };

    const getSidebarClass = () => {
        const base = "w-64 border-r border-border glass-panel flex flex-col z-30 transition-transform duration-500 ease-in-out fixed md:relative h-full ";
        const state = isSidebarOpen ? "translate-x-0 " : "-translate-x-full md:translate-x-0 ";

        switch (mode) {
            case 'eco': return base + state + 'border-green-900 bg-black';
            default: return base + state;
        }
    };

    return (
        <div className={getContainerClass()}>
            {/* Operator Toggle (Hidden unless hovered/touched) */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="fixed bottom-6 left-6 z-50 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl md:hidden group active:scale-95 transition-all"
            >
                <div className={`w-4 h-0.5 bg-[#00D6A3] transition-all ${isSidebarOpen ? 'rotate-45 translate-y-0.5' : '-translate-y-1'}`} />
                <div className={`w-4 h-0.5 bg-[#00D6A3] transition-all ${isSidebarOpen ? '-rotate-45 -translate-y-0.5' : 'translate-y-1'}`} />
            </button>

            {/* Sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <aside className={getSidebarClass()}>
                <div className="p-6 border-b border-white/5">
                    <h1 className="text-xl font-bold flex items-center gap-2 tracking-tighter text-white">
                        <Rocket className={mode === 'eco' ? 'text-green-500' : 'text-primary'} size={20} />
                        <span className="font-mono">STUDIO_OS</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`status-dot ${mode === 'eco' ? 'bg-green-500' : 'online'}`}></span>
                        <p className={`text-xs ${mode === 'eco' ? 'text-green-700' : 'text-muted-foreground'} font-mono`}>
                            SYSTEM ONLINE // {mode.toUpperCase()}
                        </p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''} ${mode === 'eco' && isActive ? '!bg-green-900/30 !text-green-400 border-green-800' : ''}`
                            }
                        >
                            <item.icon size={18} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5 space-y-4">
                    {/* Mode Toggles */}
                    <div className="grid grid-cols-3 gap-1 mb-2">
                        <button onClick={() => toggleMode('standard')} className={`p-1 rounded text-[10px] ${mode === 'standard' ? 'bg-primary/20 text-white' : 'text-gray-500 hover:text-white'}`}>STD</button>
                        <button onClick={() => toggleMode('spatial')} className={`p-1 rounded text-[10px] ${mode === 'spatial' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500 hover:text-purple-300'}`}>SPT</button>
                        <button onClick={() => toggleMode('eco')} className={`p-1 rounded text-[10px] ${mode === 'eco' ? 'bg-green-500/20 text-green-500' : 'text-gray-500 hover:text-green-500'}`}>ECO</button>
                    </div>

                    <button
                        onClick={async () => {
                            if (!confirm('INITIATE DEPLOYMENT SEQUENCE?')) return;
                            try {
                                const apiBase = `http://${window.location.hostname}:8000`;
                                const res = await fetch(`${apiBase}/system/git/publish`, { method: 'POST' });
                                const data = await res.json();
                                alert(data.message);
                            } catch (err) {
                                alert('DEPLOYMENT ERROR: ' + err.message);
                            }
                        }}
                        className={`w-full py-2.5 px-4 ${mode === 'eco' ? 'bg-green-900/20 text-green-500 border-green-800 hover:bg-green-900/40' : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50'} rounded-lg text-xs font-mono font-bold transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wide`}
                    >
                        <Rocket size={14} />
                        Deploy Site
                    </button>
                    <div className="text-[10px] text-muted-foreground text-center font-mono opacity-50">
                        v2.4.0 • SYSTEM_READY
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-hidden relative">
                <div className="h-full relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;

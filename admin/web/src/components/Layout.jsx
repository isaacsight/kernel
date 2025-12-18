import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, Rocket, Palette, DollarSign } from 'lucide-react';

const Layout = ({ children }) => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Mission Control', path: '/' },
        { icon: FileText, label: 'Content Studio', path: '/content' },
        { icon: Palette, label: 'Design Studio', path: '/design' },
        { icon: DollarSign, label: 'Revenue', path: '/revenue' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border glass-panel flex flex-col z-20">
                <div className="p-6 border-b border-white/5">
                    <h1 className="text-xl font-bold flex items-center gap-2 tracking-tighter text-white">
                        <Rocket className="text-primary" size={20} />
                        <span className="font-mono">STUDIO_OS</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="status-dot online"></span>
                        <p className="text-xs text-muted-foreground font-mono">SYSTEM ONLINE</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon size={18} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5 space-y-4">
                    <button
                        onClick={async () => {
                            if (!confirm('INITIATE DEPLOYMENT SEQUENCE?')) return;
                            try {
                                const res = await fetch('http://localhost:8000/system/git/publish', { method: 'POST' });
                                const data = await res.json();
                                alert(data.message);
                            } catch (err) {
                                alert('DEPLOYMENT ERROR: ' + err.message);
                            }
                        }}
                        className="w-full py-2.5 px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 rounded-lg text-xs font-mono font-bold transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wide"
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
            <main className="flex-1 overflow-y-auto relative">
                {/* Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
                    style={{
                        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                />

                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;

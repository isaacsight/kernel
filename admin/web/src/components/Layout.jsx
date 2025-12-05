import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, Rocket, Palette } from 'lucide-react';

const Layout = ({ children }) => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Mission Control', path: '/' },
        { icon: FileText, label: 'Content Studio', path: '/content' },
        { icon: Palette, label: 'Design Studio', path: '/design' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-md flex flex-col">
                <div className="p-6 border-b border-border">
                    <h1 className="text-xl font-bold flex items-center gap-2 tracking-tighter">
                        <Rocket className="text-accent" size={20} />
                        Studio OS
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Mission Control</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-accent/10 text-accent border border-accent/20 shadow-sm'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                                }`
                            }
                        >
                            <item.icon size={18} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-border space-y-4">
                    <button
                        onClick={async () => {
                            if (!confirm('Are you sure you want to publish changes to the live site?')) return;
                            try {
                                const res = await fetch('http://localhost:8000/system/git/publish', { method: 'POST' });
                                const data = await res.json();
                                alert(data.message);
                            } catch (err) {
                                alert('Publish failed: ' + err.message);
                            }
                        }}
                        className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Rocket size={16} />
                        Publish Site
                    </button>
                    <div className="text-xs text-muted-foreground text-center font-mono">
                        v2.0.0 • Antigravity
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;

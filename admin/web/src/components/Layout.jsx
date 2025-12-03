import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, Rocket } from 'lucide-react';

const Layout = ({ children }) => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Mission Control', path: '/' },
        { icon: FileText, label: 'Content Studio', path: '/content' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-md flex flex-col">
                <div className="p-6 border-b border-border">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Rocket className="text-primary" />
                        Studio OS
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`
                            }
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
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
                        className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Rocket size={16} />
                        Publish Site
                    </button>
                    <div className="text-xs text-muted-foreground text-center">
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

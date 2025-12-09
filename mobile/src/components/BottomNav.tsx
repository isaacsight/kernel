
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Settings, Sparkles } from 'lucide-react';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { name: 'Home', icon: Home, path: '/' },
        { name: 'Studio', icon: Sparkles, path: '/studio' },
        { name: 'Scripts', icon: FileText, path: '/scripts' },
        { name: 'Settings', icon: Settings, path: '/settings' },
    ];

    return (
        <div className="glass-panel fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center h-[var(--nav-height)] px-2">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <button
                            key={tab.name}
                            onClick={() => navigate(tab.path)}
                            className={`flex flex-col items-center justify-center w-full h-full bg-transparent border-none ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                                }`}
                        >
                            <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] mt-1 font-medium">{tab.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNav;


import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Settings, Sparkles } from 'lucide-react';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { name: 'Home', icon: Home, path: '/' },
        { name: 'Studio', icon: Sparkles, path: '/studio' },
        { name: 'Scripts', icon: FileText, path: '/scripts' },
        { name: 'Identity', icon: Settings, path: '/settings' },
    ];

    return (
        <div className="glass-panel fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] border-t border-white/[0.05] rounded-t-[32px]">
            <div className="flex justify-around items-center h-[var(--nav-height)] px-6">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <button
                            key={tab.name}
                            onClick={() => navigate(tab.path)}
                            className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-white' : 'text-white/20'}`}
                        >
                            <tab.icon
                                size={22}
                                strokeWidth={isActive ? 2 : 1.5}
                                className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}
                            />
                            <span className={`text-[9px] mt-1.5 font-bold uppercase tracking-widest transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                                {tab.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};


export default BottomNav;

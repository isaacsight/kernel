
import BottomNav from './BottomNav';

interface MobileLayoutProps {
    children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
    return (
        <div className="flex flex-col h-screen w-full bg-[var(--bg-gradient)] text-[var(--text-main)]">
            {/* Status Bar Spacer */}
            <div className="h-[env(safe-area-inset-top)] w-full bg-transparent shrink-0" />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[calc(var(--nav-height)+20px)]">
                {children}
            </main>

            {/* Bottom Navigation */}
            <BottomNav />
        </div>
    );
};

export default MobileLayout;

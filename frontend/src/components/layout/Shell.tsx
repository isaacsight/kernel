import React, { type ReactNode } from 'react';
import { Content } from '@carbon/react';
import CouncilRail from '../hud/CouncilRail';

type ViewMode = 'bento' | 'cathedral';

interface ShellProps {
    children: ReactNode;
    mode?: ViewMode;
    showRail?: boolean;
}

const Shell: React.FC<ShellProps> = ({
    children,
    mode = 'bento',
    showRail = true
}) => {
    // Mode-specific class mapping
    const modeClass = mode === 'cathedral' ? 'mode-cathedral' : 'mode-bento';

    // Layout constraints based on mode
    const containerClass = mode === 'cathedral'
        ? "max-w-[65ch] mx-auto px-6 py-12 min-h-screen transition-all duration-300 ease-in-out"
        : "w-full h-full transition-all duration-300 ease-in-out";

    return (
        <div className={`min-h-screen w-full transition-colors duration-500 ${modeClass}`}>
            {showRail && <CouncilRail orientation="vertical" />}

            <Content className={containerClass}>
                {children}
            </Content>

            {/* Ambient Background Elements could go here */}
            <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20 bg-noise" />
        </div>
    );
};

export default Shell;

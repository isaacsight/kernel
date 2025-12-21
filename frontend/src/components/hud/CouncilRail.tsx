import React, { useState, useEffect } from 'react';

type AgentStatus = 'idle' | 'thinking' | 'action';

interface CouncilRailProps {
    orientation?: 'vertical' | 'horizontal';
}

const CouncilRail: React.FC<CouncilRailProps> = ({ orientation = 'vertical' }) => {
    // Mock state for now - this would eventually connect to a real agent swarm hook
    const [status, setStatus] = useState<AgentStatus>('idle');
    const [activeAgent, setActiveAgent] = useState<string>('System');

    useEffect(() => {
        // Simulate random agent activity
        const interval = setInterval(() => {
            const states: AgentStatus[] = ['idle', 'thinking', 'action'];
            const agents = ['Architect', 'Sage', 'Emperor', 'System'];

            setStatus(states[Math.floor(Math.random() * states.length)]);
            if (Math.random() > 0.7) {
                setActiveAgent(agents[Math.floor(Math.random() * agents.length)]);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (s: AgentStatus) => {
        switch (s) {
            case 'action': return 'bg-green-500 shadow-green-500/50';
            case 'thinking': return 'bg-blue-500 shadow-blue-500/50';
            default: return 'bg-zinc-700';
        }
    };

    const getAnimationClass = (s: AgentStatus) => {
        switch (s) {
            case 'thinking': return 'animate-pulse';
            case 'idle': return 'opacity-50'; // Using opacity instead of custom breathe for now to ensure tailwind compatibility
            default: return '';
        }
    };

    const railStyles = orientation === 'vertical'
        ? "fixed left-0 top-0 h-full w-1 flex flex-col justify-center items-center gap-2 z-50 pointer-events-none"
        : "fixed top-0 left-0 w-full h-1 flex justify-center items-center gap-2 z-50 pointer-events-none";

    const indicatorBase = "rounded-full transition-all duration-1000";
    const indicatorSize = orientation === 'vertical' ? "w-1 h-12" : "h-1 w-12";

    return (
        <div className={railStyles}>
            <div
                className={`
                    ${indicatorBase} 
                    ${indicatorSize} 
                    ${getStatusColor(status)} 
                    ${getAnimationClass(status)}
                    shadow-lg
                `}
                title={`Council Status: ${activeAgent} is ${status}`}
            />
        </div>
    );
};

export default CouncilRail;

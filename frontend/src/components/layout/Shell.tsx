import React, { type ReactNode } from 'react';
import './Shell.css';
import ProseContainer from './ProseContainer';

interface ShellProps {
    children: ReactNode;
    variant?: 'full' | 'prose' | 'article';
}

const Shell: React.FC<ShellProps> = ({
    children,
    variant = 'full'
}) => {

    const renderContent = () => {
        if (variant === 'prose' || variant === 'article') {
            return <ProseContainer>{children}</ProseContainer>;
        }
        return children;
    };

    return (
        <div className={`shell-container variant-${variant}`}>
            {renderContent()}
        </div>
    );
};

export default Shell;

import type { ReactNode } from 'react';
import './ProseContainer.css';

interface ProseContainerProps {
    children: ReactNode;
    className?: string;
}

export default function ProseContainer({ children, className = '' }: ProseContainerProps) {
    return (
        <div className={`prose-container ${className}`}>
            {children}
        </div>
    );
}

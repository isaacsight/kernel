import { type ReactNode } from 'react';
import './Shell.css';

interface ShellProps {
    children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
    return (
        <div className="shell">
            <main>
                {children}
            </main>
        </div>
    );
}

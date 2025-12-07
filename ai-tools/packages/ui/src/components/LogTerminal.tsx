
import React from 'react';

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
}

export interface LogTerminalProps {
    logs: LogEntry[];
    height?: string;
    className?: string;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({
    logs,
    height = 'h-64',
    className = ''
}) => {
    const levelColors = {
        info: 'text-blue-400',
        warn: 'text-yellow-400',
        error: 'text-red-400',
        debug: 'text-zinc-500'
    };

    return (
        <div className={`bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs overflow-y-auto ${height} ${className}`}>
            <div className="space-y-1">
                {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 hover:bg-zinc-900/50 -mx-2 px-2 py-0.5 rounded">
                        <span className="text-zinc-600 shrink-0 select-none">{log.timestamp}</span>
                        <span className={`uppercase w-12 shrink-0 ${levelColors[log.level]}`}>{log.level}</span>
                        <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                ))}
                {logs.length === 0 && <div className="text-zinc-600 italic">System initialized. Waiting for events...</div>}
            </div>
        </div>
    );
};

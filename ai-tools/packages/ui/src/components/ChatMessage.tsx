
import React from 'react';

export interface ChatMessageProps {
    role: 'user' | 'assistant' | 'system';
    content: string;
    className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, className = '' }) => {
    const isUser = role === 'user';
    const isSystem = role === 'system';

    return (
        <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} ${className}`}>
            <div
                className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : isSystem
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono text-xs w-full text-center'
                            : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm shadow-sm'
                    }
        `}
            >
                {role !== 'user' && !isSystem && (
                    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">
                        {role}
                    </div>
                )}
                {content}
            </div>
        </div>
    );
};

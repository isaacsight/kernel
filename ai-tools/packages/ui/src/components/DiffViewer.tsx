
import React from 'react';

// Simple Diff implementation since we might not want to add heavier deps like 'diff' package to UI lib yet
// For production we'd use 'diff' package. Here is a simple string diff visualizer.

interface DiffViewerProps {
    oldText: string;
    newText: string;
    className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText, className = '' }) => {
    // Naive word diff for demo purposes
    const oldWords = oldText.split(' ');
    const newWords = newText.split(' ');

    // This is a placeholder for a real Myers diff algorithm
    // In a real "Research Grade" app we'd import 'diff'
    // For now, let's visualize simple length/content divergence

    return (
        <div className={`font-mono text-sm p-4 bg-zinc-50 dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto ${className}`}>
            <div className="flex gap-4 mb-2 text-xs font-bold uppercase text-zinc-400">
                <span className="w-1/2 text-red-600">Original</span>
                <span className="w-1/2 text-green-600">New / Generated</span>
            </div>
            <div className="flex gap-4">
                <div className="w-1/2 bg-red-50 dark:bg-red-900/10 p-2 rounded text-red-900 dark:text-red-100 whitespace-pre-wrap">
                    {oldText}
                </div>
                <div className="w-1/2 bg-green-50 dark:bg-green-900/10 p-2 rounded text-green-900 dark:text-green-100 whitespace-pre-wrap">
                    {newText}
                </div>
            </div>
        </div>
    );
};

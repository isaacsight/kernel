import React, { useState, useEffect } from 'react';
import './Publisher.css';

// Simple types for props
interface PublisherProps {
    className?: string;
}

interface BuildResponse {
    message: string;
    detail?: string;
}

interface PublishResponse {
    message: string;
    detail?: string;
}

const Publisher: React.FC<PublisherProps> = ({ className }) => {
    const [status, setStatus] = useState<'idle' | 'building' | 'publishing' | 'optimizing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');
    const [logs, setLogs] = useState<string[]>([]);
    const [lastPublish, setLastPublish] = useState<string | null>(null);

    // Initial check (mocked for now, real implementation would fetch from API)
    useEffect(() => {
        // Could fetch latest git log here
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleBuild = async () => {
        setStatus('building');
        setMessage('Constructing static site...');
        addLog('Starting build process...');

        try {
            const response = await fetch('http://localhost:8000/system/site/build', {
                method: 'POST',
            });
            const data: BuildResponse = await response.json();

            if (!response.ok) throw new Error(data.detail || 'Build failed');

            addLog('Build completed successfully.');
            addLog(data.message);
            setStatus('idle');
            setMessage('Ready to publish.');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setStatus('error');
            setMessage(`Build Error: ${errorMessage}`);
            addLog(`Error: ${errorMessage}`);
        }
    };

    const handlePublish = async () => {
        setStatus('publishing');
        setMessage('Pushing to repository...');
        addLog('Initiating git publish...');

        try {
            const response = await fetch('http://localhost:8000/system/site/publish', {
                method: 'POST',
            });
            const data: PublishResponse = await response.json();

            if (!response.ok) throw new Error(data.detail || 'Publish failed');

            addLog('Publish successful.');
            addLog(data.message);
            setStatus('success');
            setMessage('Site is live.');
            setLastPublish(new Date().toLocaleString());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setStatus('error');
            setMessage(`Publish Error: ${errorMessage}`);
            addLog(`Error: ${errorMessage}`);
        }
    };

    return (
        <div className={`publisher-panel ${className || ''}`}>
            <div className="publisher-header">
                <h2 className="publisher-title">Site Engine</h2>
                <div className="publisher-status">
                    Status: <span className={
                        status === 'error' ? 'status-error' :
                            status === 'success' ? 'status-success' :
                                status !== 'idle' ? 'status-active' : ''
                    }>{status.toUpperCase()}</span>
                </div>
            </div>

            <div className="publisher-controls">
                <button
                    onClick={handleBuild}
                    disabled={status === 'building' || status === 'publishing'}
                    className={`publisher-btn ${status === 'building' ? 'active' : ''}`}
                >
                    {status === 'building' ? 'Building...' : 'Build Site'}
                </button>

                <button
                    onClick={handlePublish}
                    disabled={status === 'building' || status === 'publishing'}
                    className={`publisher-btn ${status === 'publishing' ? 'active' : ''}`}
                >
                    {status === 'publishing' ? 'Publishing...' : 'Publish to Live'}
                </button>
            </div>

            {message && (
                <div className={`publisher-message ${status === 'error' ? 'error' : ''}`}>
                    {message}
                </div>
            )}

            <div className="terminal-logs">
                {logs.length === 0 && <span style={{ opacity: 0.5 }}>System ready. Waiting for command...</span>}
                {logs.map((log, i) => (
                    <div key={i} className="log-entry">{log}</div>
                ))}
            </div>

            {lastPublish && (
                <div className="last-publish">
                    Last successful publish: {lastPublish}
                </div>
            )}
        </div>
    );
};

export default Publisher;

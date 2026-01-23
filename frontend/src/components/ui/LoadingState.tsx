import './LoadingState.css';

interface LoadingStateProps {
    variant?: 'page' | 'inline' | 'skeleton';
    message?: string;
}

export function LoadingState({ variant = 'page', message }: LoadingStateProps) {
    if (variant === 'skeleton') {
        return (
            <div className="skeleton-container">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text short" />
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <span className="loading-inline">
                <span className="loading-dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            </span>
        );
    }

    return (
        <div className="loading-page">
            <div className="loading-content">
                <div className="loading-spinner" />
                {message && <p className="loading-message">{message}</p>}
            </div>
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="page-skeleton">
            <div className="skeleton-header">
                <div className="skeleton skeleton-tag" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-subtitle" />
            </div>
            <div className="skeleton-grid">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-card">
                        <div className="skeleton skeleton-card-title" />
                        <div className="skeleton skeleton-text" />
                        <div className="skeleton skeleton-text short" />
                    </div>
                ))}
            </div>
        </div>
    );
}

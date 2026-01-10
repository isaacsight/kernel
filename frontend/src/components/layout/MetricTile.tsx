import React, { type ReactNode } from 'react';
import './MetricTile.css';

interface MetricTileProps {
    label: string;
    value: string;
    subValue?: string;
    progress?: number;
    icon?: ReactNode;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
}

const MetricTile: React.FC<MetricTileProps> = ({
    label,
    value,
    subValue,
    progress,
    icon,
    trend,
    trendDirection
}) => {
    return (
        <div className="metric-tile">
            <div className="metric-header">
                <div className="metric-icon">
                    {icon}
                </div>
                {trend && (
                    <div className={`metric-trend trend-${trendDirection}`}>
                        {trend}
                    </div>
                )}
            </div>

            <div className="metric-content">
                <div className="metric-label">{label}</div>
                <div className="metric-value">{value}</div>
            </div>

            {subValue && (
                <div className="metric-subvalue">
                    {subValue}
                </div>
            )}

            {progress !== undefined && (
                <div className="metric-progress-container">
                    <div
                        className="metric-progress-bar"
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default MetricTile;

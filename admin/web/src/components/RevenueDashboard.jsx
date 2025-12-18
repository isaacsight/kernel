import React, { useState, useEffect } from 'react';

/**
 * Revenue Dashboard - Monetization Metrics View
 * 
 * Displays Studio OS revenue metrics and offerings.
 */

const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    header: {
        marginBottom: '2rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#10b981',
        marginBottom: '0.5rem',
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: '1rem',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
    },
    metricCard: {
        background: 'rgba(17, 24, 39, 0.8)',
        border: '1px solid rgba(75, 85, 99, 0.4)',
        borderRadius: '12px',
        padding: '1.5rem',
        textAlign: 'center',
    },
    metricValue: {
        fontSize: '2.5rem',
        fontWeight: '700',
        color: '#10b981',
    },
    metricLabel: {
        color: '#9ca3af',
        fontSize: '0.875rem',
        marginTop: '0.5rem',
    },
    section: {
        background: 'rgba(17, 24, 39, 0.6)',
        border: '1px solid rgba(75, 85, 99, 0.3)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
    },
    sectionTitle: {
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#f3f4f6',
        marginBottom: '1rem',
    },
    offeringRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderBottom: '1px solid rgba(75, 85, 99, 0.2)',
    },
    offeringName: {
        color: '#e5e7eb',
    },
    offeringPrice: {
        color: '#10b981',
        fontWeight: '600',
    },
    loading: {
        textAlign: 'center',
        color: '#9ca3af',
        padding: '3rem',
    },
    error: {
        textAlign: 'center',
        color: '#ef4444',
        padding: '2rem',
    },
    badge: {
        display: 'inline-block',
        background: 'rgba(16, 185, 129, 0.2)',
        color: '#10b981',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        marginLeft: '0.5rem',
    },
};

function RevenueDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRevenueData();
    }, []);

    const fetchRevenueData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/studio/revenue');
            if (!response.ok) throw new Error('Failed to fetch revenue data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>Loading revenue metrics...</div>;
    }

    if (error) {
        return <div style={styles.error}>Error: {error}</div>;
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>💰 Revenue Dashboard</h1>
                <p style={styles.subtitle}>Monetization metrics from your Studio OS</p>
            </div>

            {/* Metrics Grid */}
            <div style={styles.grid}>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>{data?.total_assessed_artifacts || 0}</div>
                    <div style={styles.metricLabel}>Artifacts Assessed</div>
                </div>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>{data?.average_score?.toFixed(1) || '0.0'}</div>
                    <div style={styles.metricLabel}>Avg. Score (0-10)</div>
                </div>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>{data?.total_offerings || 0}</div>
                    <div style={styles.metricLabel}>Offerings Generated</div>
                </div>
                <div style={styles.metricCard}>
                    <div style={{ ...styles.metricValue, color: '#f59e0b' }}>
                        ${data?.total_revenue_usd?.toFixed(2) || '0.00'}
                    </div>
                    <div style={styles.metricLabel}>Total Revenue</div>
                </div>
            </div>

            {/* Status Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    Monetization Potential
                    <span style={styles.badge}>{data?.total_monetization_potential?.toFixed(0) || 0} pts</span>
                </h2>
                <p style={{ color: '#9ca3af' }}>
                    Based on {data?.total_signals || 0} revenue signals tracked.
                </p>
            </div>

            {/* Actions Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Quick Actions</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => window.open('/admin/brain/REVENUE_STRATEGY.md', '_blank')}
                        style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500',
                        }}
                    >
                        📄 View Strategy Report
                    </button>
                    <button
                        onClick={fetchRevenueData}
                        style={{
                            background: 'transparent',
                            color: '#10b981',
                            border: '1px solid #10b981',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500',
                        }}
                    >
                        🔄 Refresh Data
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RevenueDashboard;

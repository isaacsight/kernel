
import React, { useState, useEffect } from 'react';

const FinanceDashboard = () => {
    const [financeData, setFinanceData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchFinanceData();
    }, []);

    const fetchFinanceData = async () => {
        try {
            const response = await fetch('/api/studio/finance');
            if (!response.ok) throw new Error('Failed to fetch finance data');
            const data = await response.json();
            setFinanceData(data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-cyan-500 animate-pulse">Consulting the Treasurer...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    const { current_balance, burn_rate_30d, health_status } = financeData;

    // Calculate runway
    const runway = burn_rate_30d > 0 ? (current_balance / burn_rate_30d).toFixed(1) : "Infinite";

    return (
        <div className="h-full overflow-y-auto bg-slate-900 text-white p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-cyan-500 bg-clip-text text-transparent">
                    Finance Dashboard
                </h1>
                <p className="text-slate-400 mt-2">Overseen by the Treasurer</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Balance */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Current Balance</h3>
                    <div className="text-4xl font-mono mt-2 text-white">
                        ${current_balance.toLocaleString()}
                    </div>
                </div>

                {/* Burn Rate */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">30-Day Burn Rate</h3>
                    <div className="text-4xl font-mono mt-2 text-red-400">
                        ${burn_rate_30d.toLocaleString()}
                    </div>
                </div>

                {/* Runway */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-2 h-full ${health_status.includes('Warning') ? 'bg-red-500' : 'bg-green-500'}`} />
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Estimated Runway</h3>
                    <div className="text-4xl font-mono mt-2 text-white">
                        {runway} <span className="text-xl text-slate-500">months</span>
                    </div>
                    <div className="mt-2 text-sm text-cyan-400">
                        Status: {health_status}
                    </div>
                </div>
            </div>

            {/* Placeholder for Revenue / Charts */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center text-slate-500 py-12">
                <p>Detailed transaction history and revenue charts coming in v2.</p>
            </div>
        </div>
    );
};

export default FinanceDashboard;


import { Activity, Star, Users } from 'lucide-react';

const Home: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-purple-500 bg-clip-text text-transparent">
                        Studio OS
                    </h1>
                    <p className="text-sm text-[var(--text-muted)]">Mobile Dashboard</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                    IA
                </div>
            </header>

            {/* Quick Stats Carousel */}
            <section className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide flex gap-3">
                {[
                    { label: 'Active Agents', value: '12', icon: Users, color: 'text-blue-400' },
                    { label: 'System Load', value: '45%', icon: Activity, color: 'text-green-400' },
                    { label: 'Reputation', value: '98', icon: Star, color: 'text-yellow-400' },
                ].map((stat, i) => (
                    <div key={i} className="glass-panel p-4 rounded-xl min-w-[140px] flex flex-col gap-2">
                        <stat.icon className={`${stat.color}`} size={20} />
                        <span className="text-2xl font-bold">{stat.value}</span>
                        <span className="text-xs text-[var(--text-muted)]">{stat.label}</span>
                    </div>
                ))}
            </section>

            {/* Recent Activity */}
            <section>
                <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
                <div className="glass-panel rounded-xl p-1">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="flex items-center gap-3 p-3 border-b border-[var(--glass-border)] last:border-0">
                            <div className="w-10 h-10 rounded-lg bg-[var(--surface-high)] flex items-center justify-center">
                                <span className="text-lg">🎨</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium">New Design Generated</h3>
                                <p className="text-xs text-[var(--text-muted)]">2 minutes ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Home;

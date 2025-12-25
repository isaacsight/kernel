import { useEffect, useRef, useState } from 'react';

interface Node {
    id: number;
    x: number;
    y: number;
    role: 'leader' | 'follower' | 'candidate';
    term: number;
    logs: number;
    cpu: number;
    latency: number;
    isHovered?: boolean;
}

interface Packet {
    id: number;
    x: number;
    y: number;
    targetId: number;
    sourceId: number;
    type: 'heartbeat' | 'appendEntries' | 'voteRequest';
    progress: number;
}

export default function TitanViz() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Simulation State
        const nodes: Node[] = [];
        let packets: Packet[] = [];
        const nodeCount = 5;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.3;

        // init nodes
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2;
            nodes.push({
                id: i,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                role: i === 0 ? 'leader' : 'follower',
                term: 1,
                logs: Math.floor(Math.random() * 1000),
                cpu: 5 + Math.random() * 15,
                latency: 2 + Math.random() * 10
            });
        }

        let animationFrameId: number;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            setMousePos({ x: e.clientX, y: e.clientY });

            let found = null;
            nodes.forEach(node => {
                const dx = node.x - x;
                const dy = node.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 30) {
                    node.isHovered = true;
                    found = { ...node };
                } else {
                    node.isHovered = false;
                }
            });
            setHoveredNode(found);
        };

        canvas.addEventListener('mousemove', handleMouseMove);

        const render = () => {
            // Background
            ctx.fillStyle = '#050507';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Connections (Radial connections from Leader)
            const leader = nodes.find(n => n.role === 'leader');
            if (leader) {
                nodes.forEach(node => {
                    if (node.id === leader.id) return;

                    const gradient = ctx.createLinearGradient(leader.x, leader.y, node.x, node.y);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

                    ctx.beginPath();
                    ctx.moveTo(leader.x, leader.y);
                    ctx.lineTo(node.x, node.y);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });
            }

            // Update & Draw Packets
            packets.forEach((p, idx) => {
                const target = nodes[p.targetId];
                const source = nodes[p.sourceId];

                p.progress += 0.015; // Speed

                if (p.progress >= 1) {
                    packets.splice(idx, 1);
                    return;
                }

                p.x = source.x + (target.x - source.x) * p.progress;
                p.y = source.y + (target.y - source.y) * p.progress;

                // Draw trail
                ctx.beginPath();
                const trailLength = 0.1;
                const trailX = source.x + (target.x - source.x) * Math.max(0, p.progress - trailLength);
                const trailY = source.y + (target.y - source.y) * Math.max(0, p.progress - trailLength);

                const trailGrad = ctx.createLinearGradient(trailX, trailY, p.x, p.y);
                trailGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
                trailGrad.addColorStop(1, 'rgba(59, 130, 246, 0.6)');

                ctx.moveTo(trailX, trailY);
                ctx.lineTo(p.x, p.y);
                ctx.strokeStyle = trailGrad;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw core
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#60a5fa';
                ctx.fill();
            });

            // Draw Nodes
            nodes.forEach(node => {
                const isActive = node.isHovered || (hoveredNode && hoveredNode.id === node.id);

                // Outer Glow
                if (isActive) {
                    const glow = ctx.createRadialGradient(node.x, node.y, 20, node.x, node.y, 50);
                    glow.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                    glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
                    ctx.fillStyle = glow;
                    ctx.fillRect(node.x - 50, node.y - 50, 100, 100);
                }

                // Main Circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();

                // Ring based on role
                ctx.lineWidth = isActive ? 3 : 1;
                if (node.role === 'leader') {
                    ctx.strokeStyle = '#3b82f6';
                    // Leader Pulse
                    const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
                    ctx.shadowBlur = pulse * 15;
                    ctx.shadowColor = '#3b82f6';
                } else {
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                    ctx.shadowBlur = 0;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Index Label
                ctx.fillStyle = isActive ? '#fff' : '#94a3b8';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`S${node.id}`, node.x, node.y);

                // Status indicators
                if (node.role === 'leader') {
                    ctx.fillStyle = '#3b82f6';
                    ctx.beginPath();
                    ctx.arc(node.x + 15, node.y - 15, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Heartbeat Logic
            if (Math.random() < 0.03) {
                const leaderNode = nodes.find(n => n.role === 'leader');
                if (leaderNode) {
                    nodes.filter(n => n.id !== leaderNode.id).forEach(target => {
                        packets.push({
                            id: Math.random(),
                            x: leaderNode.x,
                            y: leaderNode.y,
                            sourceId: leaderNode.id,
                            targetId: target.id,
                            type: 'heartbeat',
                            progress: 0
                        });
                    });
                }
            }

            // Update stats randomly
            nodes.forEach(n => {
                n.cpu += (Math.random() - 0.5) * 0.5;
                n.cpu = Math.max(5, Math.min(45, n.cpu));
                n.logs += Math.random() > 0.9 ? 1 : 0;
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            canvas.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="relative w-full h-full group">
            <canvas
                ref={canvasRef}
                width={1200}
                height={800}
                className="w-full h-full cursor-crosshair"
            />

            {/* High-Fidelity Tooltip */}
            {hoveredNode && (
                <div
                    className="fixed z-[100] pointer-events-none glass-panel p-4 rounded-2xl border-blue-500/30 bg-slate-900/90 shadow-2xl backdrop-blur-xl"
                    style={{
                        left: mousePos.x + 20,
                        top: mousePos.y + 20,
                        width: '200px'
                    }}
                >
                    <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                        <span className="text-xs font-black text-slate-100 uppercase tracking-widest">Shard Node S{hoveredNode.id}</span>
                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${hoveredNode.role === 'leader' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            {hoveredNode.role}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <StatRow label="CPU Load" value={`${hoveredNode.cpu.toFixed(1)}%`} progress={hoveredNode.cpu} color="bg-blue-500" />
                        <StatRow label="Latency" value={`${hoveredNode.latency.toFixed(1)}ms`} progress={hoveredNode.latency * 10} color="bg-secondary" />
                        <StatRow label="Log Index" value={hoveredNode.logs.toString()} progress={100} color="bg-slate-700" />
                    </div>
                    <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-500 uppercase">Status</span>
                        <span className="text-[8px] font-black text-emerald-400 uppercase">Nominal</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatRow({ label, value, progress, color }: { label: string, value: string, progress: number, color: string }) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-300 font-mono tracking-normal">{value}</span>
            </div>
            <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                ></div>
            </div>
        </div>
    );
}

import { useEffect, useRef } from 'react';

interface Node {
    id: number;
    x: number;
    y: number;
    role: 'leader' | 'follower' | 'candidate';
    term: number;
    logs: number;
}

interface Packet {
    id: number;
    x: number;
    y: number;
    targetId: number;
    type: 'heartbeat' | 'appendEntries' | 'voteRequest';
}

export default function TitanViz() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Simulation State
        const nodes: Node[] = [];
        let packets: Packet[] = [];
        const nodeCount = 5;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 150;

        // init nodes
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2;
            nodes.push({
                id: i,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                role: i === 0 ? 'leader' : 'follower',
                term: 1,
                logs: 0
            });
        }

        let animationFrameId: number;

        const render = () => {
            // Clear
            ctx.fillStyle = '#0a0a0b'; // bg-dark
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Connections (Mesh)
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }

            // Update & Draw Packets
            packets.forEach((p, idx) => {
                const target = nodes[p.targetId];
                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 5) {
                    packets.splice(idx, 1);
                    return;
                }

                const speed = 4;
                p.x += (dx / dist) * speed;
                p.y += (dy / dist) * speed;

                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.type === 'heartbeat' ? '#3b82f6' : '#ec4899';
                ctx.fill();
            });

            // Draw Nodes
            nodes.forEach(node => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
                ctx.fillStyle = '#18181b'; // bg-card
                ctx.fill();

                // Ring based on role
                ctx.lineWidth = 3;
                if (node.role === 'leader') ctx.strokeStyle = '#eab308'; // Gold
                else if (node.role === 'candidate') ctx.strokeStyle = '#a855f7'; // Purple
                else ctx.strokeStyle = '#3b82f6'; // Blue
                ctx.stroke();

                // Label
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`S${node.id}`, node.x, node.y);

                // Role Label
                ctx.fillStyle = '#a1a1aa';
                ctx.font = '10px Inter';
                ctx.fillText(node.role, node.x, node.y + 35);
            });

            // Randomly emit heartbeats from leader
            if (Math.random() < 0.05) {
                const leader = nodes.find(n => n.role === 'leader');
                if (leader) {
                    nodes.filter(n => n.id !== leader.id).forEach(target => {
                        packets.push({
                            id: Math.random(),
                            x: leader.x,
                            y: leader.y,
                            targetId: target.id,
                            type: 'heartbeat'
                        });
                    });
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ width: '100%', height: '100%' }}
        />
    );
}


import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const EcosystemNeuralNet = ({ className = "", agents = [] }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Configuration
    const CONFIG = {
        particleCount: 20, // Data packets
        connectionDistance: 200,
        repulsionRadius: 100,
        springLength: 150,
        springStrength: 0.05,
        repulsionStrength: 500,
        centeringStrength: 0.005,
        mouseRepulsionRadius: 150,
        mouseRepulsionStrength: 1000,
        friction: 0.9, // Damping
    };

    // Helper to map agent roles/names to colors
    const getAgentColor = (name) => {
        if (name.includes("Visionary") || name.includes("Designer")) return '#EC4899'; // Pink
        if (name.includes("Operator") || name.includes("Architect")) return '#3B82F6'; // Blue
        if (name.includes("Guardian")) return '#10B981'; // Green
        if (name.includes("Alchemist") || name.includes("Editor")) return '#A855F7'; // Purple
        if (name.includes("Librarian")) return '#F59E0B'; // Amber
        if (name.includes("Broadcaster")) return '#EF4444'; // Red
        return '#FFFFFF'; // Default
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let width, height;

        // Initialize Nodes based on props or fallback
        // Always include a central "Core" node
        const coreNode = { id: 'core', label: 'Cortex', type: 'core', x: 0, y: 0, vx: 0, vy: 0, color: '#FFFFFF', size: 15 };

        // Map agents to nodes
        let agentNodes = agents.map((agent, i) => ({
            id: agent.name,
            label: agent.name,
            type: 'agent',
            // Random start pos around center
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
            vx: 0,
            vy: 0,
            color: getAgentColor(agent.name),
            size: 8
        }));

        // If no agents yet, maybe show some placeholders? 
        // Or just show Core. Let's just show Core if empty to avoid flicker logic complexity for now, or keep placeholders?
        // Let's use the actual agents. If empty, it's just the core.

        let nodes = [coreNode, ...agentNodes];

        // Generate Connections (Star topology + Random inter-connections)
        let connections = agentNodes.map(node => ({
            source: 'core', target: node.id
        }));

        // Add some random connections between agents if we have enough
        if (agentNodes.length > 2) {
            for (let i = 0; i < agentNodes.length; i++) {
                // Connect to next one like a ring (optional, for fun)
                const next = (i + 1) % agentNodes.length;
                connections.push({ source: agentNodes[i].id, target: agentNodes[next].id });
            }
        }

        let particles = [];

        // Mouse state
        let mouse = { x: null, y: null };

        // Initialize Particles
        const initParticles = () => {
            particles = [];
            if (connections.length === 0) return;
            for (let i = 0; i < CONFIG.particleCount; i++) {
                const conn = connections[Math.floor(Math.random() * connections.length)];
                particles.push({
                    currentConnection: conn,
                    progress: Math.random(), // 0 to 1
                    speed: 0.005 + Math.random() * 0.01,
                    color: '#FFFFFF'
                });
            }
        };
        initParticles();

        const resize = () => {
            const parent = containerRef.current;
            if (parent) {
                width = parent.clientWidth;
                height = parent.clientHeight;
                canvas.width = width * window.devicePixelRatio;
                canvas.height = height * window.devicePixelRatio;
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

                // Re-center core on resize?
                // The physics loop handles centering relative to (width/2, height/2)
            }
        };
        window.addEventListener('resize', resize);
        resize();

        // Mouse Handlers
        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };
        const handleMouseLeave = () => {
            mouse.x = null;
            mouse.y = null;
        };
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        // Physics Loop
        const update = () => {
            const center = { x: width / 2, y: height / 2 };

            // 1. Forces
            nodes.forEach(node => {
                let fx = 0, fy = 0;

                // Handle initial 0,0 distinct from "center"
                if (node.x === 0 && node.y === 0 && node.id === 'core') {
                    // Lock core to center? Or let it float?
                    // Let's lock Core to center visually for stability, but let it drift slightly?
                    // Actually, let's just force it.
                    node.x = center.x;
                    node.y = center.y;
                    // Reset velocity to avoid accumulated momentum if we force position
                    node.vx = 0;
                    node.vy = 0;
                    return; // Skip physics for Core if we want it static. 
                    // If we want it dynamic, remove this return.
                    // Let's make it static anchor.
                }

                // If node is initialized at 0,0 (relative), move it to center to start
                if (node.x === 0 && node.y === 0) {
                    node.x = center.x + (Math.random() - 0.5) * 10;
                    node.y = center.y + (Math.random() - 0.5) * 10;
                }


                // Centering Force (Gravity)
                const distToCenter = Math.sqrt(Math.pow(node.x - center.x, 2) + Math.pow(node.y - center.y, 2));
                if (distToCenter > 0) {
                    fx += (center.x - node.x) * CONFIG.centeringStrength;
                    fy += (center.y - node.y) * CONFIG.centeringStrength;
                }

                // Repulsion between nodes
                nodes.forEach(other => {
                    if (node.id === other.id) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONFIG.repulsionRadius && dist > 0) {
                        const force = (CONFIG.repulsionRadius - dist) / CONFIG.repulsionRadius;
                        const repulse = force * CONFIG.repulsionStrength;
                        fx += (dx / dist) * repulse;
                        fy += (dy / dist) * repulse;
                    }
                });

                // Spring Forces (Connections)
                connections.forEach(conn => {
                    let other = null;
                    // Find the other node object
                    if (conn.source === node.id) other = nodes.find(n => n.id === conn.target);
                    if (conn.target === node.id) other = nodes.find(n => n.id === conn.source);

                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        // Spring
                        const displacement = dist - CONFIG.springLength;
                        const force = displacement * CONFIG.springStrength;

                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                    }
                });

                // Mouse Interaction
                if (mouse.x !== null) {
                    const dx = node.x - mouse.x;
                    const dy = node.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONFIG.mouseRepulsionRadius && dist > 0) {
                        const force = (CONFIG.mouseRepulsionRadius - dist) / CONFIG.mouseRepulsionRadius;
                        const repulse = force * CONFIG.mouseRepulsionStrength;
                        fx += (dx / dist) * repulse;
                        fy += (dy / dist) * repulse;
                    }
                }

                // Apply Forces
                node.vx = (node.vx + fx) * CONFIG.friction;
                node.vy = (node.vy + fy) * CONFIG.friction;

                // Update Position
                node.x += node.vx;
                node.y += node.vy;

                // Soft Bounds
                const padding = 20;
                if (node.x < padding) node.vx += 1;
                if (node.x > width - padding) node.vx -= 1;
                if (node.y < padding) node.vy += 1;
                if (node.y > height - padding) node.vy -= 1;
            });

            // Update Particles
            particles.forEach(p => {
                p.progress += p.speed;
                if (p.progress >= 1) {
                    p.progress = 0;
                    // Pick new random connection?
                    if (connections.length > 0) {
                        p.currentConnection = connections[Math.floor(Math.random() * connections.length)];
                    }
                }
            });
        };

        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            // Draw Connections
            connections.forEach(conn => {
                const source = nodes.find(n => n.id === conn.source);
                const target = nodes.find(n => n.id === conn.target);
                if (!source || !target) return;

                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);

                const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
                grad.addColorStop(0, `${source.color}20`);
                grad.addColorStop(1, `${target.color}20`);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            // Draw Particles
            particles.forEach(p => {
                if (!p.currentConnection) return;
                const source = nodes.find(n => n.id === p.currentConnection.source);
                const target = nodes.find(n => n.id === p.currentConnection.target);
                if (!source || !target) return;

                const x = source.x + (target.x - source.x) * p.progress;
                const y = source.y + (target.y - source.y) * p.progress;

                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF80';
                ctx.fill();
            });

            // Draw Nodes
            nodes.forEach(node => {
                // Glow
                const glow = ctx.createRadialGradient(node.x, node.y, node.size * 0.5, node.x, node.y, node.size * 4);
                glow.addColorStop(0, `${node.color}80`);
                glow.addColorStop(1, `${node.color}00`);
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // Label
                ctx.font = '10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#FFFFFF80';
                ctx.fillText(node.label, node.x, node.y + node.size + 15);
            });
        };

        const loop = () => {
            update();
            draw();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, [agents]); // Re-init when agents change

    return (
        <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
            />
            {/* Overlay Description / HUD if needed */}
            <div className="absolute bottom-4 left-4 pointer-events-none">
                <div className="flex items-center gap-2 text-xs text-white/30 uppercase tracking-widest font-mono">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Neural Engine Online
                </div>
            </div>
        </div>
    );
};

export default EcosystemNeuralNet;

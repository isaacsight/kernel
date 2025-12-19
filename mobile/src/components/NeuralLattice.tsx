import React from 'react';

const NeuralLattice: React.FC = () => {
    const [nodes, setNodes] = React.useState<{ id: number; top: string; left: string; delay: string; duration: string }[]>([]);

    React.useEffect(() => {
        const newNodes = Array.from({ length: 12 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${3 + Math.random() * 4}s`
        }));
        setNodes(newNodes);
    }, []);

    if (nodes.length === 0) return null;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            {nodes.map((node) => (
                <div
                    key={node.id}
                    className="neural-node"
                    style={{
                        top: node.top,
                        left: node.left,
                        animationDelay: node.delay,
                        animationDuration: node.duration
                    }}
                />
            ))}

            {/* Ambient Pulse */}
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent animate-pulse duration-[10s]"></div>
        </div>
    );
};

export default NeuralLattice;

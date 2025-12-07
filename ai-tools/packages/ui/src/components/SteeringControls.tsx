
import React from 'react';

export interface SteeringParam {
    id: string;
    label: string;
    value: number; // -10 to 10
    description: string;
}

interface SteeringControlsProps {
    params: SteeringParam[];
    onChange: (id: string, value: number) => void;
    className?: string;
}

export const SteeringControls: React.FC<SteeringControlsProps> = ({
    params,
    onChange,
    className = ''
}) => {
    return (
        <div className={`p-4 bg-zinc-900 border border-zinc-800 rounded-lg ${className}`}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Activation Steering</h3>
            <div className="flex flex-col gap-4">
                {params.map((p) => (
                    <div key={p.id}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-zinc-300">{p.label}</span>
                            <span className="font-mono text-zinc-500">{p.value > 0 ? '+' : ''}{p.value}</span>
                        </div>
                        <input
                            type="range"
                            min="-10"
                            max="10"
                            step="1"
                            value={p.value}
                            onChange={(e) => onChange(p.id, parseInt(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <p className="text-[10px] text-zinc-600 mt-1">{p.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

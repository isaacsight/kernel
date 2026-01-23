import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, useSpring } from 'framer-motion';
import { Rocket, Lock, Check, ChevronDown } from 'lucide-react';

const GravityRelease = ({ onTrigger, label = "Deploy", loading = false }) => {
    const [status, setStatus] = useState('idle'); // idle, deploying, success
    const constraintsRef = useRef(null);
    const controls = useAnimation();

    // Physics values
    const y = useMotionValue(0);
    const height = 200; // Total track height
    const handleSize = 64;
    const limit = height - handleSize;

    // Transform opacity/color based on drag position
    const progress = useTransform(y, [0, limit], [0, 1]);
    const glowOpacity = useTransform(y, [0, limit], [0, 1]);
    const handleColor = useTransform(y, [0, limit], ["#333", "#00D6A3"]);

    // Dynamic feedback text
    const textOpacity = useTransform(y, [0, 50], [1, 0]);

    const handleDragEnd = async (_, info) => {
        if (loading || status === 'success') return;

        if (y.get() >= limit - 10) {
            // Trigger threshold reached
            setStatus('deploying');
            // Snap to bottom
            controls.start({ y: limit });

            // Execute callback
            const success = await onTrigger();

            if (success) {
                setStatus('success');
            } else {
                // Reset on failure
                setStatus('idle');
                controls.start({ y: 0 });
            }
        } else {
            // Snap back if released early
            controls.start({ y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } });
        }
    };

    return (
        <div className="relative flex flex-col items-center">
            {/* The Track */}
            <div
                ref={constraintsRef}
                className="relative w-24 bg-black/40 border border-white/10 rounded-full overflow-hidden backdrop-blur-sm shadow-inner"
                style={{ height: height }}
            >
                {/* Progress Fill */}
                <motion.div
                    className="absolute top-0 left-0 right-0 bg-[#00D6A3]/20 w-full"
                    style={{ height: y }}
                />

                {/* Grid Lines/Decorations */}
                <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-20">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-full h-[1px] bg-white/50" />
                    ))}
                </div>

                {/* Label Text fading out */}
                <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
                    style={{ opacity: textOpacity }}
                >
                    <ChevronDown className="animate-bounce mb-1 text-white/50" size={16} />
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold rotate-90 whitespace-nowrap">
                        Inicitate
                    </span>
                </motion.div>

                {/* The Handle */}
                <motion.div
                    className="absolute top-0 left-0 right-0 m-2 w-20 h-20 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-gradient-to-br from-[#1a1a1a] to-[#000]"
                    style={{ y }}
                    animate={controls}
                    drag="y"
                    dragConstraints={constraintsRef}
                    dragElastic={0.1}
                    dragMomentum={false}
                    onDragEnd={handleDragEnd}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {/* Inner status icon */}
                    <div className="relative z-20 text-white">
                        {loading ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                                <Lock size={24} className="text-white/50" />
                            </motion.div>
                        ) : status === 'success' ? (
                            <Check size={32} className="text-[#00D6A3]" />
                        ) : (
                            <Rocket size={24} className={status === 'deploying' ? 'text-[#00D6A3]' : 'text-white'} />
                        )}
                    </div>

                    {/* Glow Ring */}
                    <motion.div
                        className="absolute inset-0 rounded-full border-2 border-[#00D6A3] blur-sm"
                        style={{ opacity: glowOpacity }}
                    />
                </motion.div>
            </div>

            {/* Status Text Below */}
            <div className="mt-4 text-center h-8">
                {status === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#00D6A3] font-bold text-sm tracking-widest uppercase flex items-center gap-2"
                    >
                        <Check size={14} /> Sequence Complete
                    </motion.div>
                ) : (
                    <div className="text-white/30 text-xs tracking-widest uppercase">
                        {loading ? "Sequence Running..." : "Pull to Deploy"}
                    </div>
                )}
            </div>

        </div>
    );
};

export default GravityRelease;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, Shield, Zap, CheckCircle2, AlertCircle,
    Loader2, ChevronRight, Binary, Fingerprint, Eye, FileText, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const apiBase = `http://${window.location.hostname}:8000`;

const StageBadge = ({ stage, status }) => {
    const configs = {
        planning: { label: "Planning", color: "text-[#00D6A3]", icon: Binary },
        doctrinal_audit: { label: "Doctrinal Audit", color: "text-amber-400", icon: Shield },
        execution: { label: "Execution", color: "text-blue-400", icon: Zap },
        review: { label: "Review", color: "text-purple-400", icon: Eye },
        shipment: { label: "Shipment", color: "text-green-400", icon: Fingerprint }
    };

    const config = configs[stage] || { label: stage, color: "text-white/40", icon: Activity };
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 ${config.color} opacity-80`}>
            <Icon size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">{config.label}</span>
            <span className="text-[8px] opacity-40">[{status}]</span>
        </div>
    );
};

const MissionControl = ({ mission }) => {
    const [generatingReport, setGeneratingReport] = useState(false);

    if (!mission || !mission.mission) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white/[0.01] rounded-xl border border-white/5">
                <Activity size={24} className="text-white/10 mb-4 animate-pulse" />
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Awaiting Directive...</div>
            </div>
        );
    }

    const { mission: task, status, steps, started_at, alignment } = mission;

    const generateReport = async () => {
        setGeneratingReport(true);
        try {
            const res = await axios.get(`${apiBase}/api/mission/report`);
            if (res.data.report) {
                const blob = new Blob([res.data.report], { type: 'text/markdown' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mission_report_${new Date().getTime()}.md`;
                a.click();
            }
        } catch (err) {
            console.error("Failed to generate report", err);
        } finally {
            setGeneratingReport(false);
        }
    };

    return (
        <section className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Active Mission Header */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Binary size={40} />
                </div>

                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#00D6A3] animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Active Mission</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={generateReport}
                            disabled={generatingReport}
                            className="text-[9px] font-black uppercase tracking-widest text-[#00D6A3] border border-[#00D6A3]/20 px-2 py-1 rounded hover:bg-[#00D6A3]/10 transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                            {generatingReport ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                            QA Report
                        </button>
                        <span className="text-[9px] font-mono text-white/20">{started_at ? new Date(started_at).toLocaleTimeString() : '--:--:--'}</span>
                    </div>
                </div>

                <h2 className="text-sm font-medium text-white/90 leading-tight mb-4">
                    {task}
                </h2>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[8px] uppercase tracking-widest text-white/30 mb-0.5">Status</span>
                        <span className="text-[10px] font-mono font-bold text-[#00D6A3] uppercase">{status}</span>
                    </div>
                    <div className="w-px h-6 bg-white/5" />
                    <div className="flex flex-col">
                        <span className="text-[8px] uppercase tracking-widest text-white/30 mb-0.5">Alignment</span>
                        <span className={`text-[10px] font-mono font-bold ${alignment > 70 ? 'text-[#00D6A3]' : 'text-amber-400'}`}>
                            {alignment ? `${alignment}/100` : "TBD"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stage Timeline */}
            <div className="space-y-4">
                {steps.map((step, idx) => (
                    <motion.div
                        key={step.stage}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${step.status === 'in_progress' ? 'border-[#00D6A3]/30 bg-[#00D6A3]/5' :
                                step.status === 'failed' || step.status === 'vetoed' ? 'border-red-500/30 bg-red-500/5' :
                                    'border-white/5 bg-white/[0.01]'
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <StageBadge stage={step.stage} status={step.status} />
                            {step.status === 'in_progress' && <Loader2 size={10} className="text-[#00D6A3] animate-spin" />}
                            {(step.status === 'complete' || step.status === 'approved') && <CheckCircle2 size={10} className="text-[#00D6A3]" />}
                            {(step.status === 'failed' || step.status === 'vetoed') && <AlertCircle size={10} className="text-red-400" />}
                        </div>

                        {step.stage === 'doctrinal_audit' && step.result && (
                            <div className="text-[10px] font-mono text-white/40 leading-relaxed pl-4 border-l border-white/10 italic">
                                "{step.result.reason}"
                            </div>
                        )}

                        {step.stage === 'planning' && step.plan && (
                            <div className="text-[9px] font-mono text-white/30 pl-4 border-l border-white/10">
                                {step.plan.steps?.length} modular actions staged
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default MissionControl;

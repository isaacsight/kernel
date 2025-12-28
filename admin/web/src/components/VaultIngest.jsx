import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, ShieldCheck, ShieldAlert, Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const apiBase = `http://${window.location.hostname}:8000`;

const VaultIngest = () => {
    const [vaultStatus, setVaultStatus] = useState({});
    const [selectedKey, setSelectedKey] = useState("GEMINI_API_KEY");
    const [keyValue, setKeyValue] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const keys = [
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "STRIPE_API_KEY"
    ];

    useEffect(() => {
        fetchVaultStatus();
    }, []);

    const fetchVaultStatus = async () => {
        try {
            const res = await axios.get(`${apiBase}/api/vault/status`);
            setVaultStatus(res.data);
        } catch (err) {
            console.error("Failed to fetch vault status", err);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!keyValue) return;
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(`${apiBase}/api/vault/save`, {
                key_name: selectedKey,
                key_value: keyValue
            });
            setMessage({ type: "success", text: `Vault updated: ${selectedKey}` });
            setKeyValue("");
            fetchVaultStatus();
        } catch (err) {
            setMessage({ type: "error", text: "Failed to update vault." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00D6A3] flex items-center gap-2">
                    <Key size={12} />
                    Vault Ingest (Sovereignty Layer)
                </h3>
                <p className="text-[10px] text-white/40 font-mono">
                    Direct your agents by providing the necessary energy (API Keys).
                    Your keys are stored in a local-first SQLite vault.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Status Column */}
                <div className="space-y-2">
                    {keys.map(k => (
                        <div key={k} className="flex justify-between items-center p-2 rounded border border-white/5 bg-white/[0.01]">
                            <span className="text-[9px] font-mono text-white/60">{k}</span>
                            {vaultStatus[k] ? (
                                <div className="flex items-center gap-1 text-[#00D6A3]">
                                    <ShieldCheck size={10} />
                                    <span className="text-[8px] font-black uppercase">Active</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-white/20">
                                    <ShieldAlert size={10} />
                                    <span className="text-[8px] font-black uppercase">Missing</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Ingest Form */}
                <form onSubmit={handleSave} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-white/40">Select Provider</label>
                        <select
                            value={selectedKey}
                            onChange={(e) => setSelectedKey(e.target.value)}
                            className="bg-[#080808] border border-white/10 rounded p-2 text-[10px] text-white/80 focus:border-[#00D6A3]/50 transition-colors"
                        >
                            {keys.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-white/40">API Key Value</label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={keyValue}
                                onChange={(e) => setKeyValue(e.target.value)}
                                placeholder="Paste key here..."
                                className="w-full bg-[#080808] border border-white/10 rounded p-2 text-[10px] text-white/80 font-mono focus:border-[#00D6A3]/50 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1.5 text-white/20 hover:text-white/40"
                            >
                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {message && (
                        <div className={`text-[9px] font-mono ${message.type === 'success' ? 'text-[#00D6A3]' : 'text-red-400'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !keyValue}
                        className="w-full py-2 bg-[#00D6A3] text-[#080808] rounded font-black text-[10px] uppercase tracking-widest hover:bg-[#00F0B5] transition-colors disabled:opacity-20 flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Secure Key
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VaultIngest;

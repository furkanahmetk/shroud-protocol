import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { settings, updateSettings } = useSettings();
    const [rpcUrl, setRpcUrl] = useState(settings.rpcUrl);
    const [explorerUrl, setExplorerUrl] = useState(settings.explorerUrl);
    const [privacyMode, setPrivacyMode] = useState(settings.privacyMode);

    if (!isOpen) return null;

    const handleSave = () => {
        updateSettings({ rpcUrl, explorerUrl, privacyMode });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md bg-brand-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">RPC Endpoint URL</label>
                        <input
                            type="text"
                            value={rpcUrl}
                            onChange={(e) => setRpcUrl(e.target.value)}
                            placeholder="e.g. https://node.testnet.casper.network/rpc"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-sm font-mono"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Explorer API URL</label>
                        <input
                            type="text"
                            value={explorerUrl}
                            onChange={(e) => setExplorerUrl(e.target.value)}
                            placeholder="e.g. https://api.testnet.cspr.live"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-sm font-mono"
                        />
                    </div>

                    <div className="bg-brand-800/50 border border-brand-500/20 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-white flex items-center gap-2">
                                <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Strict Privacy Mode
                            </label>
                            <button
                                onClick={() => setPrivacyMode(!privacyMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${privacyMode ? 'bg-brand-500' : 'bg-gray-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${privacyMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            When enabled, global statistics and visual historical graphs are disabled to prevent metadata leakage. We highly recommend enabling this along with a Tor Proxy or VPN for maximum anonymity.
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full mt-4 bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-xl transition-colors"
                    >
                        Save Preferences
                    </button>
                </div>
            </div>
        </div>
    );
}

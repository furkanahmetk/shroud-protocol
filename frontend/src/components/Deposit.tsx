import React, { useState } from 'react';
import { ArrowDownCircle, Copy, Check } from 'lucide-react';

interface DepositProps {
    isConnected: boolean;
    activeKey: string | null;
}

export default function Deposit({ isConnected, activeKey }: DepositProps) {
    const [amount] = useState('100');
    const [isProcessing, setIsProcessing] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleDeposit = async () => {
        if (!isConnected || !activeKey) return;
        setIsProcessing(true);

        // Simulate deposit process
        setTimeout(() => {
            const mockSecret = "shroud-secret-" + Math.random().toString(36).substring(7);
            setSecret(mockSecret);
            setIsProcessing(false);
        }, 2000);
    };

    const copyToClipboard = () => {
        if (secret) {
            navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Amount to Deposit</span>
                    <span className="text-white font-mono">Balance: 1,250 CSPR</span>
                </div>
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={amount}
                        readOnly
                        className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white"
                    />
                    <span className="text-xl font-bold text-shroud-accent">CSPR</span>
                </div>
            </div>

            {secret ? (
                <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-xl space-y-3">
                    <h3 className="text-yellow-500 font-bold flex items-center">
                        ⚠️ Save Your Secret!
                    </h3>
                    <p className="text-sm text-yellow-200/70">
                        You need this secret key to withdraw your funds later. If you lose it, your funds are lost forever.
                    </p>
                    <div className="flex items-center space-x-2 bg-black/50 p-3 rounded-lg">
                        <code className="flex-1 font-mono text-sm break-all text-white">{secret}</code>
                        <button
                            onClick={copyToClipboard}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setSecret(null)}
                        className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        I have saved my secret
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleDeposit}
                    disabled={isProcessing || !isConnected}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                    {isProcessing ? (
                        <span className="animate-pulse">Processing...</span>
                    ) : !isConnected ? (
                        <span>Connect Wallet to Deposit</span>
                    ) : (
                        <>
                            <ArrowDownCircle className="w-5 h-5 mr-2" />
                            Deposit 100 CSPR
                        </>
                    )}
                </button>
            )}

            <div className="text-xs text-center text-gray-500">
                + 1.5 CSPR network fee
            </div>
        </div>
    );
}

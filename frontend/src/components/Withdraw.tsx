import React, { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';

export default function Withdraw() {
    const [secret, setSecret] = useState('');
    const [recipient, setRecipient] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'proving' | 'withdrawing' | 'success'>('idle');

    const handleWithdraw = async () => {
        setIsProcessing(true);
        setStatus('proving');

        // Simulate ZK proof generation
        setTimeout(() => {
            setStatus('withdrawing');
            // Simulate withdrawal tx
            setTimeout(() => {
                setStatus('success');
                setIsProcessing(false);
            }, 2000);
        }, 3000);
    };

    if (status === 'success') {
        return (
            <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <ArrowUpCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white">Withdrawal Successful!</h3>
                <p className="text-gray-400">Your funds have been sent to the recipient address.</p>
                <button
                    onClick={() => {
                        setStatus('idle');
                        setSecret('');
                        setRecipient('');
                    }}
                    className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                    Make another withdrawal
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm text-gray-400">Secret Key</label>
                <textarea
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Paste your secret key here..."
                    className="w-full bg-black/30 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-shroud-accent h-24 resize-none font-mono text-sm"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm text-gray-400">Recipient Address</label>
                <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-black/30 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-shroud-accent font-mono text-sm"
                />
            </div>

            <button
                onClick={handleWithdraw}
                disabled={isProcessing || !secret || !recipient}
                className="w-full py-4 bg-shroud-accent text-black font-bold rounded-xl hover:bg-green-400 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
                {status === 'proving' ? (
                    <span className="animate-pulse">Generating Zero-Knowledge Proof...</span>
                ) : status === 'withdrawing' ? (
                    <span className="animate-pulse">Submitting Transaction...</span>
                ) : (
                    <>
                        <ArrowUpCircle className="w-5 h-5 mr-2" />
                        Withdraw 100 CSPR
                    </>
                )}
            </button>
        </div>
    );
}

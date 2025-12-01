import React, { useState } from 'react';
import { ArrowDownCircle, Copy, Check } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createDepositDeploy, sendSignedDeploy } from '../utils/casper';
import { useWallet } from '../hooks/useWallet';

interface DepositProps {
    isConnected: boolean;
    activeKey: string | null;
}

export default function Deposit({ isConnected, activeKey }: DepositProps) {
    const [amount] = useState('100');
    const [isProcessing, setIsProcessing] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { signDeploy } = useWallet();

    const handleDeposit = async () => {
        if (!isConnected || !activeKey) return;
        setIsProcessing(true);

        try {
            // 1. Generate Secrets
            const crypto = new CryptoUtils();
            await crypto.init();
            const { nullifier, secret } = crypto.generateSecrets();
            const commitment = crypto.computeCommitment(nullifier, secret);

            // 2. Create Deploy
            const deployJson = createDepositDeploy(activeKey, commitment, BigInt(100_000_000_000));

            // 3. Sign Deploy
            const signedDeployJson = await signDeploy(deployJson, activeKey);

            // 4. Send Deploy
            const deployHash = await sendSignedDeploy(signedDeployJson);
            console.log("Deposit Deploy Hash:", deployHash);

            // 5. Show Secret to User
            // Format: nullifier-secret-commitment
            const secretString = JSON.stringify({
                nullifier: nullifier.toString(),
                secret: secret.toString(),
                commitment: commitment.toString()
            });
            setSecret(secretString);

        } catch (e) {
            console.error("Deposit failed:", e);
            alert("Deposit failed. See console for details.");
        } finally {
            setIsProcessing(false);
        }
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
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm font-medium">Amount to Deposit</span>
                    <span className="text-brand-400 font-mono text-sm font-medium">Balance: 1,250 CSPR</span>
                </div>
                <div className="flex items-center space-x-3">
                    <input
                        type="text"
                        value={amount}
                        readOnly
                        className="bg-transparent text-4xl font-bold w-full focus:outline-none text-white font-mono tracking-tight"
                    />
                    <span className="text-xl font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded-lg border border-brand-500/20">CSPR</span>
                </div>
            </div>

            {secret ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-2xl space-y-4 animate-fade-in">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <span className="text-xl">⚠️</span>
                        </div>
                        <h3 className="text-yellow-400 font-bold text-lg">Save Your Secret!</h3>
                    </div>
                    <p className="text-sm text-yellow-200/80 leading-relaxed">
                        You need this secret key to withdraw your funds later. <br />
                        <span className="font-bold text-yellow-400">If you lose it, your funds are lost forever.</span>
                    </p>
                    <div className="flex items-center space-x-2 bg-black/20 p-4 rounded-xl border border-white/10 shadow-sm group hover:border-brand-500/30 transition-colors">
                        <code className="flex-1 font-mono text-xs break-all text-gray-400 group-hover:text-gray-200 transition-colors">{secret}</code>
                        <button
                            onClick={copyToClipboard}
                            className="p-2.5 hover:bg-white/10 rounded-lg transition-all active:scale-95"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setSecret(null)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white shadow-sm"
                    >
                        I have saved my secret
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleDeposit}
                    disabled={isProcessing || !isConnected}
                    className="w-full py-4 btn-primary rounded-xl flex justify-center items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? (
                        <span className="animate-pulse flex items-center">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Processing...
                        </span>
                    ) : !isConnected ? (
                        <span>Connect Wallet to Deposit</span>
                    ) : (
                        <>
                            <ArrowDownCircle className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                            Deposit 100 CSPR
                        </>
                    )}
                </button>
            )}

            <div className="text-xs text-center text-gray-500 font-medium">
                + 1.5 CSPR network fee
            </div>
        </div>
    );
}

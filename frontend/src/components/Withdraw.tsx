import React, { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createWithdrawDeploy, sendSignedDeploy } from '../utils/casper';
import { useWallet } from '../hooks/useWallet';
const snarkjs = require('snarkjs');

interface WithdrawProps {
    isConnected: boolean;
    activeKey: string | null;
}

export default function Withdraw({ isConnected, activeKey }: WithdrawProps) {
    const [secretInput, setSecretInput] = useState('');
    const [recipient, setRecipient] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'proving' | 'withdrawing' | 'success'>('idle');
    const { signDeploy } = useWallet();

    const handleWithdraw = async () => {
        if (!isConnected || !activeKey) return;
        setIsProcessing(true);
        setStatus('proving');

        try {
            // 1. Parse Secret
            const secretData = JSON.parse(secretInput);
            const nullifier = BigInt(secretData.nullifier);
            const secret = BigInt(secretData.secret);
            const commitment = BigInt(secretData.commitment);

            // 2. Init Crypto
            const crypto = new CryptoUtils();
            await crypto.init();

            // 3. Generate Proof
            const pathElements = new Array(20).fill(0n);
            const pathIndices = new Array(20).fill(0);

            const input = {
                nullifier: nullifier,
                secret: secret,
                pathElements: pathElements,
                pathIndices: pathIndices,
                root: commitment,
                nullifierHash: crypto.computeNullifierHash(nullifier),
                recipient: 0n, // Dummy recipient for proof
                relayer: 0n,
                fee: 0n
            };

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                "/withdraw.wasm",
                "/withdraw_final.zkey"
            );

            setStatus('withdrawing');

            // 4. Create Deploy
            const computedRoot = BigInt(publicSignals[0]);
            const nullifierHash = BigInt(publicSignals[1]);
            const proofBytes = new Uint8Array(128); // Dummy proof bytes

            const deployJson = createWithdrawDeploy(
                activeKey,
                proofBytes,
                computedRoot,
                nullifierHash,
                recipient
            );

            // 5. Sign & Send
            const signedDeployJson = await signDeploy(deployJson, activeKey);
            const deployHash = await sendSignedDeploy(signedDeployJson);

            console.log("Withdraw Deploy Hash:", deployHash);
            setStatus('success');

        } catch (e) {
            console.error("Withdraw failed:", e);
            setStatus('idle');
            alert("Withdraw failed. See console.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="text-center py-12 space-y-6 animate-fade-in">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 shadow-sm">
                    <ArrowUpCircle className="w-10 h-10 text-green-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-3xl font-bold text-white tracking-tight">Withdrawal Submitted!</h3>
                    <p className="text-gray-400">Transaction has been sent to the network.</p>
                </div>
                <button
                    onClick={() => {
                        setStatus('idle');
                        setSecretInput('');
                        setRecipient('');
                    }}
                    className="mt-6 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all text-gray-300 hover:text-white shadow-sm hover:shadow-md"
                >
                    Make another withdrawal
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-sm text-gray-400 font-medium ml-1">Secret Key (JSON)</label>
                <textarea
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                    placeholder='Paste your secret JSON here...'
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 h-32 resize-none font-mono text-xs transition-all placeholder:text-gray-600"
                />
            </div>

            <div className="space-y-3">
                <label className="text-sm text-gray-400 font-medium ml-1">Recipient Address</label>
                <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 font-mono text-sm transition-all placeholder:text-gray-600"
                />
            </div>

            <button
                onClick={handleWithdraw}
                disabled={isProcessing || !secretInput || !recipient}
                className="w-full py-4 btn-primary rounded-xl flex justify-center items-center group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {status === 'proving' ? (
                    <span className="animate-pulse flex items-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Generating Zero-Knowledge Proof...
                    </span>
                ) : status === 'withdrawing' ? (
                    <span className="animate-pulse flex items-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Submitting Transaction...
                    </span>
                ) : (
                    <>
                        <ArrowUpCircle className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                        Withdraw 100 CSPR
                    </>
                )}
            </button>
        </div>
    );
}

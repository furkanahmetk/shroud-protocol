import React, { useState } from 'react';
import { ArrowDownCircle, Copy, Check, X, ShieldAlert, TerminalSquare } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createDepositSessionTransaction, createDepositSessionTransaction as _deprecated, sendSignedTransaction, CONTRACT_HASH } from '../utils/casper';
import { useWallet } from '../hooks/useWallet';
import { useCommitment } from '../context/CommitmentContext';
import { SyncProgressTracker } from '../utils/syncProgress';

interface DepositProps {
    isConnected: boolean;
    activeKey: string | null;
}

// Helper to format ETA
const formatETA = (ms: number | null): string => {
    if (ms === null || ms <= 0) return '';
    return SyncProgressTracker.formatTime(ms);
};

export default function Deposit({ isConnected, activeKey }: DepositProps) {
    const [amount] = useState('100');
    const [isProcessing, setIsProcessing] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { signTransaction, balance } = useWallet();
    const { isSyncing, syncProgress, syncErrors, cancelSync } = useCommitment();

    const handleDeposit = async () => {
        if (!isConnected || !activeKey) return;
        setIsProcessing(true);

        try {
            // 1. Generate Secrets
            const crypto = new CryptoUtils();
            await crypto.init();
            const { nullifier, secret } = crypto.generateSecrets();
            const commitment = crypto.computeCommitment(nullifier, secret);

            // 3. Fetch Session WASM
            const wasmResponse = await fetch('/deposit_session.wasm');
            if (!wasmResponse.ok) throw new Error('Failed to load session WASM');
            const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());

            // 4. Create Transaction which uses Session Code (SDK v5)
            const transaction = createDepositSessionTransaction(activeKey, commitment, BigInt(100_000_000_000), wasmBytes);

            // 5. Sign Transaction
            const signedTransactionJson = await signTransaction(transaction, activeKey);

            // 6. Send Transaction
            const transactionHash = await sendSignedTransaction(signedTransactionJson);
            console.log("Deposit Transaction Hash:", transactionHash);

            // 7. Create secret JSON for user
            // IMPORTANT: We do NOT save to local cache here to avoid race conditions
            // with concurrent deposits. The leaf index will be determined at withdrawal
            // time by syncing from the blockchain.
            // 
            // The leafIndex is marked as 'pending' because the on-chain transaction
            // needs to be confirmed and then synced. The withdrawal process will
            // automatically find the correct index by matching the commitment.
            const secretString = JSON.stringify({
                nullifier: nullifier.toString(),
                secret: secret.toString(),
                commitment: commitment.toString(),
                leafIndex: 'pending', // Will be resolved at withdrawal via on-chain sync
                transactionHash: transactionHash,
                timestamp: new Date().toISOString()
            }, null, 2); // Pretty print for the file

            console.log('[Deposit] Secret generated. Leaf index will be resolved at withdrawal via sync.');
            setSecret(secretString);

            // 8. Automatic Download
            downloadSecret(secretString, commitment.toString());

        } catch (e) {
            console.error("Deposit failed:", e);
            alert("Deposit failed. See console for details.");
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadSecret = (secretContent: string, commitment: string) => {
        try {
            const blob = new Blob([secretContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `shroud-secret-${commitment.slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();

            // Delay cleanup to ensure browser starts the download
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        } catch (e) {
            console.error('[Deposit] Download failed:', e);
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
        <div className="space-y-4">
            <div className="bg-[#0A101D] border border-blue-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-[13px] text-blue-200/80 leading-relaxed">
                    <strong className="text-blue-400 font-semibold mr-1">Privacy Notice:</strong>
                    For maximum security, avoid using IP addresses linked to your real identity. Consider VPNs.
                </p>
            </div>
            <div className="bg-[#050912]/80 p-5 rounded-3xl border border-white/5 ring-1 ring-transparent hover:ring-brand-500/20 transition-all shadow-inner group">
                <div className="flex justify-between mb-3 px-1">
                    <span className="text-gray-500 text-xs font-semibold tracking-wider uppercase">Amount to Deposit</span>
                    <span className="text-brand-400 font-mono text-xs font-medium bg-brand-500/10 px-2 py-0.5 rounded-md">
                        {isConnected ? (balance ? `${balance} CSPR` : 'Loading...') : 'Connect Wallet'}
                    </span>
                </div>
                <div className="flex items-center space-x-3 bg-black/40 rounded-2xl p-4 border border-white/5 transition-colors group-hover:border-white/10">
                    <input
                        type="text"
                        value={amount}
                        readOnly
                        className="bg-transparent text-5xl font-extrabold w-full focus:outline-none text-white font-mono tracking-tight"
                    />
                    <div className="flex items-center bg-[#1E293B] px-4 py-2 rounded-xl border border-white/10 shadow-sm">
                        <div className="w-6 h-6 bg-brand-500 rounded-full mr-2 flex items-center justify-center border border-brand-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                            <span className="text-white text-[10px] font-bold">C</span>
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">CSPR</span>
                    </div>
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
                    {(() => {
                        try {
                            const parsed = JSON.parse(secret);
                            if (parsed.transactionHash) {
                                return (
                                    <a
                                        href={`https://testnet.cspr.live/deploy/${parsed.transactionHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center text-xs text-brand-400 hover:text-brand-300 transition-colors"
                                    >
                                        View deposit transaction on explorer →
                                    </a>
                                );
                            }
                        } catch { }
                        return null;
                    })()}
                    <button
                        onClick={() => setSecret(null)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white shadow-sm"
                    >
                        I have saved my secret
                    </button>
                </div>
            ) : (
                <>
                    <button
                        onClick={handleDeposit}
                        disabled={isProcessing || isSyncing || !isConnected}
                        className="w-full py-4 btn-primary rounded-xl flex justify-center items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <span className="animate-pulse flex items-center">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                Processing...
                            </span>
                        ) : !isConnected ? (
                            <span>Connect Wallet to Deposit</span>
                        ) : isSyncing ? (
                            <span className="animate-pulse flex items-center">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                {syncProgress && syncProgress.total > 0
                                    ? `Syncing ${syncProgress.current}/${syncProgress.total}...`
                                    : 'Syncing...'}
                            </span>
                        ) : (
                            <>
                                <ArrowDownCircle className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                                Deposit 100 CSPR
                            </>
                        )}
                    </button>

                    {/* Sync Progress Bar */}
                    {isSyncing && syncProgress && syncProgress.total > 0 && (
                        <div className="mt-3 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">
                                    {syncProgress.phase === 'fetching_transfers' && 'Fetching transfers...'}
                                    {syncProgress.phase === 'fetching_deploys' && 'Processing deploys...'}
                                    {syncProgress.phase === 'processing' && 'Building tree...'}
                                </span>
                                <div className="flex items-center gap-2">
                                    {syncProgress.eta && (
                                        <span className="text-gray-500">
                                            ~{formatETA(syncProgress.eta)}
                                        </span>
                                    )}
                                    <button
                                        onClick={cancelSync}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                        title="Cancel sync"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-brand-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min((syncProgress.current / syncProgress.total) * 100, 100)}%` }}
                                />
                            </div>
                            {syncErrors.length > 0 && (
                                <div className="text-xs text-yellow-400/70">
                                    {syncErrors.length} error(s) - sync will continue
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <div className="flex justify-between items-center px-4 py-1">
                <span className="text-xs text-gray-500 font-medium">Network Fee</span>
                <span className="text-xs text-brand-400 font-medium bg-brand-500/10 px-2 py-0.5 rounded-md">+ 1.5 CSPR</span>
            </div>

            {/* CLI Tool Guidance */}
            <div className="mt-6 p-5 bg-[#0A101D] border border-blue-500/20 rounded-2xl relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500" />

                <div className="flex items-center gap-3 mb-3 relative z-10">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TerminalSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-sm border-b border-transparent group-hover:border-blue-500/30 text-blue-300 font-bold tracking-tight uppercase transition-all">CLI Tool Available</div>
                </div>
                <p className="text-[13px] text-blue-200/60 leading-relaxed relative z-10 mb-4 pr-4">
                    For enhanced protection and air-gapped secret generation, use the local CLI tool to interact with the Shroud Protocol directly.
                </p>
                <div className="relative group/code block">
                    <div className="absolute inset-0 bg-blue-500/20 blur opacity-0 group-hover/code:opacity-100 transition duration-300 rounded-xl"></div>
                    <code className="relative block p-4 bg-[#050811] rounded-xl text-[11px] font-mono text-blue-300/80 break-all border border-blue-500/10 leading-relaxed">
                        <span className="text-brand-400">cd</span> cli {'&&'} <span className="text-brand-400">npm start</span> -- deposit --node https://node.testnet.casper.network --contract <span className="text-white">CONTRACT_HASH</span> --amount 100
                    </code>
                </div>
            </div>
        </div>
    );
}

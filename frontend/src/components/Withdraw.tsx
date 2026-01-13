import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, Download, Upload } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createWithdrawTransaction, sendSignedTransaction, CONTRACT_HASH } from '../utils/casper';
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
    const [showImport, setShowImport] = useState(false);
    const [importInput, setImportInput] = useState('');
    const [cachedCount, setCachedCount] = useState(0);
    const { signTransaction } = useWallet();

    // Load cached commitment count on mount
    useEffect(() => {
        const crypto = new CryptoUtils();
        const cached = crypto.loadCommitmentsFromCache(CONTRACT_HASH);
        setCachedCount(cached.length);
    }, []);

    // Import commitments from CLI cache JSON
    const handleImportCommitments = () => {
        try {
            const commitments = JSON.parse(importInput);
            if (!Array.isArray(commitments)) {
                throw new Error('Input must be a JSON array');
            }

            // Store directly to localStorage
            const key = 'shroud_commitments_' + CONTRACT_HASH.substring(0, 8);
            localStorage.setItem(key, JSON.stringify(commitments));

            setCachedCount(commitments.length);
            setImportInput('');
            setShowImport(false);
            alert(`Successfully imported ${commitments.length} commitments!`);
        } catch (e: any) {
            alert('Failed to import: ' + e.message);
        }
    };

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
            const storedLeafIndex = secretData.leafIndex ? parseInt(secretData.leafIndex) : 0;

            // 2. Init Crypto
            const crypto = new CryptoUtils();
            await crypto.init();

            // 3. Load all commitments from cache and rebuild tree
            console.log('[Withdraw] Loading commitments from cache...');
            const allCommitments = crypto.loadCommitmentsFromCache(CONTRACT_HASH);

            let pathElements: bigint[];
            let pathIndices: number[];
            let computedRoot: bigint;
            let actualIndex: number;

            if (allCommitments.length > 0) {
                // Find our commitment in the cached list
                const ourIndex = allCommitments.findIndex(c => c === commitment);

                if (ourIndex !== -1) {
                    console.log(`[Withdraw] Found commitment in cache at index ${ourIndex}`);

                    // Rebuild tree with all cached commitments
                    const tree = crypto.createMerkleTree();
                    for (const c of allCommitments) {
                        tree.insert(c);
                    }

                    const path = tree.getPath(ourIndex);
                    pathElements = path.pathElements;
                    pathIndices = path.pathIndices;
                    computedRoot = tree.getRoot();
                    actualIndex = ourIndex;

                    console.log(`[Withdraw] Tree rebuilt with ${allCommitments.length} commitments`);
                    console.log(`[Withdraw] Root: ${computedRoot.toString(16).substring(0, 16)}...`);
                } else {
                    console.warn('[Withdraw] Commitment not found in cache, using stored leafIndex');
                    // Fallback to stored leafIndex approach
                    actualIndex = storedLeafIndex;
                    pathIndices = new Array(20).fill(0).map((_, i) => (actualIndex >> i) & 1);
                    pathElements = new Array(20).fill(0n);
                    computedRoot = crypto.computeMerkleRoot(commitment, pathIndices, pathElements);
                }
            } else {
                // No cached commitments - use zeros (only works for first deposit)
                console.warn('[Withdraw] No cached commitments found, using zeros');
                actualIndex = storedLeafIndex;
                pathIndices = new Array(20).fill(0).map((_, i) => (actualIndex >> i) & 1);
                pathElements = new Array(20).fill(0n);
                computedRoot = crypto.computeMerkleRoot(commitment, pathIndices, pathElements);
            }

            console.log(`[Withdraw] Using leaf index: ${actualIndex}`);

            // 4. Build proof input
            const input = {
                nullifier: nullifier,
                secret: secret,
                pathElements: pathElements,
                pathIndices: pathIndices,
                root: computedRoot,
                nullifierHash: crypto.computeNullifierHash(nullifier),
                recipient: BigInt(recipient.startsWith('0x') ? recipient : '0x' + recipient),
                relayer: 0n,
                fee: 0n
            };

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                "/withdraw.wasm",
                "/withdraw_final.zkey"
            );

            setStatus('withdrawing');

            // 5. Create Transaction (SDK v5)
            const proofJson = JSON.stringify(proof);
            const proofBytes = new TextEncoder().encode(proofJson);

            const transaction = createWithdrawTransaction(
                activeKey,
                proofBytes,
                computedRoot,
                BigInt(publicSignals[1]), // nullifier_hash from signals
                recipient
            );

            // 6. Sign & Send
            const signedTransaction = await signTransaction(transaction, activeKey);
            const transactionHash = await sendSignedTransaction(signedTransaction);

            console.log("Withdraw Transaction Hash:", transactionHash);
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

            {/* CLI Cache Sync & Import */}
            <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                    <div className="text-sm text-purple-300 font-medium">🔄 Merkle Tree Cache</div>
                    <div className="text-xs text-purple-200/70 font-mono">
                        {cachedCount} commitments cached
                    </div>
                </div>

                {showImport ? (
                    <div className="space-y-2">
                        <p className="text-xs text-purple-200/70">
                            Paste CLI cache from: <code className="bg-black/30 px-1 rounded">cli/.commitments_eab05369.json</code>
                        </p>
                        <textarea
                            value={importInput}
                            onChange={(e) => setImportInput(e.target.value)}
                            placeholder='Paste JSON array: ["commitment1", "commitment2", ...]'
                            className="w-full bg-black/30 border border-purple-500/20 rounded p-2 text-xs font-mono text-purple-300 h-20 resize-none"
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={handleImportCommitments}
                                className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-xs font-medium text-purple-300 transition-all flex items-center justify-center"
                            >
                                <Upload className="w-3 h-3 mr-1" /> Import
                            </button>
                            <button
                                onClick={() => setShowImport(false)}
                                className="py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-medium text-gray-400 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShowImport(true)}
                            className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-xs font-medium text-purple-300 transition-all flex items-center justify-center"
                        >
                            <Download className="w-3 h-3 mr-1" /> Import CLI Cache
                        </button>
                    </div>
                )}

                <p className="text-xs text-purple-200/50 leading-relaxed">
                    ⚠️ Frontend cache must match on-chain state. Import CLI cache if you deposited via CLI.
                </p>
            </div>

            {/* CLI Tool Guidance */}
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="text-sm text-blue-300 font-medium mb-2">💡 CLI Tool Recommended</div>
                <p className="text-xs text-blue-200/70 leading-relaxed">
                    For reliable withdrawals with ZK proof generation:
                </p>
                <code className="block mt-2 p-2 bg-black/30 rounded text-xs font-mono text-blue-300 break-all">
                    cd cli && npm start -- withdraw --node https://node.testnet.casper.network --contract CONTRACT_HASH --secret SECRET_FILE
                </code>
            </div>
        </div>
    );
}

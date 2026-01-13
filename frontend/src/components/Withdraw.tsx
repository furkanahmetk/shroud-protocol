import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, Download, Upload } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createWithdrawTransaction, sendSignedTransaction, CONTRACT_HASH, fetchContractEvents } from '../utils/casper';
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

    // Load cached commitment count on mount and sync from chain
    useEffect(() => {
        const crypto = new CryptoUtils();

        // Initial load
        const cached = crypto.loadCommitmentsFromCache(CONTRACT_HASH);
        setCachedCount(cached.length);

        // Auto-sync
        const sync = async () => {
            console.log('[Withdraw] Auto-syncing commitments from chain...');
            try {
                const chainData = await fetchContractEvents(CONTRACT_HASH);
                if (chainData && chainData.length > 0) {
                    // Only overwrite if chain has more or different data (simple check: length)
                    // Or just overwrite to be safe and authoritative
                    console.log(`[Withdraw] Synced ${chainData.length} commitments from chain`);

                    const key = 'shroud_commitments_' + CONTRACT_HASH.substring(0, 8);
                    localStorage.setItem(key, JSON.stringify(chainData));
                    setCachedCount(chainData.length);
                } else {
                    console.log('[Withdraw] No events found on chain or sync failed');
                }
            } catch (e) {
                console.error('[Withdraw] Auto-sync failed', e);
            }
        };

        sync();
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

    const handleSync = async () => {
        setIsProcessing(true);
        console.log('[Withdraw] Force-syncing commitments from chain...');
        try {
            const chainData = await fetchContractEvents(CONTRACT_HASH);
            if (chainData && chainData.length > 0) {
                const key = 'shroud_commitments_' + CONTRACT_HASH.substring(0, 8);
                localStorage.setItem(key, JSON.stringify(chainData));
                setCachedCount(chainData.length);
                alert(`Successfully synced ${chainData.length} commitments!`);
            } else {
                alert('No commitments found on chain or sync failed.');
            }
        } catch (e: any) {
            console.error('[Withdraw] Sync failed', e);
            alert('Sync failed: ' + e.message);
        } finally {
            setIsProcessing(false);
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
            const storedLeafIndex = secretData.leafIndex !== undefined ? parseInt(secretData.leafIndex) : -1;

            // 2. Init Crypto
            const crypto = new CryptoUtils();
            await crypto.init();

            // 3. Load all commitments from cache and rebuild tree
            console.log('[Withdraw] Loading commitments from cache...');
            const allCommitments = crypto.loadCommitmentsFromCache(CONTRACT_HASH);

            // Rebuild tree from cache
            const tree = crypto.createMerkleTree();
            for (const c of allCommitments) {
                tree.insert(c);
            }
            console.log(`[Withdraw] Tree rebuilt with ${allCommitments.length} cached commitments`);

            // Find our commitment
            let actualIndex = allCommitments.findIndex(c => c === commitment);

            if (actualIndex === -1) {
                console.warn('[Withdraw] Commitment not found in cache!');
                // If not found, we might need to sync
                throw new Error('Commitment not found in local cache. Please click "Force Re-sync" and try again.');
            }

            // Verify if storedLeafIndex matches
            if (storedLeafIndex !== -1 && storedLeafIndex !== actualIndex) {
                console.warn(`[Withdraw] Leaf index mismatch! stored=${storedLeafIndex}, foundInCache=${actualIndex}`);
                // We use the one found in cache as it's definitive for the current tree state
                console.log(`[Withdraw] Using index ${actualIndex} from cache.`);
            }

            const path = tree.getPath(actualIndex);
            const pathElements = path.pathElements;
            const pathIndices = path.pathIndices;
            const computedRoot = tree.getRoot();

            console.log(`[Withdraw] Root: ${computedRoot.toString(16).substring(0, 16)}...`);
            console.log(`[Withdraw] Using leaf index: ${actualIndex}`);

            // 4. Build proof input
            console.log('[Withdraw] Preparing proof input...');
            let recipientBigInt: bigint;
            try {
                // IMPORTANT: The protocol uses Account Hash for the recipient, not the public key hex.
                // We must derive the account hash to match what the contract expects and what ZK verifies.
                const { getAccountHash } = await import('../utils/casper');
                const accountHashHex = getAccountHash(recipient);
                recipientBigInt = BigInt('0x' + accountHashHex);

                console.log('[Withdraw] Derived Recipient Account Hash:', accountHashHex);
                console.log('[Withdraw] Recipient BigInt:', recipientBigInt.toString().substring(0, 10) + '...');
            } catch (err: any) {
                console.error('[Withdraw] Failed to parse recipient public key:', recipient);
                throw new Error(`Invalid recipient public key: ${err.message}. Please enter a valid Casper Public Key (starts with 01 or 02).`);
            }

            const input = {
                nullifier: nullifier,
                secret: secret,
                pathElements: pathElements,
                pathIndices: pathIndices,
                root: computedRoot,
                nullifierHash: crypto.computeNullifierHash(nullifier),
                recipient: recipientBigInt,
                relayer: 0n,
                fee: 0n
            };

            console.log('[Withdraw] Input prepared. Starting snarkjs.groth16.fullProve...');
            console.log('[Withdraw] Proof artifacts:', { wasm: "/withdraw.wasm", zkey: "/withdraw_final.zkey" });

            let proofResult;
            try {
                proofResult = await snarkjs.groth16.fullProve(
                    input,
                    "/withdraw.wasm",
                    "/withdraw_final.zkey"
                );
                console.log('[Withdraw] Proof generated successfully!');
            } catch (err: any) {
                console.error('[Withdraw] SnarkJS proof generation failed!', err);
                throw new Error(`Proof generation failed: ${err?.message || 'Check if wasm/zkey files exist in public folder'}`);
            }

            const { proof, publicSignals } = proofResult;
            setStatus('withdrawing');

            // 5. Create Transaction (SDK v5)
            console.log('[Withdraw] Creating transaction...');
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
            console.log('[Withdraw] Requesting signature...');
            const signedTransaction = await signTransaction(transaction, activeKey);
            console.log('[Withdraw] Submitting transaction...');
            const transactionHash = await sendSignedTransaction(signedTransaction);

            console.log("Withdraw Transaction Hash:", transactionHash);
            setStatus('success');

        } catch (e: any) {
            console.error("Withdraw failed error object:", e);
            setStatus('idle');
            alert(e.message || "Withdraw failed. See console for details.");
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

            {/* On-Chain Sync Status */}
            <div className="mt-4 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                    <div className="text-sm text-brand-300 font-medium">🔄 On-Chain Sync</div>
                    <div className="text-xs text-brand-200/70 font-mono">
                        {cachedCount} commitments historical
                    </div>
                </div>

                <button
                    onClick={handleSync}
                    disabled={isProcessing}
                    className="w-full py-2 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 rounded-xl text-xs font-medium text-brand-300 transition-all flex items-center justify-center disabled:opacity-50"
                >
                    {isProcessing ? <div className="w-3 h-3 border-2 border-brand-300/30 border-t-brand-300 rounded-full animate-spin mr-1"></div> : "🔄"} Force Re-sync from Explorer
                </button>

                <p className="text-[10px] text-gray-500 leading-relaxed text-center px-2">
                    Synced automatically from the Casper blockchain.
                </p>
            </div>
        </div>
    );
}

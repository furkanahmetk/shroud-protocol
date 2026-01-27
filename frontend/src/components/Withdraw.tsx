import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, Download, Upload, X } from 'lucide-react';
import { CryptoUtils } from '../utils/crypto';
import { createWithdrawTransaction, sendSignedTransaction, CONTRACT_HASH } from '../utils/casper';
import { useWallet } from '../hooks/useWallet';
import { useCommitment } from '../context/CommitmentContext';
import { SyncProgressTracker } from '../utils/syncProgress';
import { loadFromStorage, saveToStorage } from '../utils/storage';
const snarkjs = require('snarkjs');

interface WithdrawProps {
    isConnected: boolean;
    activeKey: string | null;
}

// Helper to format ETA
const formatETA = (ms: number | null): string => {
    if (ms === null || ms <= 0) return '';
    return SyncProgressTracker.formatTime(ms);
};

export default function Withdraw({ isConnected, activeKey }: WithdrawProps) {
    const [secretInput, setSecretInput] = useState('');
    const [recipient, setRecipient] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'proving' | 'withdrawing' | 'success'>('idle');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [importInput, setImportInput] = useState('');
    const { signTransaction } = useWallet();
    const { commitments, isSyncing, syncProgress, syncErrors, forceSync, cancelSync } = useCommitment();

    // Import commitments from CLI cache JSON
    const handleImportCommitments = () => {
        try {
            const importedCommitments = JSON.parse(importInput);
            if (!Array.isArray(importedCommitments)) {
                throw new Error('Input must be a JSON array');
            }

            // Convert to bigint and save using versioned storage
            const commitmentsBigInt = importedCommitments.map((c: string) => BigInt(c));
            saveToStorage(CONTRACT_HASH, commitmentsBigInt, Date.now());

            setImportInput('');
            setShowImport(false);
            alert(`Successfully imported ${importedCommitments.length} commitments!`);
        } catch (e: any) {
            alert('Failed to import: ' + e.message);
        }
    };

    const handleSync = async () => {
        setIsProcessing(true);
        console.log('[Withdraw] Force-syncing via global context...');
        try {
            await forceSync();
            alert(`Synced! Total commitments: ${commitments.length}`);
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
            // Handle both old format (number) and new format ('pending' or number)
            const storedLeafIndex = secretData.leafIndex === 'pending' || secretData.leafIndex === undefined
                ? -1
                : parseInt(secretData.leafIndex);

            // 2. Init Crypto
            const crypto = new CryptoUtils();
            await crypto.init();

            // 3. Force sync from blockchain to get the latest commitments
            // This is critical for resolving 'pending' leaf indices from concurrent deposits
            console.log('[Withdraw] Force syncing from blockchain before withdrawal...');
            setStatus('proving'); // Show loading state
            await forceSync();

            // Small delay to ensure state is updated
            await new Promise(resolve => setTimeout(resolve, 500));

            // 4. Load all commitments from global context and rebuild tree
            console.log('[Withdraw] Loading commitments from global context...');
            // Re-read commitments after sync (use fresh data from versioned storage)
            let allCommitments: bigint[] = [];
            try {
                const storageData = loadFromStorage(CONTRACT_HASH);
                allCommitments = storageData.commitments;
                console.log(`[Withdraw] Loaded ${allCommitments.length} commitments from v${storageData.version} storage`);

                // DEBUG: Print first 3 commitments to compare with secret JSON
                console.log('[Withdraw] DEBUG - First 3 synced commitments:');
                for (let i = 0; i < Math.min(3, allCommitments.length); i++) {
                    console.log(`  [${i}]: ${allCommitments[i].toString()}`);
                }
                console.log(`[Withdraw] DEBUG - Looking for commitment: ${commitment.toString()}`);
            } catch (e) {
                console.error('[Withdraw] Failed to load commitments from cache:', e);
            }

            if (allCommitments.length === 0) {
                throw new Error('No commitments found after sync. Please wait for your deposit to be confirmed on-chain and try again.');
            }

            // Rebuild tree from synced data
            const tree = crypto.createMerkleTree();
            for (const c of allCommitments) {
                tree.insert(c);
            }
            console.log(`[Withdraw] Tree rebuilt with ${allCommitments.length} on-chain commitments`);

            // 5. Find our commitment in the synced on-chain data
            let actualIndex = allCommitments.findIndex(c => c === commitment);

            if (actualIndex === -1) {
                console.warn('[Withdraw] Commitment not found in synced on-chain data!');
                // Provide helpful error message
                if (storedLeafIndex === -1) {
                    // This was a 'pending' deposit - probably not confirmed yet
                    throw new Error('Your deposit has not been confirmed on-chain yet. Please wait a few minutes for the transaction to be processed, then try again.');
                } else {
                    throw new Error('Commitment not found on-chain. Please click "Force Re-sync" to fetch the latest data and try again.');
                }
            }

            // Log if there was a mismatch (for debugging concurrent deposit issues)
            if (storedLeafIndex !== -1 && storedLeafIndex !== actualIndex) {
                console.warn(`[Withdraw] Leaf index corrected: stored=${storedLeafIndex}, actual=${actualIndex}`);
                console.log(`[Withdraw] This can happen with concurrent deposits - using correct on-chain index.`);
            }

            // 6. Compute Merkle path and root
            // CRITICAL: Use getPathToLatestRoot to get a path to the CURRENT root.
            // The contract only keeps the last 30 roots, so using old cached paths
            // will fail with "UnknownRoot" if >30 deposits happened since your deposit.
            const path = tree.getPathToLatestRoot(actualIndex);
            const pathElements = path.pathElements;
            const pathIndices = path.pathIndices;
            const computedRoot = path.root; // Latest root - guaranteed to be in contract's history

            console.log(`[Withdraw] Using LATEST root: ${computedRoot.toString(16).substring(0, 16)}...`);
            console.log(`[Withdraw] Using leaf index: ${actualIndex} (of ${allCommitments.length} total)`);
            console.log(`[Withdraw] DEBUG - Full root (decimal): ${computedRoot.toString()}`);
            console.log(`[Withdraw] DEBUG - This is the root that will be sent to the contract`);

            // 6b. VERIFICATION: Check that our commitment matches what cryptoUtils computes
            const verifyCommitment = crypto.computeCommitment(nullifier, secret);
            console.log(`[Withdraw] Stored commitment:   ${commitment.toString().substring(0, 20)}...`);
            console.log(`[Withdraw] Computed commitment: ${verifyCommitment.toString().substring(0, 20)}...`);

            if (verifyCommitment !== commitment) {
                console.error('[Withdraw] CRITICAL: Commitment mismatch! The secret/nullifier do not match the stored commitment.');
                throw new Error('Commitment verification failed. The secret key may be corrupted.');
            }

            // 6c. VERIFICATION: Reconstruct root from path to verify before sending to snarkjs
            const reconstructedRoot = crypto.computeMerkleRoot(commitment, pathIndices, pathElements);
            console.log(`[Withdraw] Tree root:          ${computedRoot.toString().substring(0, 20)}...`);
            console.log(`[Withdraw] Reconstructed root: ${reconstructedRoot.toString().substring(0, 20)}...`);

            if (reconstructedRoot !== computedRoot) {
                console.error('[Withdraw] CRITICAL: Root mismatch! Path does not reconstruct to the expected root.');
                console.error(`[Withdraw] pathElements[0]: ${pathElements[0]?.toString().substring(0, 20)}...`);
                console.error(`[Withdraw] pathIndices: ${pathIndices.slice(0, 5).join(', ')}...`);
                throw new Error('Merkle path verification failed. The proof would fail on-chain. Please try Force Re-sync.');
            }

            console.log('[Withdraw] ✅ Pre-flight verification passed: commitment and root are valid.');

            // DEBUG: Show critical values for troubleshooting
            console.log('========== DEBUG VALUES FOR CONTRACT COMPARISON ==========');
            console.log('Commitment (full decimal):', commitment.toString());
            console.log('Root (full decimal):', computedRoot.toString());
            console.log('Root (hex):', '0x' + computedRoot.toString(16));
            console.log('Number of commitments in tree:', allCommitments.length);
            console.log('Leaf index:', actualIndex);
            console.log('==========================================================');

            // 7. Build proof input
            let recipientBigInt: bigint;
            try {
                const { getAccountHash } = await import('../utils/casper');
                const accountHashHex = getAccountHash(recipient);
                recipientBigInt = BigInt('0x' + accountHashHex);
            } catch (err: any) {
                console.error('[Withdraw] Failed to parse recipient public key:', recipient);
                throw new Error(`Invalid recipient public key: ${err.message}. Please enter a valid Casper Public Key.`);
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

            console.log('[Withdraw] Circuit inputs prepared:', {
                nullifier: nullifier.toString().substring(0, 20) + '...',
                secret: '***hidden***',
                pathElementsCount: pathElements.length,
                pathIndicesCount: pathIndices.length,
                root: computedRoot.toString().substring(0, 20) + '...',
                nullifierHash: input.nullifierHash.toString().substring(0, 20) + '...',
            });

            // Generate real ZK proof using snarkjs
            console.log('[Withdraw] Generating ZK proof...');
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                "/withdraw.wasm",
                "/withdraw_final.zkey"
            );
            console.log('[Withdraw] ZK proof generated successfully');

            setStatus('withdrawing');

            // 8. Create Transaction (SDK v5)
            const proofJson = JSON.stringify(proof);
            const proofBytes = new TextEncoder().encode(proofJson);

            const transaction = createWithdrawTransaction(
                activeKey,
                proofBytes,
                computedRoot,
                BigInt(publicSignals[1]), // nullifier_hash from signals
                recipient
            );

            // 9. Sign & Send
            const signedTransaction = await signTransaction(transaction, activeKey);
            const transactionHash = await sendSignedTransaction(signedTransaction);

            console.log("Withdraw Transaction Hash:", transactionHash);
            setTxHash(transactionHash);
            setStatus('success');

        } catch (e: any) {
            console.error("Withdraw failed:", e);
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
                {txHash && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-500">Transaction Hash</p>
                        <a
                            href={`https://testnet.cspr.live/deploy/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-300 font-mono text-sm break-all transition-colors"
                        >
                            {txHash}
                        </a>
                        <p className="text-[10px] text-gray-500 mt-2">
                            Click to view on explorer. Wait for confirmation to verify success.
                        </p>
                    </div>
                )}
                <button
                    onClick={() => {
                        setStatus('idle');
                        setSecretInput('');
                        setRecipient('');
                        setTxHash(null);
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
                disabled={isProcessing || isSyncing || !secretInput || !recipient}
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
                        {commitments.length} commitments
                    </div>
                </div>

                {/* Progress bar when syncing */}
                {isSyncing && syncProgress && syncProgress.total > 0 && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-brand-200/70">
                                {syncProgress.phase === 'fetching_transfers' && 'Fetching transfers...'}
                                {syncProgress.phase === 'fetching_deploys' && `Processing ${syncProgress.current}/${syncProgress.total}...`}
                                {syncProgress.phase === 'processing' && 'Building tree...'}
                            </span>
                            <div className="flex items-center gap-2">
                                {syncProgress.eta && syncProgress.eta > 0 && (
                                    <span className="text-brand-200/50">
                                        ~{formatETA(syncProgress.eta)}
                                    </span>
                                )}
                                <button
                                    onClick={cancelSync}
                                    className="text-brand-200/50 hover:text-red-400 transition-colors"
                                    title="Cancel sync"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-brand-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min((syncProgress.current / syncProgress.total) * 100, 100)}%` }}
                            />
                        </div>
                        {syncErrors.length > 0 && (
                            <div className="text-[10px] text-yellow-400/70 text-center">
                                {syncErrors.length} error(s) occurred - sync continues
                            </div>
                        )}
                    </div>
                )}

                {/* Sync status message when not syncing */}
                {!isSyncing && syncProgress?.phase === 'complete' && (
                    <div className="text-xs text-green-400/70 text-center">
                        ✓ Sync complete
                    </div>
                )}

                {!isSyncing && syncProgress?.phase === 'error' && (
                    <div className="text-xs text-red-400/70 text-center">
                        ⚠ Last sync failed - try again
                    </div>
                )}

                <button
                    onClick={handleSync}
                    disabled={isProcessing || isSyncing}
                    className="w-full py-2 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 rounded-xl text-xs font-medium text-brand-300 transition-all flex items-center justify-center disabled:opacity-50"
                >
                    {isProcessing || isSyncing ? (
                        <>
                            <div className="w-3 h-3 border-2 border-brand-300/30 border-t-brand-300 rounded-full animate-spin mr-1"></div>
                            {syncProgress && syncProgress.total > 0
                                ? `${syncProgress.current}/${syncProgress.total}`
                                : 'Syncing...'}
                        </>
                    ) : (
                        "🔄 Force Re-sync from Explorer"
                    )}
                </button>

                <p className="text-[10px] text-gray-500 leading-relaxed text-center px-2">
                    Synced automatically from the Casper blockchain.
                </p>
            </div>
        </div >
    );
}

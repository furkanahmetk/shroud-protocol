import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { CONTRACT_HASH, fetchProtocolActivity, fetchProtocolActivityOptimized, SyncProgressCallback } from '../utils/casper';
import { CryptoUtils } from '../utils/crypto';
import { SigningLock } from '../utils/signingLock';
import { loadFromStorage, saveToStorage } from '../utils/storage';
import { SyncProgress, SyncPhase, SyncError } from '../utils/syncProgress';

// Feature flag for optimized sync (can be overridden via env)
const USE_OPTIMIZED_SYNC = process.env.NEXT_PUBLIC_USE_OPTIMIZED_SYNC !== 'false';

interface CommitmentContextType {
    commitments: bigint[];
    isSyncing: boolean;
    lastSynced: number;
    error: string | null;
    syncProgress: SyncProgress | null;
    syncErrors: SyncError[];
    forceSync: () => Promise<void>;
    cancelSync: () => void;
}

const CommitmentContext = createContext<CommitmentContextType | undefined>(undefined);

const initialSyncProgress: SyncProgress = {
    phase: 'idle',
    current: 0,
    total: 0,
    message: '',
    errors: [],
    startTime: 0,
    eta: null
};

export function CommitmentProvider({ children }: { children: ReactNode }) {
    const [commitments, setCommitments] = useState<bigint[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(0);
    const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<number>(0);
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Ref to track timestamp inside stale closures (setInterval)
    const lastProcessedTimestampRef = useRef<number>(0);

    // AbortController for cancelling sync
    const abortControllerRef = useRef<AbortController | null>(null);

    // ETA calculation state
    const etaStateRef = useRef<{ startTime: number; completionTimes: number[]; lastProgressTime: number }>({
        startTime: 0,
        completionTimes: [],
        lastProgressTime: 0
    });

    // Calculate ETA from progress
    const calculateETA = useCallback((current: number, total: number): number | null => {
        const state = etaStateRef.current;
        if (state.completionTimes.length === 0 || total === 0) return null;

        const remaining = total - current;
        if (remaining <= 0) return 0;

        const avgTime = state.completionTimes.reduce((a, b) => a + b, 0) / state.completionTimes.length;
        return Math.round(avgTime * remaining);
    }, []);

    // Progress callback for optimized sync
    const handleSyncProgress: SyncProgressCallback = useCallback((progress) => {
        const now = Date.now();
        const state = etaStateRef.current;

        // Track time per item for ETA
        if (progress.current > 0 && state.lastProgressTime > 0) {
            const timeSinceLast = now - state.lastProgressTime;
            state.completionTimes.push(timeSinceLast);
            if (state.completionTimes.length > 10) {
                state.completionTimes.shift();
            }
        }
        state.lastProgressTime = now;

        setSyncProgress({
            phase: progress.phase as SyncPhase,
            current: progress.current,
            total: progress.total,
            message: progress.message,
            errors: [],
            startTime: state.startTime,
            eta: calculateETA(progress.current, progress.total)
        });
    }, [calculateETA]);

    // Initial load from cache using versioned storage
    useEffect(() => {
        const storageData = loadFromStorage(CONTRACT_HASH);

        if (storageData.commitments.length > 0) {
            setCommitments(storageData.commitments);
            setLastProcessedTimestamp(storageData.lastSyncTimestamp);
            lastProcessedTimestampRef.current = storageData.lastSyncTimestamp;
            setLastSynced(Date.now());
            console.log(`[CommitmentContext] Loaded ${storageData.commitments.length} commitments from v${storageData.version} storage (ts=${storageData.lastSyncTimestamp})`);
        } else {
            console.log('[CommitmentContext] Cache empty - forcing full sync from 0');
        }

        // Trigger initial sync
        sync(false, storageData.lastSyncTimestamp, storageData.commitments);
    }, []);

    // Polling every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (SigningLock.isLocked()) {
                console.log('[CommitmentContext] Skipping poll - signing in progress');
                return;
            }
            if (isSyncing) {
                console.log('[CommitmentContext] Skipping poll - sync already in progress');
                return;
            }
            console.log('[CommitmentContext] Polling for new events...');
            sync(true);
        }, 60000);

        return () => clearInterval(interval);
    }, [isSyncing]);

    const sync = async (silent = false, initialTs?: number, initialCommitments?: bigint[]) => {
        // Skip sync if signing is in progress
        if (SigningLock.isLocked()) {
            console.log('[CommitmentContext] Skipping sync - signing in progress');
            return;
        }

        // Create new abort controller for this sync
        abortControllerRef.current = new AbortController();

        if (!silent) {
            setIsSyncing(true);
            // Initialize ETA tracking
            etaStateRef.current = {
                startTime: Date.now(),
                completionTimes: [],
                lastProgressTime: Date.now()
            };
            setSyncProgress({
                ...initialSyncProgress,
                phase: 'fetching_transfers',
                message: 'Starting sync...',
                startTime: Date.now()
            });
        }
        setError(null);

        try {
            const minTimestamp = initialTs !== undefined ? initialTs : lastProcessedTimestampRef.current;
            const currentCommitments = initialCommitments || commitments;

            console.log(`[CommitmentContext] Syncing (silent=${silent}, since=${minTimestamp}, optimized=${USE_OPTIMIZED_SYNC})...`);

            let activity;

            if (USE_OPTIMIZED_SYNC) {
                // Use optimized parallel fetch
                activity = await fetchProtocolActivityOptimized(
                    CONTRACT_HASH,
                    minTimestamp,
                    silent ? undefined : handleSyncProgress,
                    abortControllerRef.current.signal
                );
            } else {
                // Fallback to sequential fetch
                activity = await fetchProtocolActivity(CONTRACT_HASH, minTimestamp);
            }

            const newDeposits = activity.deposits;
            const newMaxTs = activity.maxTimestamp;

            if (newDeposits.length > 0 || newMaxTs > minTimestamp) {
                const newCommitmentsBigInt = newDeposits.map(s => BigInt(s));

                // Merge (avoid duplicates)
                const existingSet = new Set(currentCommitments.map(c => c.toString()));
                const uniqueNew = newCommitmentsBigInt.filter(c => !existingSet.has(c.toString()));

                if (uniqueNew.length > 0) {
                    const updatedList = [...currentCommitments, ...uniqueNew];
                    setCommitments(updatedList);

                    // Save to versioned storage
                    saveToStorage(CONTRACT_HASH, updatedList, newMaxTs > minTimestamp ? newMaxTs : minTimestamp);

                    if (!silent) console.log(`[CommitmentContext] Synced ${uniqueNew.length} NEW commitments. Total: ${updatedList.length}`);
                } else {
                    if (!silent) console.log(`[CommitmentContext] No new unique commitments found.`);
                }

                // Update timestamp if advanced
                if (newMaxTs > minTimestamp) {
                    setLastProcessedTimestamp(newMaxTs);
                    lastProcessedTimestampRef.current = newMaxTs;
                    console.log(`[CommitmentContext] Updated sync timestamp to ${newMaxTs}`);
                }

                setLastSynced(Date.now());
            } else {
                console.log('[CommitmentContext] No new events found.');
            }

            if (!silent) {
                setSyncProgress({
                    ...initialSyncProgress,
                    phase: 'complete',
                    message: `Sync complete. ${commitments.length} commitments.`,
                    startTime: etaStateRef.current.startTime
                });
            }
        } catch (e: any) {
            if (e.message === 'Sync aborted') {
                console.log('[CommitmentContext] Sync was cancelled');
                setSyncProgress(null);
                return;
            }
            console.error('[CommitmentContext] Sync failed:', e);
            setError(e.message);
            setSyncErrors(prev => [...prev, {
                id: `sync-${Date.now()}`,
                message: e.message,
                timestamp: Date.now(),
                recoverable: true
            }]);
            if (!silent) {
                setSyncProgress({
                    ...initialSyncProgress,
                    phase: 'error',
                    message: e.message,
                    startTime: etaStateRef.current.startTime
                });
            }
        } finally {
            if (!silent) setIsSyncing(false);
            abortControllerRef.current = null;
        }
    };

    const forceSync = async () => {
        await sync(false);
    };

    const cancelSync = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[CommitmentContext] Cancelling sync...');
            abortControllerRef.current.abort();
        }
    }, []);

    return (
        <CommitmentContext.Provider value={{
            commitments,
            isSyncing,
            lastSynced,
            error,
            syncProgress,
            syncErrors,
            forceSync,
            cancelSync
        }}>
            {children}
        </CommitmentContext.Provider>
    );
}

export function useCommitment() {
    const context = useContext(CommitmentContext);
    if (context === undefined) {
        throw new Error('useCommitment must be used within a CommitmentProvider');
    }
    return context;
}

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { CONTRACT_HASH, fetchProtocolActivity } from '../utils/casper';
import { CryptoUtils } from '../utils/crypto';
import { SigningLock } from '../utils/signingLock';

interface CommitmentContextType {
    commitments: bigint[];
    isSyncing: boolean;
    lastSynced: number;
    error: string | null;
    forceSync: () => Promise<void>;
}

const CommitmentContext = createContext<CommitmentContextType | undefined>(undefined);

export function CommitmentProvider({ children }: { children: ReactNode }) {
    const [commitments, setCommitments] = useState<bigint[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(0);
    const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<number>(0);

    // Ref to track timestamp inside stale closures (setInterval)
    const lastProcessedTimestampRef = useRef<number>(0);

    const [error, setError] = useState<string | null>(null);

    // Initial load from cache
    useEffect(() => {
        const crypto = new CryptoUtils();
        const cached = crypto.loadCommitmentsFromCache(CONTRACT_HASH); // returns bigint[]

        // Load timestamp
        const tsKey = 'shroud_sync_timestamp_' + CONTRACT_HASH.substring(0, 8);
        const cachedTs = localStorage.getItem(tsKey);

        // SAFETY: Only trust the stored timestamp if we have data to match it.
        // If cached commitments are empty, we MUST force a full sync (ts=0) to recover history.
        const ts = (cachedTs && cached.length > 0) ? parseInt(cachedTs) : 0;

        if (cached.length > 0) {
            setCommitments(cached);
            setLastProcessedTimestamp(ts);
            lastProcessedTimestampRef.current = ts;
            setLastSynced(Date.now());
            console.log(`[CommitmentContext] Loaded ${cached.length} commitments from cache (ts=${ts})`);
        } else {
            console.log('[CommitmentContext] Cache empty - forcing full sync from 0');
        }
        // Trigger initial sync
        sync(false, ts, cached);
    }, []);

    // Polling every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (SigningLock.isLocked()) {
                console.log('[CommitmentContext] Skipping poll - signing in progress');
                return;
            }
            console.log('[CommitmentContext] Polling for new events...');
            sync(true); // silent sync
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const sync = async (silent = false, initialTs?: number, initialCommitments?: bigint[]) => {
        // Skip sync if signing is in progress
        if (SigningLock.isLocked()) {
            console.log('[CommitmentContext] Skipping sync - signing in progress');
            return;
        }

        if (!silent) setIsSyncing(true);
        setError(null);

        try {
            // Use current REFerence or passed initial values
            const minTimestamp = initialTs !== undefined ? initialTs : lastProcessedTimestampRef.current;
            const currentCommitments = initialCommitments || commitments;

            console.log(`[CommitmentContext] Syncing (silent=${silent}, since=${minTimestamp})...`);

            // Fetch ONLY new data
            const activity = await fetchProtocolActivity(CONTRACT_HASH, minTimestamp);
            const newDeposits = activity.deposits; // string[]
            const newMaxTs = activity.maxTimestamp;

            if (newDeposits.length > 0 || newMaxTs > minTimestamp) {
                // Convert new deposits to BigInt
                const newCommitmentsBigInt = newDeposits.map(s => BigInt(s));

                // Merge (avoid duplicates if any overlap happened)
                // We use a Set of strings for uniqueness check
                const existingSet = new Set(currentCommitments.map(c => c.toString()));
                const uniqueNew = newCommitmentsBigInt.filter(c => !existingSet.has(c.toString()));

                if (uniqueNew.length > 0) {
                    const updatedList = [...currentCommitments, ...uniqueNew];
                    setCommitments(updatedList);

                    // Update Cache
                    const crypto = new CryptoUtils();
                    // CryptoUtils expects string[] for saving? Or we can just reuse the manual save logic
                    // We use direct localStorage to match existing pattern, or we could add a save method to CryptoUtils
                    const key = 'shroud_commitments_' + CONTRACT_HASH.substring(0, 8);
                    const updatedStrings = updatedList.map(b => b.toString());
                    localStorage.setItem(key, JSON.stringify(updatedStrings));

                    if (!silent) console.log(`[CommitmentContext] Synced ${uniqueNew.length} NEW commitments. Total: ${updatedList.length}`);
                } else {
                    if (!silent) console.log(`[CommitmentContext] No new unique commitments found.`);
                }

                // Update timestamp if advanced
                if (newMaxTs > minTimestamp) {
                    setLastProcessedTimestamp(newMaxTs);
                    lastProcessedTimestampRef.current = newMaxTs; // Update REF immediately
                    const tsKey = 'shroud_sync_timestamp_' + CONTRACT_HASH.substring(0, 8);
                    localStorage.setItem(tsKey, newMaxTs.toString());
                    console.log(`[CommitmentContext] Updated sync timestamp to ${newMaxTs}`);
                }

                setLastSynced(Date.now());
            } else {
                console.log('[CommitmentContext] No new events found.');
            }
        } catch (e: any) {
            console.error('[CommitmentContext] Sync failed:', e);
            setError(e.message);
        } finally {
            if (!silent) setIsSyncing(false);
        }
    };

    const forceSync = async () => {
        await sync(false);
    };

    return (
        <CommitmentContext.Provider value={{
            commitments,
            isSyncing,
            lastSynced,
            error,
            forceSync
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

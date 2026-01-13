import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CONTRACT_HASH, fetchContractEvents } from '../utils/casper';
import { CryptoUtils } from '../utils/crypto';

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
    const [error, setError] = useState<string | null>(null);

    // Initial load from cache
    useEffect(() => {
        const crypto = new CryptoUtils();
        const cached = crypto.loadCommitmentsFromCache(CONTRACT_HASH);
        if (cached.length > 0) {
            setCommitments(cached);
            setLastSynced(Date.now());
        }
        // Trigger initial sync
        sync();
    }, []);

    // Polling every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            console.log('[CommitmentContext] Polling for new events...');
            sync(true); // silent sync
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const sync = async (silent = false) => {
        if (!silent) setIsSyncing(true);
        setError(null);

        try {
            console.log(`[CommitmentContext] Syncing (silent=${silent})...`);

            // Fetch raw strings from explorer/RPC
            const chainDataStrings = await fetchContractEvents(CONTRACT_HASH); // returns string[]

            if (chainDataStrings && chainDataStrings.length > 0) {
                // Convert to BigInt for internal state
                const chainDataBigInt = chainDataStrings.map(s => BigInt(s));

                setCommitments(chainDataBigInt);
                setLastSynced(Date.now());

                // Update LocalStorage Cache via CryptoUtils or direct
                // We use direct localStorage to match existing pattern, or we could add a save method to CryptoUtils
                const key = 'shroud_commitments_' + CONTRACT_HASH.substring(0, 8);
                localStorage.setItem(key, JSON.stringify(chainDataStrings)); // Store as strings for JSON safety

                if (!silent) console.log(`[CommitmentContext] Synced ${chainDataStrings.length} commitments.`);
            } else {
                console.log('[CommitmentContext] No events found.');
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

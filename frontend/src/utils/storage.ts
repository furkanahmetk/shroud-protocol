/**
 * Versioned Storage - Local storage with schema versioning and migration
 *
 * Provides backward-compatible storage with integrity verification.
 */

const STORAGE_VERSION = 2;
const STORAGE_KEY_PREFIX = 'shroud_commitments_';
const TIMESTAMP_KEY_PREFIX = 'shroud_sync_timestamp_';
const LEGACY_KEY_PREFIX = 'shroud_commitments_v1_backup_';

export interface StorageSchemaV2 {
    version: 2;
    commitments: string[];
    lastSyncTimestamp: number;
    integrityHash: string;
    createdAt: number;
    updatedAt: number;
}

export interface StorageData {
    commitments: bigint[];
    lastSyncTimestamp: number;
    version: number;
}

/**
 * Compute a simple integrity hash for commitments
 * Uses a basic hash since we can't use async crypto in sync storage operations
 */
function computeIntegrityHash(commitments: string[]): string {
    if (commitments.length === 0) return '0';

    // Simple hash based on first/last/length/sum
    let hash = commitments.length;
    const first = commitments[0] || '0';
    const last = commitments[commitments.length - 1] || '0';

    // XOR first 8 chars of first and last commitment
    for (let i = 0; i < Math.min(8, first.length); i++) {
        hash ^= first.charCodeAt(i);
    }
    for (let i = 0; i < Math.min(8, last.length); i++) {
        hash ^= last.charCodeAt(i);
    }

    return hash.toString(16).padStart(8, '0');
}

/**
 * Check if stored data is v1 format (plain array)
 */
function isV1Format(data: any): boolean {
    return Array.isArray(data);
}

/**
 * Check if stored data is v2 format
 */
function isV2Format(data: any): data is StorageSchemaV2 {
    return (
        data &&
        typeof data === 'object' &&
        data.version === 2 &&
        Array.isArray(data.commitments)
    );
}

/**
 * Migrate v1 data to v2 format
 */
function migrateV1ToV2(
    commitments: string[],
    contractKey: string
): StorageSchemaV2 {
    // Try to get timestamp from legacy location
    const tsKey = TIMESTAMP_KEY_PREFIX + contractKey;
    const legacyTs = localStorage.getItem(tsKey);
    const timestamp = legacyTs ? parseInt(legacyTs, 10) : 0;

    const now = Date.now();

    return {
        version: 2,
        commitments,
        lastSyncTimestamp: timestamp,
        integrityHash: computeIntegrityHash(commitments),
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Get storage key for a contract
 */
function getStorageKey(contractHash: string): string {
    return STORAGE_KEY_PREFIX + contractHash.substring(0, 8);
}

/**
 * Get legacy backup key for rollback safety
 */
function getLegacyBackupKey(contractHash: string): string {
    return LEGACY_KEY_PREFIX + contractHash.substring(0, 8);
}

/**
 * Load commitments from storage with automatic migration
 */
export function loadFromStorage(contractHash: string): StorageData {
    const key = getStorageKey(contractHash);
    const backupKey = getLegacyBackupKey(contractHash);

    try {
        const stored = localStorage.getItem(key);
        if (!stored) {
            return {
                commitments: [],
                lastSyncTimestamp: 0,
                version: STORAGE_VERSION
            };
        }

        const data = JSON.parse(stored);

        // V2 format
        if (isV2Format(data)) {
            // Verify integrity
            const expectedHash = computeIntegrityHash(data.commitments);
            if (data.integrityHash !== expectedHash) {
                console.warn('[Storage] Integrity hash mismatch, data may be corrupted');
                // Continue anyway, but log the issue
            }

            return {
                commitments: data.commitments.map((c: string) => BigInt(c)),
                lastSyncTimestamp: data.lastSyncTimestamp,
                version: 2
            };
        }

        // V1 format (plain array) - migrate
        if (isV1Format(data)) {
            console.log('[Storage] Detected v1 format, migrating to v2...');

            // Backup v1 data for rollback safety
            localStorage.setItem(backupKey, stored);
            console.log('[Storage] V1 data backed up to:', backupKey);

            // Migrate to v2
            const v2Data = migrateV1ToV2(data, contractHash.substring(0, 8));
            localStorage.setItem(key, JSON.stringify(v2Data));
            console.log(`[Storage] Migrated ${data.length} commitments to v2 format`);

            return {
                commitments: v2Data.commitments.map((c: string) => BigInt(c)),
                lastSyncTimestamp: v2Data.lastSyncTimestamp,
                version: 2
            };
        }

        // Unknown format
        console.warn('[Storage] Unknown storage format, returning empty');
        return {
            commitments: [],
            lastSyncTimestamp: 0,
            version: STORAGE_VERSION
        };
    } catch (e) {
        console.error('[Storage] Failed to load from storage:', e);
        return {
            commitments: [],
            lastSyncTimestamp: 0,
            version: STORAGE_VERSION
        };
    }
}

/**
 * Save commitments to storage in v2 format
 */
export function saveToStorage(
    contractHash: string,
    commitments: bigint[],
    lastSyncTimestamp: number
): void {
    const key = getStorageKey(contractHash);

    try {
        // Load existing data to preserve createdAt
        let createdAt = Date.now();
        const existing = localStorage.getItem(key);
        if (existing) {
            try {
                const parsed = JSON.parse(existing);
                if (isV2Format(parsed)) {
                    createdAt = parsed.createdAt;
                }
            } catch {
                // Ignore parse errors
            }
        }

        const commitmentStrings = commitments.map(c => c.toString());

        const data: StorageSchemaV2 = {
            version: 2,
            commitments: commitmentStrings,
            lastSyncTimestamp,
            integrityHash: computeIntegrityHash(commitmentStrings),
            createdAt,
            updatedAt: Date.now()
        };

        localStorage.setItem(key, JSON.stringify(data));

        // Also update legacy timestamp key for backward compatibility
        const tsKey = TIMESTAMP_KEY_PREFIX + contractHash.substring(0, 8);
        localStorage.setItem(tsKey, lastSyncTimestamp.toString());

    } catch (e) {
        console.error('[Storage] Failed to save to storage:', e);
        throw e;
    }
}

/**
 * Clear storage for a contract (preserves backup)
 */
export function clearStorage(contractHash: string): void {
    const key = getStorageKey(contractHash);
    const tsKey = TIMESTAMP_KEY_PREFIX + contractHash.substring(0, 8);

    localStorage.removeItem(key);
    localStorage.removeItem(tsKey);
}

/**
 * Get storage info without loading full data
 */
export function getStorageInfo(contractHash: string): {
    exists: boolean;
    version: number;
    commitmentCount: number;
    lastSync: number;
    hasBackup: boolean;
} {
    const key = getStorageKey(contractHash);
    const backupKey = getLegacyBackupKey(contractHash);

    try {
        const stored = localStorage.getItem(key);
        const hasBackup = localStorage.getItem(backupKey) !== null;

        if (!stored) {
            return {
                exists: false,
                version: 0,
                commitmentCount: 0,
                lastSync: 0,
                hasBackup
            };
        }

        const data = JSON.parse(stored);

        if (isV2Format(data)) {
            return {
                exists: true,
                version: 2,
                commitmentCount: data.commitments.length,
                lastSync: data.lastSyncTimestamp,
                hasBackup
            };
        }

        if (isV1Format(data)) {
            return {
                exists: true,
                version: 1,
                commitmentCount: data.length,
                lastSync: 0,
                hasBackup
            };
        }

        return {
            exists: true,
            version: 0,
            commitmentCount: 0,
            lastSync: 0,
            hasBackup
        };
    } catch {
        return {
            exists: false,
            version: 0,
            commitmentCount: 0,
            lastSync: 0,
            hasBackup: false
        };
    }
}

/**
 * Restore from v1 backup if available
 */
export function restoreFromBackup(contractHash: string): boolean {
    const key = getStorageKey(contractHash);
    const backupKey = getLegacyBackupKey(contractHash);

    try {
        const backup = localStorage.getItem(backupKey);
        if (backup) {
            localStorage.setItem(key, backup);
            console.log('[Storage] Restored from v1 backup');
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Clean up legacy backup (call after confirming v2 is stable)
 */
export function cleanupBackup(contractHash: string): void {
    const backupKey = getLegacyBackupKey(contractHash);
    localStorage.removeItem(backupKey);
    console.log('[Storage] Cleaned up v1 backup');
}

export default {
    loadFromStorage,
    saveToStorage,
    clearStorage,
    getStorageInfo,
    restoreFromBackup,
    cleanupBackup
};

/**
 * SyncProgress - Progress tracking for protocol sync operations
 *
 * Tracks sync phases, progress counts, ETA calculation, and error aggregation.
 */

export type SyncPhase =
    | 'idle'
    | 'fetching_transfers'
    | 'fetching_deploys'
    | 'processing'
    | 'complete'
    | 'error';

export interface SyncError {
    id: string;
    message: string;
    timestamp: number;
    recoverable: boolean;
}

export interface SyncProgress {
    phase: SyncPhase;
    current: number;
    total: number;
    message: string;
    errors: SyncError[];
    startTime: number;
    eta: number | null; // milliseconds remaining, null if unknown
}

export interface SyncProgressOptions {
    /** Rolling average window size for ETA calculation */
    etaWindowSize?: number;
    /** Maximum errors to retain */
    maxErrors?: number;
}

export class SyncProgressTracker {
    private phase: SyncPhase = 'idle';
    private current: number = 0;
    private total: number = 0;
    private message: string = '';
    private errors: SyncError[] = [];
    private startTime: number = 0;
    private completionTimes: number[] = [];
    private lastProgressTime: number = 0;

    private etaWindowSize: number;
    private maxErrors: number;
    private listeners: Set<(progress: SyncProgress) => void> = new Set();

    constructor(options: SyncProgressOptions = {}) {
        this.etaWindowSize = options.etaWindowSize ?? 10;
        this.maxErrors = options.maxErrors ?? 50;
    }

    /**
     * Start a new sync operation
     */
    start(phase: SyncPhase = 'fetching_transfers', message: string = 'Starting sync...'): void {
        this.phase = phase;
        this.current = 0;
        this.total = 0;
        this.message = message;
        this.errors = [];
        this.startTime = Date.now();
        this.completionTimes = [];
        this.lastProgressTime = Date.now();
        this.notify();
    }

    /**
     * Set the total count for the current phase
     */
    setTotal(total: number): void {
        this.total = total;
        this.notify();
    }

    /**
     * Update phase
     */
    setPhase(phase: SyncPhase, message?: string): void {
        this.phase = phase;
        if (message) this.message = message;
        // Reset progress for new phase
        this.current = 0;
        this.total = 0;
        this.completionTimes = [];
        this.lastProgressTime = Date.now();
        this.notify();
    }

    /**
     * Increment progress counter
     */
    increment(count: number = 1, message?: string): void {
        const now = Date.now();
        const timeSinceLastProgress = now - this.lastProgressTime;

        // Track completion time for ETA calculation
        if (this.lastProgressTime > 0) {
            this.completionTimes.push(timeSinceLastProgress / count);
            // Keep only recent samples for rolling average
            if (this.completionTimes.length > this.etaWindowSize) {
                this.completionTimes.shift();
            }
        }

        this.current += count;
        this.lastProgressTime = now;
        if (message) this.message = message;
        this.notify();
    }

    /**
     * Set absolute progress
     */
    setProgress(current: number, total?: number, message?: string): void {
        const previousCurrent = this.current;
        this.current = current;
        if (total !== undefined) this.total = total;
        if (message) this.message = message;

        // Track completion time for ETA
        const now = Date.now();
        const itemsCompleted = current - previousCurrent;
        if (itemsCompleted > 0 && this.lastProgressTime > 0) {
            const timePer = (now - this.lastProgressTime) / itemsCompleted;
            this.completionTimes.push(timePer);
            if (this.completionTimes.length > this.etaWindowSize) {
                this.completionTimes.shift();
            }
        }
        this.lastProgressTime = now;

        this.notify();
    }

    /**
     * Add an error without stopping sync
     */
    addError(id: string, message: string, recoverable: boolean = true): void {
        this.errors.push({
            id,
            message,
            timestamp: Date.now(),
            recoverable
        });

        // Trim old errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        this.notify();
    }

    /**
     * Mark sync as complete
     */
    complete(message: string = 'Sync complete'): void {
        this.phase = 'complete';
        this.message = message;
        this.notify();
    }

    /**
     * Mark sync as failed
     */
    fail(message: string = 'Sync failed'): void {
        this.phase = 'error';
        this.message = message;
        this.notify();
    }

    /**
     * Reset to idle state
     */
    reset(): void {
        this.phase = 'idle';
        this.current = 0;
        this.total = 0;
        this.message = '';
        this.errors = [];
        this.startTime = 0;
        this.completionTimes = [];
        this.lastProgressTime = 0;
        this.notify();
    }

    /**
     * Calculate ETA in milliseconds
     */
    private calculateETA(): number | null {
        if (this.completionTimes.length === 0 || this.total === 0) {
            return null;
        }

        const remaining = this.total - this.current;
        if (remaining <= 0) return 0;

        // Rolling average of completion times
        const avgTimePerItem =
            this.completionTimes.reduce((a, b) => a + b, 0) / this.completionTimes.length;

        return Math.round(avgTimePerItem * remaining);
    }

    /**
     * Get current progress state
     */
    getProgress(): SyncProgress {
        return {
            phase: this.phase,
            current: this.current,
            total: this.total,
            message: this.message,
            errors: [...this.errors],
            startTime: this.startTime,
            eta: this.calculateETA()
        };
    }

    /**
     * Subscribe to progress updates
     */
    subscribe(listener: (progress: SyncProgress) => void): () => void {
        this.listeners.add(listener);
        // Immediately send current state
        listener(this.getProgress());
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of progress change
     */
    private notify(): void {
        const progress = this.getProgress();
        this.listeners.forEach(listener => {
            try {
                listener(progress);
            } catch (e) {
                console.error('[SyncProgress] Listener error:', e);
            }
        });
    }

    /**
     * Format progress as human-readable string
     */
    static formatProgress(progress: SyncProgress): string {
        const { phase, current, total, message, eta } = progress;

        if (phase === 'idle') return 'Idle';
        if (phase === 'complete') return message || 'Complete';
        if (phase === 'error') return message || 'Error';

        let text = message || phase;

        if (total > 0) {
            text += ` (${current}/${total})`;
        } else if (current > 0) {
            text += ` (${current})`;
        }

        if (eta !== null && eta > 0) {
            text += ` - ${SyncProgressTracker.formatTime(eta)} remaining`;
        }

        return text;
    }

    /**
     * Format milliseconds as human-readable time
     */
    static formatTime(ms: number): string {
        if (ms < 1000) return '< 1s';
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `~${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60) {
            return remainingSeconds > 0 ? `~${minutes}m ${remainingSeconds}s` : `~${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `~${hours}h ${remainingMinutes}m`;
    }
}

/**
 * Create a progress callback that updates the tracker
 */
export function createProgressCallback(
    tracker: SyncProgressTracker
): (progress: { completed: number; total: number; failed: number; currentId?: string }) => void {
    return (progress) => {
        tracker.setProgress(
            progress.completed,
            progress.total,
            progress.currentId ? `Processing ${progress.currentId.substring(0, 10)}...` : undefined
        );

        if (progress.failed > 0) {
            const errorCount = tracker.getProgress().errors.length;
            if (errorCount < progress.failed) {
                // New failures occurred
                tracker.addError(
                    `batch-${progress.completed}`,
                    `${progress.failed} requests failed`,
                    true
                );
            }
        }
    };
}

export default SyncProgressTracker;

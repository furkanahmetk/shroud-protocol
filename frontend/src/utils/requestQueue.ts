/**
 * RequestQueue - Concurrent request handler with retry, rate limiting, and circuit breaker
 *
 * Optimizes parallel API calls while respecting rate limits and handling failures gracefully.
 */

export interface RequestQueueOptions {
    /** Maximum concurrent requests (default: 5) */
    concurrency?: number;
    /** Minimum delay between request starts in ms (default: 100) */
    minDelay?: number;
    /** Maximum retries per request (default: 3) */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms (default: 500) */
    baseBackoffMs?: number;
    /** Maximum backoff delay in ms (default: 10000) */
    maxBackoffMs?: number;
    /** Number of consecutive failures before circuit opens (default: 5) */
    circuitBreakerThreshold?: number;
    /** Time to wait before resetting circuit breaker in ms (default: 30000) */
    circuitResetMs?: number;
}

export interface QueueTask<T> {
    id: string;
    execute: (signal?: AbortSignal) => Promise<T>;
}

export interface QueueProgress {
    completed: number;
    total: number;
    failed: number;
    currentId?: string;
}

export interface QueueResult<T> {
    id: string;
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
}

type ProgressCallback = (progress: QueueProgress) => void;

export class RequestQueue {
    private concurrency: number;
    private minDelay: number;
    private maxRetries: number;
    private baseBackoffMs: number;
    private maxBackoffMs: number;
    private circuitBreakerThreshold: number;
    private circuitResetMs: number;

    // Circuit breaker state
    private consecutiveFailures: number = 0;
    private circuitOpen: boolean = false;
    private circuitOpenedAt: number = 0;

    // Rate limiting state
    private lastRequestTime: number = 0;

    constructor(options: RequestQueueOptions = {}) {
        this.concurrency = options.concurrency ?? 5;
        this.minDelay = options.minDelay ?? 100;
        this.maxRetries = options.maxRetries ?? 3;
        this.baseBackoffMs = options.baseBackoffMs ?? 500;
        this.maxBackoffMs = options.maxBackoffMs ?? 10000;
        this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 5;
        this.circuitResetMs = options.circuitResetMs ?? 30000;
    }

    /**
     * Process all tasks with concurrency control and progress reporting
     */
    async processAll<T>(
        tasks: QueueTask<T>[],
        onProgress?: ProgressCallback,
        abortSignal?: AbortSignal
    ): Promise<QueueResult<T>[]> {
        const results: QueueResult<T>[] = [];
        const pending = [...tasks];
        const inFlight = new Set<Promise<void>>();
        let completed = 0;
        let failed = 0;

        const reportProgress = (currentId?: string) => {
            if (onProgress) {
                onProgress({
                    completed,
                    total: tasks.length,
                    failed,
                    currentId
                });
            }
        };

        reportProgress();

        const processTask = async (task: QueueTask<T>): Promise<void> => {
            // Check abort signal
            if (abortSignal?.aborted) {
                results.push({
                    id: task.id,
                    success: false,
                    error: new Error('Aborted'),
                    attempts: 0
                });
                return;
            }

            // Check circuit breaker
            if (this.circuitOpen) {
                const timeSinceOpen = Date.now() - this.circuitOpenedAt;
                if (timeSinceOpen < this.circuitResetMs) {
                    // Circuit is open, fail fast
                    results.push({
                        id: task.id,
                        success: false,
                        error: new Error('Circuit breaker open'),
                        attempts: 0
                    });
                    failed++;
                    reportProgress(task.id);
                    return;
                } else {
                    // Reset circuit breaker (half-open state)
                    this.circuitOpen = false;
                    this.consecutiveFailures = 0;
                    console.log('[RequestQueue] Circuit breaker reset');
                }
            }

            // Rate limiting - ensure minimum delay between requests
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.minDelay) {
                await this.delay(this.minDelay - timeSinceLastRequest);
            }
            this.lastRequestTime = Date.now();

            let lastError: Error | undefined;
            let attempts = 0;

            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                attempts = attempt + 1;

                if (abortSignal?.aborted) {
                    results.push({
                        id: task.id,
                        success: false,
                        error: new Error('Aborted'),
                        attempts
                    });
                    return;
                }

                try {
                    const data = await task.execute(abortSignal);

                    // Success - reset consecutive failures
                    this.consecutiveFailures = 0;

                    results.push({
                        id: task.id,
                        success: true,
                        data,
                        attempts
                    });
                    completed++;
                    reportProgress(task.id);
                    return;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));

                    // Track consecutive failures for circuit breaker
                    this.consecutiveFailures++;

                    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
                        this.circuitOpen = true;
                        this.circuitOpenedAt = Date.now();
                        console.warn(`[RequestQueue] Circuit breaker opened after ${this.consecutiveFailures} failures`);
                    }

                    // Don't retry on certain errors
                    if (this.isNonRetryableError(lastError)) {
                        break;
                    }

                    // Exponential backoff before retry
                    if (attempt < this.maxRetries) {
                        const backoffMs = Math.min(
                            this.baseBackoffMs * Math.pow(2, attempt),
                            this.maxBackoffMs
                        );
                        console.log(`[RequestQueue] Task ${task.id} failed (attempt ${attempts}), retrying in ${backoffMs}ms`);
                        await this.delay(backoffMs);
                    }
                }
            }

            // All retries exhausted
            results.push({
                id: task.id,
                success: false,
                error: lastError,
                attempts
            });
            failed++;
            completed++;
            reportProgress(task.id);
        };

        // Process tasks with concurrency control
        while (pending.length > 0 || inFlight.size > 0) {
            // Check abort
            if (abortSignal?.aborted) {
                // Mark remaining as aborted
                for (const task of pending) {
                    results.push({
                        id: task.id,
                        success: false,
                        error: new Error('Aborted'),
                        attempts: 0
                    });
                }
                break;
            }

            // Start new tasks up to concurrency limit
            while (pending.length > 0 && inFlight.size < this.concurrency) {
                const task = pending.shift()!;
                const promise = processTask(task).then(() => {
                    inFlight.delete(promise);
                });
                inFlight.add(promise);
            }

            // Wait for at least one to complete
            if (inFlight.size > 0) {
                await Promise.race(inFlight);
            }
        }

        return results;
    }

    /**
     * Check if error should not be retried
     */
    private isNonRetryableError(error: Error): boolean {
        const message = error.message.toLowerCase();
        // Don't retry on client errors (4xx) or specific known errors
        return (
            message.includes('404') ||
            message.includes('403') ||
            message.includes('401') ||
            message.includes('not found') ||
            message.includes('aborted')
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset circuit breaker manually
     */
    resetCircuitBreaker(): void {
        this.circuitOpen = false;
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = 0;
    }

    /**
     * Get current circuit breaker state
     */
    getCircuitState(): { isOpen: boolean; consecutiveFailures: number } {
        return {
            isOpen: this.circuitOpen,
            consecutiveFailures: this.consecutiveFailures
        };
    }
}

export default RequestQueue;
